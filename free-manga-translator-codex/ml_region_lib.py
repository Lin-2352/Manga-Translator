"""
ml_region_lib.py  —  Dual-Model manga text detection & replacement pipeline.

Model A: comic-text-detector (ONNX) — detects Japanese text bounding boxes
         AND produces pixel-level text segmentation masks.
Model B: manga109-segmentation-bubble (YOLOv11n-seg, PyTorch) — segments speech bubbles.
Model C: LaMa (Large Mask Inpainting, ONNX) — deep learning inpainting that
         reconstructs background art (screentones, line art) behind removed text.

Both inference models are LOCKED to CUDA (RTX 4060). No CPU fallback.

Workflow:
  Step 1: Model A detects text boxes + pixel-level text seg mask.
  Step 2: Model B segments speech bubble pixel masks.
  Step 3: Intersection test classifies each text box as:
          - "bubble_text"  (inside a bubble) → LaMa inpainting
          - "floating_text" (outside all bubbles) → SKIP (protect artwork)
  Step 4: Selective erasure — seg mask combined with bubble masks, fed to LaMa.
  Step 5: English text rendered inside erased regions.
"""

from __future__ import annotations

import json
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Box
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Box:
    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def width(self) -> int:
        return max(0, self.x2 - self.x1)

    @property
    def height(self) -> int:
        return max(0, self.y2 - self.y1)

    @property
    def area(self) -> int:
        return self.width * self.height

    def expanded(self, pad: int, img_w: int, img_h: int) -> Box:
        return Box(
            x1=max(0, self.x1 - pad),
            y1=max(0, self.y1 - pad),
            x2=min(img_w, self.x2 + pad),
            y2=min(img_h, self.y2 + pad),
        )

    def to_dict(self) -> dict:
        return {"x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2,
                "width": self.width, "height": self.height}


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class MLConfig:
    # Model A: text detector (ONNX)
    text_model_path: str = "models/comictextdetector.pt.onnx"
    confidence_threshold: float = 0.35
    nms_iou_threshold: float = 0.45
    input_size: int = 1024

    # Model A-S: semantic text detector/classifier (YOLO .pt or .onnx)
    semantic_model_path: str = "models/semantic/comic-text-and-bubble-detector.onnx"
    semantic_confidence: float = 0.20
    semantic_nms_iou: float = 0.45
    semantic_input_size: int = 1600
    semantic_max_det: int = 400

    # Step 2 precision controls (reduce non-text false positives)
    semantic_dialogue_confidence: float = 0.40
    semantic_onomatopoeia_confidence: float = 0.55
    semantic_post_nms_iou: float = 0.35
    semantic_min_box_area: int = 160
    semantic_max_box_area_ratio: float = 0.18
    semantic_min_dim: int = 10
    semantic_min_ink_ratio: float = 0.015
    semantic_max_ink_ratio: float = 0.70
    semantic_min_edge_ratio: float = 0.004

    # Model B: bubble segmentor (PyTorch/Ultralytics)
    bubble_model_path: str = "models/manga109_bubble/best.pt"
    bubble_confidence: float = 0.50
    bubble_overlap_threshold: float = 0.50  # min overlap to classify as "inside bubble"

    # Model C: LaMa inpainter (ONNX)
    lama_model_path: str = "models/lama/lama_fp32.onnx"

    # Seg mask
    seg_threshold: float = 0.50      # threshold for text seg mask
    seg_dilate_kernel: int = 3       # dilate seg mask to cover anti-aliased edges
    seg_dilate_iterations: int = 1

    # Legacy inpainting (kept as fallback)
    mask_padding: int = 8
    adaptive_block_size: int = 15
    adaptive_c: int = 4
    dilate_kernel_size: int = 3
    dilate_iterations: int = 1
    inpaint_radius: int = 3

    # English text
    font_path: Optional[str] = None
    font_size_max: int = 28
    font_size_min: int = 8
    font_color: Tuple[int, int, int] = (0, 0, 0)
    line_spacing: float = 1.3

    # Debug colours (BGR)
    green_color: Tuple[int, int, int] = (0, 255, 0)     # bubble text
    red_color: Tuple[int, int, int] = (0, 0, 255)       # floating text
    yellow_color: Tuple[int, int, int] = (0, 255, 255)   # expanded mask
    bubble_outline_color: Tuple[int, int, int] = (255, 180, 0)  # bubble contour (cyan)
    box_thickness: int = 2


# ===================================================================
# MODEL A — TEXT DETECTOR  (ONNX + CUDA)
# ===================================================================

def load_text_model(model_path: str, allow_cpu: bool = False):
    """Load ONNX text detector. STRICT CUDA-only by default."""
    import onnxruntime as ort

    if allow_cpu:
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        session = ort.InferenceSession(model_path, providers=providers)
        active = session.get_providers()
        gpu = 'CUDAExecutionProvider' in active
        print(f"  [Model A] Text detector: {'CUDA' if gpu else 'CPU (allow_cpu=True)'}")
        return session

    try:
        session = ort.InferenceSession(
            model_path, providers=['CUDAExecutionProvider'],
        )
    except Exception as e:
        raise RuntimeError(
            f"CUDA GPU REQUIRED for Model A (text detector) but unavailable.\n"
            f"Error: {e}\n"
            f"Fix: Add CUDA 12.x bin/ to PATH (cublasLt64_12.dll, cudnn*.dll)\n"
            f"Or: allow_cpu=True for development"
        ) from e

    print("  [Model A] Text detector: CUDA LOCKED")
    return session


def load_semantic_model(model_path: str, allow_cpu: bool = False) -> SemanticModelHandle:
    """
    Load semantic text detector/classifier.
    Supports:
      - PyTorch/Ultralytics weights (.pt) -> STRICT cuda:0 by default
      - ONNX weights (.onnx)             -> STRICT CUDAExecutionProvider by default
    """
    suffix = Path(model_path).suffix.lower()

    # ONNX path: enforce CUDAExecutionProvider availability
    if suffix == ".onnx":
        import onnxruntime as ort

        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if allow_cpu else ['CUDAExecutionProvider']
        try:
            session = ort.InferenceSession(model_path, providers=providers)
        except Exception as e:
            raise RuntimeError(
                f"CUDAExecutionProvider REQUIRED for semantic ONNX model but unavailable.\n"
                f"Error: {e}\n"
                f"Fix: install onnxruntime-gpu + CUDA 12.x runtime, or use allow_cpu=True for development."
            ) from e

        active = session.get_providers()
        has_cuda_ep = 'CUDAExecutionProvider' in active
        if not allow_cpu and not has_cuda_ep:
            raise RuntimeError(
                "Semantic ONNX model loaded without CUDAExecutionProvider while CUDA lock is required."
            )

        device = 'cuda:0' if has_cuda_ep else 'cpu'

        # RT-DETR ONNX exported by HF expects 2 inputs:
        #   images [N,3,H,W] float32 (rescaled)
        #   orig_target_sizes [N,2] int64 (h,w)
        input_names = {i.name for i in session.get_inputs()}
        if {'images', 'orig_target_sizes'}.issubset(input_names):
            # Known class order from ogkalu/comic-text-and-bubble-detector config:
            # 0=bubble, 1=text_bubble, 2=text_free
            label_map = {0: 'bubble', 1: 'text_bubble', 2: 'text_free'}
            print(
                "  [Model A-S] Semantic detector (RT-DETR ONNX): "
                + ("CUDAExecutionProvider LOCKED" if has_cuda_ep else "CPU (allow_cpu=True)")
            )
            return SemanticModelHandle(
                model=session,
                device=device,
                backend="onnx_rtdetr",
                input_name='images',
                size_input_name='orig_target_sizes',
                label_map=label_map,
            )

        # Fallback: non-RTDETR ONNX loaded through Ultralytics
        from ultralytics import YOLO
        print(
            "  [Model A-S] Semantic detector (ONNX): "
            + ("CUDAExecutionProvider LOCKED" if has_cuda_ep else "CPU (allow_cpu=True)")
        )
        return SemanticModelHandle(
            model=YOLO(model_path),
            device=device,
            backend="yolo_onnx",
        )

    # PyTorch path: enforce cuda:0
    import torch
    from ultralytics import YOLO

    if not allow_cpu and not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU REQUIRED for semantic PyTorch model but unavailable.\n"
            "Fix: Install PyTorch with CUDA support.\n"
            "Or: allow_cpu=True for development"
        )

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    if not allow_cpu and device != "cuda:0":
        raise RuntimeError("CUDA required but PyTorch cannot access gpu:0")

    print(
        "  [Model A-S] Semantic detector (PyTorch): "
        + ("CUDA:0 LOCKED" if device == "cuda:0" else "CPU (allow_cpu=True)")
    )
    return SemanticModelHandle(
        model=YOLO(model_path),
        device=device,
        backend="yolo_pt",
    )


def _preprocess(image: np.ndarray, input_size: int) -> np.ndarray:
    resized = cv2.resize(image, (input_size, input_size))
    blob = resized.astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))
    blob = np.expand_dims(blob, axis=0)
    return blob


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> List[int]:
    if len(boxes) == 0:
        return []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep: List[int] = []
    while len(order) > 0:
        i = order[0]
        keep.append(int(i))
        if len(order) == 1:
            break
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0.0, xx2 - xx1) * np.maximum(0.0, yy2 - yy1)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        order = order[np.where(iou <= iou_thresh)[0] + 1]
    return keep


@dataclass
class TextDetectionResult:
    boxes: List[Box]
    seg_mask: np.ndarray   # [H_orig, W_orig] binary uint8 (255 = text pixel)


@dataclass
class SemanticModelHandle:
    model: object
    device: str
    backend: str  # "yolo_pt" or "yolo_onnx"
    input_name: Optional[str] = None
    size_input_name: Optional[str] = None
    label_map: Dict[int, str] = field(default_factory=dict)


@dataclass
class SemanticTextRegion:
    box: Box
    class_id: int
    raw_class_name: str
    semantic_class: str   # "dialogue" | "onomatopoeia"
    action: str           # "erase" | "skip_protect"
    confidence: float


@dataclass
class SemanticDetectionResult:
    regions: List[SemanticTextRegion]


def detect_text(session, image: np.ndarray, cfg: MLConfig) -> TextDetectionResult:
    """
    Run comic-text-detector. Returns BOTH bounding boxes AND pixel-level
    text segmentation mask at original image resolution.
    """
    h_orig, w_orig = image.shape[:2]
    sx, sy = w_orig / cfg.input_size, h_orig / cfg.input_size
    blob = _preprocess(image, cfg.input_size)

    # Get ALL outputs: blk (boxes), seg (text pixel mask), det (unused)
    outputs = session.run(None, {"images": blob})
    blk = outputs[0][0]            # [64512, 7]
    seg_raw = outputs[1][0][0]     # [1024, 1024] float [0,1]

    # --- Process bounding boxes ---
    obj = blk[:, 4]
    mask = obj > cfg.confidence_threshold
    preds, obj_filtered = blk[mask], obj[mask]
    boxes = []
    if len(preds) > 0:
        cx, cy, w, h = preds[:, 0], preds[:, 1], preds[:, 2], preds[:, 3]
        corners = np.stack([cx - w/2, cy - h/2, cx + w/2, cy + h/2], axis=1)
        keep = _nms(corners, obj_filtered, cfg.nms_iou_threshold)
        corners = corners[keep]
        for d in corners:
            bx1, by1 = int(max(0, d[0]*sx)), int(max(0, d[1]*sy))
            bx2, by2 = int(min(w_orig, d[2]*sx)), int(min(h_orig, d[3]*sy))
            if bx2 > bx1 and by2 > by1:
                boxes.append(Box(x1=bx1, y1=by1, x2=bx2, y2=by2))

    # --- Process seg mask → binary at original resolution ---
    seg_binary = (seg_raw > cfg.seg_threshold).astype(np.uint8)
    seg_resized = cv2.resize(seg_binary, (w_orig, h_orig),
                             interpolation=cv2.INTER_NEAREST)
    # Dilate slightly to cover anti-aliased text edges
    if cfg.seg_dilate_kernel > 0:
        kernel = np.ones((cfg.seg_dilate_kernel, cfg.seg_dilate_kernel), np.uint8)
        seg_resized = cv2.dilate(seg_resized, kernel,
                                 iterations=cfg.seg_dilate_iterations)
    seg_resized = seg_resized * 255  # 0 or 255

    return TextDetectionResult(boxes=boxes, seg_mask=seg_resized)


def detect_semantic_text_regions(
    semantic_handle: SemanticModelHandle,
    image: np.ndarray,
    cfg: MLConfig,
) -> SemanticDetectionResult:
    """
    Run semantic detector and return detected text regions with STEP-2 semantic
    classes and actions.

    NOTE: Step 1 only.
    In Step 2 we remap raw model labels as follows:
      - text_bubble -> dialogue      (erase)
      - text_free   -> onomatopoeia  (skip_protect)
      - bubble      -> dropped/ignored
    """
    def _norm(name: str) -> str:
        return name.strip().lower().replace(" ", "_")

    def _remap(raw_name: str) -> Tuple[Optional[str], Optional[str]]:
        rn = _norm(raw_name)
        if rn == "text_bubble":
            return "dialogue", "erase"
        if rn == "text_free":
            return "onomatopoeia", "skip_protect"
        if rn == "bubble":
            return None, None  # fully ignore bubble class from Model A semantic output
        return None, None

    h, w = image.shape[:2]
    image_area = max(1, h * w)

    # Collect raw candidates first, then apply shared post-filters + class-wise NMS.
    candidates: List[Tuple[int, str, str, str, float, Box]] = []

    def _passes_geometry(b: Box) -> bool:
        if b.width < cfg.semantic_min_dim or b.height < cfg.semantic_min_dim:
            return False
        area = b.width * b.height
        if area < cfg.semantic_min_box_area:
            return False
        if area / image_area > cfg.semantic_max_box_area_ratio:
            return False
        return True

    def _passes_textness(b: Box) -> bool:
        roi = image[b.y1:b.y2, b.x1:b.x2]
        if roi.size == 0:
            return False
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        # Ink density via Otsu-inverted binary map
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        ink_ratio = float(np.count_nonzero(bw)) / max(1, bw.size)
        if ink_ratio < cfg.semantic_min_ink_ratio or ink_ratio > cfg.semantic_max_ink_ratio:
            return False
        # Structural edges ratio to suppress flat/background patches
        edges = cv2.Canny(gray, 80, 180)
        edge_ratio = float(np.count_nonzero(edges)) / max(1, edges.size)
        if edge_ratio < cfg.semantic_min_edge_ratio:
            return False
        return True

    def _score_gate(semantic_class: str, score: float) -> bool:
        if semantic_class == "dialogue":
            return score >= cfg.semantic_dialogue_confidence
        if semantic_class == "onomatopoeia":
            return score >= cfg.semantic_onomatopoeia_confidence
        return False

    if semantic_handle.backend == "onnx_rtdetr":
        # HF RT-DETR preprocessor semantics:
        # resize to 640x640 + rescale by 1/255 (no mean/std normalize)
        resized = cv2.resize(image, (640, 640), interpolation=cv2.INTER_LINEAR)
        inp = resized.astype(np.float32) / 255.0
        inp = np.transpose(inp, (2, 0, 1))[np.newaxis]  # [1,3,640,640]
        orig_sizes = np.array([[h, w]], dtype=np.int64)

        labels, boxes, scores = semantic_handle.model.run(None, {
            semantic_handle.input_name or 'images': inp,
            semantic_handle.size_input_name or 'orig_target_sizes': orig_sizes,
        })

        lbl = labels[0].astype(np.int32)
        bxs = boxes[0]
        scs = scores[0]

        for cls_id, box, score in zip(lbl, bxs, scs):
            score = float(score)
            if score < cfg.semantic_confidence:
                continue

            raw_name = semantic_handle.label_map.get(int(cls_id), f"class_{int(cls_id)}")
            semantic_class, action = _remap(raw_name)
            if semantic_class is None:
                continue  # drop raw bubble/unknown classes
            if not _score_gate(semantic_class, score):
                continue

            x1, y1, x2, y2 = box.tolist()
            bx1 = int(np.clip(np.floor(float(x1)), 0, max(0, w - 1)))
            by1 = int(np.clip(np.floor(float(y1)), 0, max(0, h - 1)))
            bx2 = int(np.clip(np.ceil(float(x2)), 0, w))
            by2 = int(np.clip(np.ceil(float(y2)), 0, h))
            if bx2 <= bx1 or by2 <= by1:
                continue

            b = Box(x1=bx1, y1=by1, x2=bx2, y2=by2)
            if not _passes_geometry(b):
                continue
            if not _passes_textness(b):
                continue

            candidates.append((
                int(cls_id), raw_name, semantic_class, action or "skip_protect", score, b
            ))

    if semantic_handle.backend != "onnx_rtdetr":
        # Ultralytics path (raw cv2 image directly; no manual /255)
        predict_kwargs = dict(
            source=image,
            conf=cfg.semantic_confidence,
            iou=cfg.semantic_nms_iou,
            imgsz=cfg.semantic_input_size,
            max_det=cfg.semantic_max_det,
            verbose=False,
        )
        if semantic_handle.backend == "yolo_pt":
            predict_kwargs["device"] = semantic_handle.device

        results = semantic_handle.model.predict(**predict_kwargs)
        r = results[0]
        if r.boxes is None or len(r.boxes) == 0:
            return SemanticDetectionResult(regions=[])

        names = r.names if isinstance(r.names, dict) else {i: n for i, n in enumerate(r.names)}
        xyxy = r.boxes.xyxy.detach().cpu().numpy()
        confs = r.boxes.conf.detach().cpu().numpy()
        clss = r.boxes.cls.detach().cpu().numpy().astype(np.int32)

        for (x1, y1, x2, y2), score, cls_id in zip(xyxy, confs, clss):
            raw_name = str(names.get(int(cls_id), f"class_{int(cls_id)}"))
            semantic_class, action = _remap(raw_name)
            if semantic_class is None:
                continue  # drop bubble/unknown
            score = float(score)
            if not _score_gate(semantic_class, score):
                continue

            bx1 = int(np.clip(np.floor(float(x1)), 0, max(0, w - 1)))
            by1 = int(np.clip(np.floor(float(y1)), 0, max(0, h - 1)))
            bx2 = int(np.clip(np.ceil(float(x2)), 0, w))
            by2 = int(np.clip(np.ceil(float(y2)), 0, h))
            if bx2 <= bx1 or by2 <= by1:
                continue

            b = Box(x1=bx1, y1=by1, x2=bx2, y2=by2)
            if not _passes_geometry(b):
                continue
            if not _passes_textness(b):
                continue

            candidates.append((
                int(cls_id), raw_name, semantic_class, action or "skip_protect", score, b
            ))

    # Class-wise NMS to reduce duplicate/noisy boxes.
    regions: List[SemanticTextRegion] = []
    for sem in ("dialogue", "onomatopoeia"):
        subset = [c for c in candidates if c[2] == sem]
        if not subset:
            continue

        boxes_xywh = [[c[5].x1, c[5].y1, c[5].width, c[5].height] for c in subset]
        scores_arr = [float(c[4]) for c in subset]
        score_thr = cfg.semantic_dialogue_confidence if sem == "dialogue" else cfg.semantic_onomatopoeia_confidence
        keep = cv2.dnn.NMSBoxes(boxes_xywh, scores_arr, score_thr, cfg.semantic_post_nms_iou)

        if keep is None or len(keep) == 0:
            continue

        keep_idx = np.array(keep).reshape(-1).tolist()
        for k in keep_idx:
            cls_id, raw_name, semantic_class, action, score, b = subset[k]
            regions.append(
                SemanticTextRegion(
                    box=b,
                    class_id=int(cls_id),
                    raw_class_name=raw_name,
                    semantic_class=semantic_class,
                    action=action,
                    confidence=float(score),
                )
            )

    regions.sort(key=lambda d: d.confidence, reverse=True)
    return SemanticDetectionResult(regions=regions)


# ===================================================================
# MODEL B — SPEECH BUBBLE SEGMENTOR  (Ultralytics + PyTorch CUDA)
# ===================================================================

def load_bubble_model(model_path: str, allow_cpu: bool = False):
    """Load YOLOv11n bubble segmentor. STRICT CUDA-only by default."""
    import torch
    from ultralytics import YOLO

    if not allow_cpu and not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU REQUIRED for Model B (bubble segmentor) but unavailable.\n"
            "Fix: Install PyTorch with CUDA support.\n"
            "Or: allow_cpu=True for development"
        )

    model = YOLO(model_path)
    device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    if not allow_cpu and device == 'cpu':
        raise RuntimeError("CUDA required but PyTorch cannot access GPU")

    print(f"  [Model B] Bubble segmentor: {device.upper()}" +
          (" LOCKED" if device == 'cuda:0' else " (allow_cpu=True)"))
    return model, device


def detect_bubbles(
    model,
    device: str,
    image: np.ndarray,
    cfg: MLConfig,
) -> List[np.ndarray]:
    """
    Run bubble segmentation. Returns list of binary masks [H, W] at original
    image resolution. Each mask: 255 = inside bubble, 0 = outside.
    """
    h, w = image.shape[:2]
    results = model.predict(
        source=image, device=device, conf=cfg.bubble_confidence,
        imgsz=1600, verbose=False, retina_masks=True,
    )
    r = results[0]
    masks = []
    if r.masks is not None:
        for m in r.masks.data:
            mask_np = m.cpu().numpy()
            mask_resized = cv2.resize(mask_np, (w, h), interpolation=cv2.INTER_LINEAR)
            binary = (mask_resized > 0.5).astype(np.uint8) * 255
            masks.append(binary)
    return masks


# ===================================================================
# MODEL C — LaMa INPAINTER  (ONNX + CUDA)
# ===================================================================

def load_lama_model(model_path: str, allow_cpu: bool = False):
    """Load LaMa inpainting ONNX model. STRICT CUDA-only by default."""
    import onnxruntime as ort

    if allow_cpu:
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        session = ort.InferenceSession(model_path, providers=providers)
        active = session.get_providers()
        gpu = 'CUDAExecutionProvider' in active
        print(f"  [Model C] LaMa inpainter: {'CUDA' if gpu else 'CPU (allow_cpu=True)'}")
        return session

    try:
        session = ort.InferenceSession(
            model_path, providers=['CUDAExecutionProvider'],
        )
    except Exception as e:
        raise RuntimeError(
            f"CUDA GPU REQUIRED for Model C (LaMa inpainter) but unavailable.\n"
            f"Error: {e}\n"
            f"Fix: Add CUDA 12.x bin/ to PATH\n"
            f"Or: allow_cpu=True for development"
        ) from e

    print("  [Model C] LaMa inpainter: CUDA LOCKED")
    return session


def lama_inpaint(
    lama_session,
    image: np.ndarray,
    mask: np.ndarray,
) -> np.ndarray:
    """
    Run LaMa inpainting on an image region.
    image: BGR uint8 [H, W, 3]
    mask:  uint8 [H, W] — 255 = inpaint, 0 = keep
    Returns: inpainted BGR uint8 [H, W, 3]
    """
    h_orig, w_orig = image.shape[:2]
    lama_size = 512

    # Resize to LaMa's input size
    img_resized = cv2.resize(image, (lama_size, lama_size))
    mask_resized = cv2.resize(mask, (lama_size, lama_size),
                              interpolation=cv2.INTER_NEAREST)

    # Prepare tensors: [1, 3, 512, 512] float32 [0,1]
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    img_tensor = img_rgb.astype(np.float32) / 255.0
    img_tensor = np.transpose(img_tensor, (2, 0, 1))[np.newaxis]  # [1,3,512,512]

    # Mask: [1, 1, 512, 512] float32, 1.0 = inpaint
    mask_tensor = (mask_resized > 127).astype(np.float32)
    mask_tensor = mask_tensor[np.newaxis, np.newaxis]  # [1,1,512,512]

    # Run LaMa
    output = lama_session.run(None, {
        "image": img_tensor,
        "mask": mask_tensor,
    })[0]  # [1, 3, 512, 512]

    # Convert back to BGR uint8 at original resolution
    result = output[0]  # [3, 512, 512]
    result = np.transpose(result, (1, 2, 0))  # [512, 512, 3]
    result = np.clip(result * 255, 0, 255).astype(np.uint8)
    result = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)
    result = cv2.resize(result, (w_orig, h_orig))

    return result


# ===================================================================
# INTERSECTION LOGIC — classify text as bubble vs floating
# ===================================================================

@dataclass
class ClassifiedText:
    box: Box
    expanded_box: Box
    text_type: str       # legacy: "bubble_text"/"floating_text" or Step2 route name
    bubble_idx: int      # index of matched bubble, or -1
    overlap: float       # overlap ratio with best bubble
    semantic_type: str = "unknown"   # "dialogue" | "onomatopoeia" | "unknown"
    route_state: str = "unknown"     # "bubble_dialogue" | "floating_dialogue" | "onomatopoeia"
    action: str = "unknown"          # "erase" | "careful_erase" | "skip_protect"
    raw_class_name: str = ""
    confidence: float = 0.0


def classify_text_regions(
    text_boxes: List[Box],
    expanded_boxes: List[Box],
    bubble_masks: List[np.ndarray],
    threshold: float = 0.50,
) -> List[ClassifiedText]:
    """
    For each text box, test pixel-level overlap against every bubble mask.
    If >= threshold of the text box area falls inside a bubble → "bubble_text".
    Otherwise → "floating_text".
    """
    classified = []
    for tbox, ebox in zip(text_boxes, expanded_boxes):
        box_area = max(1, tbox.width * tbox.height)
        best_overlap = 0.0
        best_idx = -1

        for i, bmask in enumerate(bubble_masks):
            roi = bmask[tbox.y1:tbox.y2, tbox.x1:tbox.x2]
            overlap_pixels = np.count_nonzero(roi)
            ratio = overlap_pixels / box_area

            if ratio > best_overlap:
                best_overlap = ratio
                best_idx = i

        text_type = "bubble_text" if best_overlap >= threshold else "floating_text"
        classified.append(ClassifiedText(
            box=tbox, expanded_box=ebox,
            text_type=text_type, bubble_idx=best_idx, overlap=best_overlap,
        ))

    return classified


def build_step2_routing_state(
    semantic_result: SemanticDetectionResult,
    bubble_masks: List[np.ndarray],
    cfg: MLConfig,
    img_w: int,
    img_h: int,
) -> List[ClassifiedText]:
    """
    Step 2 routing-state builder.

    Produces one of exactly three route states:
      1) bubble_dialogue   (dialogue + inside bubble)   -> erase
      2) floating_dialogue (dialogue + outside bubble)  -> careful_erase
      3) onomatopoeia      (any geometry)               -> skip_protect
    """
    routed: List[ClassifiedText] = []

    for region in semantic_result.regions:
        box = region.box
        expanded = box.expanded(cfg.mask_padding, img_w, img_h)

        box_area = max(1, box.width * box.height)
        best_overlap = 0.0
        best_idx = -1

        for i, bmask in enumerate(bubble_masks):
            roi = bmask[box.y1:box.y2, box.x1:box.x2]
            overlap_pixels = np.count_nonzero(roi)
            ratio = overlap_pixels / box_area
            if ratio > best_overlap:
                best_overlap = ratio
                best_idx = i

        if region.semantic_class == "onomatopoeia":
            route_state = "onomatopoeia"
            action = "skip_protect"
        else:
            inside = best_overlap >= cfg.bubble_overlap_threshold
            route_state = "bubble_dialogue" if inside else "floating_dialogue"
            action = "erase" if inside else "careful_erase"

        routed.append(ClassifiedText(
            box=box,
            expanded_box=expanded,
            text_type=route_state,
            bubble_idx=best_idx,
            overlap=best_overlap,
            semantic_type=region.semantic_class,
            route_state=route_state,
            action=action,
            raw_class_name=region.raw_class_name,
            confidence=region.confidence,
        ))

    return routed


def draw_step2_routing_debug(
    image: np.ndarray,
    routed: List[ClassifiedText],
) -> np.ndarray:
    """
    Step 2 debug drawing:
      - dialogue routes in Green
      - onomatopoeia in Red
    Raw bubble class is not drawn because it is dropped in semantic remap.
    """
    debug = image.copy()
    for ct in routed:
        if ct.semantic_type == "dialogue":
            color = (0, 255, 0)
        elif ct.semantic_type == "onomatopoeia":
            color = (0, 0, 255)
        else:
            continue

        b = ct.box
        cv2.rectangle(debug, (b.x1, b.y1), (b.x2, b.y2), color, 2)
        label = f"{ct.route_state} ({ct.raw_class_name}) {ct.confidence:.2f}"
        cv2.putText(
            debug, label, (b.x1, max(12, b.y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.42, color, 1, cv2.LINE_AA,
        )
    return debug


# ===================================================================
# STEP 4 — SELECTIVE INPAINTING WITH LaMa
# ===================================================================

def expand_boxes(boxes: List[Box], pad: int, img_w: int, img_h: int) -> List[Box]:
    return [b.expanded(pad, img_w, img_h) for b in boxes]


def erase_regions_selective(
    image: np.ndarray,
    classified: List[ClassifiedText],
    seg_mask: np.ndarray,
    bubble_masks: List[np.ndarray],
    lama_session,
    cfg: MLConfig,
) -> np.ndarray:
    """
    Only inpaint text regions classified as "bubble_text" using LaMa.
    Uses the pixel-level seg mask from comic-text-detector (not adaptive threshold).
    Floating text is left untouched (background art protected).
    """
    h, w = image.shape[:2]

    # Build the final inpainting mask:
    # seg_mask (text pixels) AND inside any bubble that contains bubble_text
    final_mask = np.zeros((h, w), dtype=np.uint8)

    for ct in classified:
        if ct.text_type != "bubble_text":
            continue  # SKIP floating text

        # Use the expanded box region
        b = ct.expanded_box
        # Extract seg mask within this expanded box
        roi_seg = seg_mask[b.y1:b.y2, b.x1:b.x2]
        # Place into final mask
        final_mask[b.y1:b.y2, b.x1:b.x2] = np.maximum(
            final_mask[b.y1:b.y2, b.x1:b.x2], roi_seg
        )

    # If nothing to inpaint, return original
    if np.count_nonzero(final_mask) == 0:
        return image.copy()

    # Run LaMa on the full image with the combined mask
    inpainted = lama_inpaint(lama_session, image, final_mask)

    # Only apply inpainted pixels where mask is active (keep rest untouched)
    result = image.copy()
    mask_bool = final_mask > 127
    result[mask_bool] = inpainted[mask_bool]

    return result


# ===================================================================
# STEP 5 — ENGLISH TEXT INSERTION
# ===================================================================

def insert_text(image, expanded_boxes, translations, cfg):
    result = image.copy()
    for box, text in zip(expanded_boxes, translations):
        if not text.strip():
            continue
        box_w, box_h = box.x2 - box.x1, box.y2 - box.y1
        if cfg.font_path:
            _insert_text_pillow(result, box, text, cfg)
        else:
            _insert_text_opencv(result, box, text, box_w, box_h, cfg)
    return result


def _insert_text_opencv(image, box, text, box_w, box_h, cfg):
    font_face = cv2.FONT_HERSHEY_SIMPLEX
    scale, min_scale = cfg.font_size_max / 20.0, cfg.font_size_min / 20.0
    while scale >= min_scale:
        thickness = max(1, int(scale))
        (cw, ch), _ = cv2.getTextSize("W", font_face, scale, thickness)
        if cw == 0:
            break
        lines = textwrap.wrap(text, width=max(1, box_w // cw))
        lh = int(ch * cfg.line_spacing)
        if lh * len(lines) <= box_h and all(
            cv2.getTextSize(ln, font_face, scale, thickness)[0][0] <= box_w for ln in lines
        ):
            break
        scale -= 0.05
    if scale < min_scale:
        scale = min_scale
        thickness = max(1, int(scale))
        (cw, ch), _ = cv2.getTextSize("W", font_face, scale, thickness)
        lines = textwrap.wrap(text, width=max(1, box_w // cw) if cw > 0 else 10)
        lh = int(ch * cfg.line_spacing)
    y = box.y1 + max(0, (box_h - lh * len(lines)) // 2) + ch
    for ln in lines:
        tw = cv2.getTextSize(ln, font_face, scale, thickness)[0][0]
        cv2.putText(image, ln, (box.x1 + max(0, (box_w - tw) // 2), y),
                    font_face, scale, cfg.font_color, thickness, cv2.LINE_AA)
        y += lh


def _insert_text_pillow(image, box, text, cfg):
    from PIL import Image, ImageDraw, ImageFont
    pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)
    bw, bh = box.x2 - box.x1, box.y2 - box.y1
    fs = cfg.font_size_max
    while fs >= cfg.font_size_min:
        font = ImageFont.truetype(cfg.font_path, fs)
        wrapped = _wrap_text_pillow(draw, text, font, bw)
        lh = int(fs * cfg.line_spacing)
        if lh * len(wrapped) <= bh and all(draw.textlength(l, font=font) <= bw for l in wrapped):
            break
        fs -= 1
    if fs < cfg.font_size_min:
        fs = cfg.font_size_min
        font = ImageFont.truetype(cfg.font_path, fs)
        wrapped = _wrap_text_pillow(draw, text, font, bw)
        lh = int(fs * cfg.line_spacing)
    ys = box.y1 + max(0, (bh - lh * len(wrapped)) // 2)
    rgb = (cfg.font_color[2], cfg.font_color[1], cfg.font_color[0])
    for i, l in enumerate(wrapped):
        tw = draw.textlength(l, font=font)
        draw.text((box.x1 + max(0, (bw - int(tw)) // 2), ys + i * lh), l, fill=rgb, font=font)
    np.copyto(image, cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR))


def _wrap_text_pillow(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [text]


# ===================================================================
# DEBUG VISUALISATION
# ===================================================================

def draw_debug_boxes(
    image: np.ndarray,
    classified: List[ClassifiedText],
    bubble_masks: List[np.ndarray],
    seg_mask: np.ndarray,
    cfg: MLConfig,
) -> np.ndarray:
    """
    Green boxes  = bubble text (will be erased)
    Red boxes    = floating text (skipped, art protected)
    Yellow boxes = expanded inpainting region (bubble text only)
    Cyan contours = detected speech bubble outlines
    Magenta overlay = seg mask (text pixels detected by Model A)
    """
    debug = image.copy()

    # Draw bubble contours (cyan)
    for bmask in bubble_masks:
        contours, _ = cv2.findContours(bmask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(debug, contours, -1, cfg.bubble_outline_color, 2)

    # Draw seg mask as semi-transparent magenta overlay
    seg_overlay = np.zeros_like(debug)
    seg_overlay[seg_mask > 127] = (255, 0, 255)  # magenta
    debug = cv2.addWeighted(debug, 1.0, seg_overlay, 0.3, 0)

    # Draw classified text boxes
    for ct in classified:
        if ct.text_type == "bubble_text":
            eb = ct.expanded_box
            cv2.rectangle(debug, (eb.x1, eb.y1), (eb.x2, eb.y2),
                          cfg.yellow_color, cfg.box_thickness)
            b = ct.box
            cv2.rectangle(debug, (b.x1, b.y1), (b.x2, b.y2),
                          cfg.green_color, cfg.box_thickness)
        else:
            b = ct.box
            cv2.rectangle(debug, (b.x1, b.y1), (b.x2, b.y2),
                          cfg.red_color, cfg.box_thickness)
            cv2.putText(debug, f"FLOAT {ct.overlap:.0%}", (b.x1, b.y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, cfg.red_color, 1, cv2.LINE_AA)

    return debug


def draw_semantic_class_debug(
    image: np.ndarray,
    semantic_result: SemanticDetectionResult,
) -> np.ndarray:
    """
    Draw semantic detector boxes + labels for visual Step-1 verification.
    """
    debug = image.copy()
    for region in semantic_result.regions:
        b = region.box
        color = (0, 255, 0) if region.semantic_class == "dialogue" else (0, 0, 255)
        cv2.rectangle(debug, (b.x1, b.y1), (b.x2, b.y2), color, 2)
        label = f"{region.semantic_class} ({region.raw_class_name}) {region.confidence:.2f}"
        cv2.putText(
            debug, label, (b.x1, max(12, b.y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA,
        )
    return debug


# ===================================================================
# FULL PIPELINE
# ===================================================================

def run_pipeline(
    image_path: str | Path,
    cfg: MLConfig,
    text_session=None,
    bubble_model=None,
    bubble_device: str = "cuda:0",
    lama_session=None,
) -> dict:
    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Cannot load image: {image_path}")
    h, w = image.shape[:2]

    # Step 1: Model A — detect text boxes + seg mask
    text_result = detect_text(text_session, image, cfg)
    text_boxes = text_result.boxes
    seg_mask = text_result.seg_mask
    seg_pixels = np.count_nonzero(seg_mask)
    print(f"  [Step 1] Model A: {len(text_boxes)} text regions, {seg_pixels} seg pixels")

    # Step 2: Model B — segment bubbles
    bubble_masks = detect_bubbles(bubble_model, bubble_device, image, cfg)
    print(f"  [Step 2] Model B: {len(bubble_masks)} speech bubbles")

    # Step 3: Intersection — classify each text box
    expanded_boxes = expand_boxes(text_boxes, cfg.mask_padding, w, h)
    classified = classify_text_regions(
        text_boxes, expanded_boxes, bubble_masks, cfg.bubble_overlap_threshold,
    )
    n_bubble = sum(1 for c in classified if c.text_type == "bubble_text")
    n_float = sum(1 for c in classified if c.text_type == "floating_text")
    print(f"  [Step 3] Intersection: {n_bubble} bubble text, {n_float} floating text")

    # Step 4: Selective LaMa inpainting (bubble text only, using seg mask)
    erased_image = erase_regions_selective(
        image, classified, seg_mask, bubble_masks, lama_session, cfg,
    )
    print(f"  [Step 4] LaMa inpainted {n_bubble} bubble regions (skipped {n_float} floating)")

    # Debug image
    debug_image = draw_debug_boxes(image, classified, bubble_masks, seg_mask, cfg)

    return {
        "classified": classified,
        "bubble_masks": bubble_masks,
        "seg_mask": seg_mask,
        "erased_image": erased_image,
        "debug_image": debug_image,
        "bubble_text": [c for c in classified if c.text_type == "bubble_text"],
        "floating_text": [c for c in classified if c.text_type == "floating_text"],
    }


# ===================================================================
# BATCH RUNNER
# ===================================================================

SAMPLE_MAP = {
    "sample1": "sample.png",
    "sample2": "sample 2.jpeg",
    "sample3": "sample 3.jpg",
    "sample4": "sample 4.png",
    "sample5": "sample 5.jpg",
    "sample6": "sample 6.jpg",
}


def run_all_samples(
    cfg: MLConfig,
    samples_dir: Path,
    run_name: str,
    text_session,
    bubble_model,
    bubble_device: str,
    lama_session,
):
    for sample_name, img_file in SAMPLE_MAP.items():
        img_path = samples_dir / sample_name / img_file
        if not img_path.exists():
            print(f"[SKIP] {img_path} not found")
            continue

        out_dir = samples_dir / sample_name / run_name
        out_dir.mkdir(exist_ok=True)

        print(f"\n{'='*60}")
        print(f"Processing {sample_name}: {img_file}")
        print(f"{'='*60}")

        result = run_pipeline(
            img_path, cfg,
            text_session=text_session,
            bubble_model=bubble_model,
            bubble_device=bubble_device,
            lama_session=lama_session,
        )

        cv2.imwrite(str(out_dir / "debug_dual_model.png"), result["debug_image"])
        cv2.imwrite(str(out_dir / "erased_inpainted.png"), result["erased_image"])
        cv2.imwrite(str(out_dir / "seg_mask.png"), result["seg_mask"])

        report = {
            "sample": sample_name,
            "image": img_file,
            "text_conf": cfg.confidence_threshold,
            "bubble_conf": cfg.bubble_confidence,
            "overlap_threshold": cfg.bubble_overlap_threshold,
            "padding": cfg.mask_padding,
            "inpainter": "LaMa",
            "num_text": len(result["classified"]),
            "num_bubble_text": len(result["bubble_text"]),
            "num_floating_text": len(result["floating_text"]),
            "num_bubbles": len(result["bubble_masks"]),
            "bubble_text": [
                {"box": c.box.to_dict(), "overlap": round(c.overlap, 3), "bubble_idx": c.bubble_idx}
                for c in result["bubble_text"]
            ],
            "floating_text": [
                {"box": c.box.to_dict(), "overlap": round(c.overlap, 3)}
                for c in result["floating_text"]
            ],
        }
        (out_dir / "report.json").write_text(json.dumps(report, indent=2))
        print(f"  Saved to {out_dir}/")


def run_semantic_test_all_samples(
    cfg: MLConfig,
    samples_dir: Path,
    semantic_handle: SemanticModelHandle,
):
    """
    Step-1 verification utility.
    Runs semantic model on all known samples and saves:
      samples/<sampleN>/semantic_test/debug_classes.png
      samples/<sampleN>/semantic_test/report.json
    """
    for sample_name, img_file in SAMPLE_MAP.items():
        img_path = samples_dir / sample_name / img_file
        if not img_path.exists():
            print(f"[SKIP] {img_path} not found")
            continue

        image = cv2.imread(str(img_path))
        if image is None:
            print(f"[SKIP] cannot load {img_path}")
            continue

        semantic_result = detect_semantic_text_regions(semantic_handle, image, cfg)
        debug_img = draw_semantic_class_debug(image, semantic_result)

        out_dir = samples_dir / sample_name / "semantic_test"
        out_dir.mkdir(parents=True, exist_ok=True)

        cv2.imwrite(str(out_dir / "debug_classes.png"), debug_img)
        report = {
            "sample": sample_name,
            "image": img_file,
            "semantic_model": cfg.semantic_model_path,
            "num_semantic_detections": len(semantic_result.regions),
            "regions": [
                {
                    "box": r.box.to_dict(),
                    "class_id": r.class_id,
                    "raw_class_name": r.raw_class_name,
                    "semantic_class": r.semantic_class,
                    "action": r.action,
                    "confidence": round(r.confidence, 4),
                }
                for r in semantic_result.regions
            ],
        }
        (out_dir / "report.json").write_text(json.dumps(report, indent=2))
        print(f"[Semantic Test] {sample_name}: {len(semantic_result.regions)} detections -> {out_dir}")


def run_step2_routing_test(
    cfg: MLConfig,
    image_path: Path,
    semantic_handle: SemanticModelHandle,
    bubble_model,
    bubble_device: str,
):
    """
    Step 2 visual test:
      1) Run Model A semantic detection with class remap (bubble class dropped)
      2) Use Model B bubble geometry to assign route states
      3) Draw only dialogue (green) and onomatopoeia (red)
    """
    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Cannot load step2 test image: {image_path}")

    h, w = image.shape[:2]
    semantic_result = detect_semantic_text_regions(semantic_handle, image, cfg)
    bubble_masks = detect_bubbles(bubble_model, bubble_device, image, cfg)
    routed = build_step2_routing_state(semantic_result, bubble_masks, cfg, w, h)

    debug = draw_step2_routing_debug(image, routed)

    out_dir = image_path.parent / "semantic_test"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_img = out_dir / "debug_step2_routing.png"
    cv2.imwrite(str(out_img), debug)

    report = {
        "image": str(image_path),
        "semantic_model": cfg.semantic_model_path,
        "num_semantic_regions_after_remap": len(semantic_result.regions),
        "num_bubbles_model_b": len(bubble_masks),
        "route_counts": {
            "bubble_dialogue": sum(1 for r in routed if r.route_state == "bubble_dialogue"),
            "floating_dialogue": sum(1 for r in routed if r.route_state == "floating_dialogue"),
            "onomatopoeia": sum(1 for r in routed if r.route_state == "onomatopoeia"),
        },
        "regions": [
            {
                "box": r.box.to_dict(),
                "raw_class_name": r.raw_class_name,
                "semantic_type": r.semantic_type,
                "route_state": r.route_state,
                "action": r.action,
                "confidence": round(r.confidence, 4),
                "bubble_idx": r.bubble_idx,
                "overlap": round(r.overlap, 4),
            }
            for r in routed
        ],
    }
    (out_dir / "report_step2.json").write_text(json.dumps(report, indent=2))

    print(f"[Step2 Test] semantic_regions(after remap): {len(semantic_result.regions)}")
    print(f"[Step2 Test] bubbles: {len(bubble_masks)}")
    print(f"[Step2 Test] saved: {out_img}")


# ===================================================================
# CLI
# ===================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Dual-model manga text detection pipeline")
    parser.add_argument("--image", type=Path, default=None)
    parser.add_argument("--all-samples", action="store_true")
    parser.add_argument("--samples-dir", type=Path, default=Path("samples"))
    parser.add_argument("--run-name", type=str, default="lama_run_1")
    parser.add_argument("--text-model", type=str, default="models/comictextdetector.pt.onnx")
    parser.add_argument("--bubble-model", type=str, default="models/manga109_bubble/best.pt")
    parser.add_argument("--lama-model", type=str, default="models/lama/lama_fp32.onnx")
    parser.add_argument("--semantic-model", type=str,
                        default="models/semantic/comic-text-and-bubble-detector.onnx")
    parser.add_argument("--conf", type=float, default=0.35)
    parser.add_argument("--bubble-conf", type=float, default=0.50)
    parser.add_argument("--overlap", type=float, default=0.50)
    parser.add_argument("--padding", type=int, default=8)
    parser.add_argument("--semantic-test", action="store_true",
                        help="Run Step-1 semantic detector test on one image and save labeled output.")
    parser.add_argument("--semantic-test-all", action="store_true",
                        help="Run Step-1 semantic detector test on all known samples.")
    parser.add_argument("--step2-routing-test", action="store_true",
                        help="Run Step-2 class-remap + routing-state visual test.")
    parser.add_argument("--semantic-test-image", type=Path,
                        default=Path("samples/sample4/sample4.jpg"))
    parser.add_argument("--allow-cpu", action="store_true")
    args = parser.parse_args()

    cfg = MLConfig(
        text_model_path=args.text_model,
        semantic_model_path=args.semantic_model,
        bubble_model_path=args.bubble_model,
        lama_model_path=args.lama_model,
        confidence_threshold=args.conf,
        bubble_confidence=args.bubble_conf,
        bubble_overlap_threshold=args.overlap,
        mask_padding=args.padding,
    )

    # Step-1 verification mode: semantic detector only (single image)
    if args.semantic_test:
        test_image_path = args.semantic_test_image

        # Helpful fallback for this repo's known sample4 filenames.
        if not test_image_path.exists() and str(args.semantic_test_image).replace("\\", "/") == "samples/sample4/sample4.jpg":
            candidates = [
                Path("samples/sample4/sample4.jpg"),
                Path("samples/sample4/sample 4 i want.jpg"),
                Path("samples/sample4/sample 4.png"),
            ]
            for c in candidates:
                if c.exists():
                    test_image_path = c
                    break

        image = cv2.imread(str(test_image_path))
        if image is None:
            raise FileNotFoundError(
                f"Cannot load semantic test image: {test_image_path}\n"
                f"Try: samples/sample4/sample4.jpg or samples/sample4/sample 4.png"
            )

        semantic_handle = load_semantic_model(cfg.semantic_model_path, allow_cpu=args.allow_cpu)
        semantic_result = detect_semantic_text_regions(semantic_handle, image, cfg)
        debug_img = draw_semantic_class_debug(image, semantic_result)

        out_dir = test_image_path.parent / "semantic_test"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "debug_classes.png"

        cv2.imwrite(str(out_path), debug_img)
        print(f"[Semantic Test] detections: {len(semantic_result.regions)}")
        print(f"[Semantic Test] image: {test_image_path}")
        print(f"[Semantic Test] saved: {out_path}")
        return

    # Step-1 verification mode: semantic detector only (all samples)
    if args.semantic_test_all:
        semantic_handle = load_semantic_model(cfg.semantic_model_path, allow_cpu=args.allow_cpu)
        run_semantic_test_all_samples(cfg, args.samples_dir, semantic_handle)
        return

    # Step-2 verification mode: class remap + routing state debug
    if args.step2_routing_test:
        test_image_path = args.semantic_test_image
        if not test_image_path.exists() and str(args.semantic_test_image).replace("\\", "/") == "samples/sample4/sample4.jpg":
            candidates = [
                Path("samples/sample4/sample4.jpg"),
                Path("samples/sample4/sample 4 i want.jpg"),
                Path("samples/sample4/sample 4.png"),
            ]
            for c in candidates:
                if c.exists():
                    test_image_path = c
                    break

        semantic_handle = load_semantic_model(cfg.semantic_model_path, allow_cpu=args.allow_cpu)
        bubble_model, bubble_device = load_bubble_model(cfg.bubble_model_path, allow_cpu=args.allow_cpu)
        run_step2_routing_test(cfg, test_image_path, semantic_handle, bubble_model, bubble_device)
        return

    print("Loading models...")
    text_session = load_text_model(cfg.text_model_path, allow_cpu=args.allow_cpu)
    bubble_model, bubble_device = load_bubble_model(cfg.bubble_model_path, allow_cpu=args.allow_cpu)
    lama_session = load_lama_model(cfg.lama_model_path, allow_cpu=args.allow_cpu)

    if args.all_samples:
        run_all_samples(cfg, args.samples_dir, args.run_name,
                        text_session, bubble_model, bubble_device, lama_session)
    elif args.image:
        result = run_pipeline(args.image, cfg, text_session, bubble_model,
                              bubble_device, lama_session)
        stem = args.image.stem
        cv2.imwrite(f"{stem}_debug_dual.png", result["debug_image"])
        cv2.imwrite(f"{stem}_erased.png", result["erased_image"])
        n_b = len(result["bubble_text"])
        n_f = len(result["floating_text"])
        print(f"Saved. Bubble text: {n_b}, Floating text: {n_f}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
