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
from typing import List, Optional, Tuple

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
    text_type: str       # "bubble_text" or "floating_text"
    bubble_idx: int      # index of matched bubble, or -1
    overlap: float       # overlap ratio with best bubble


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
    parser.add_argument("--conf", type=float, default=0.35)
    parser.add_argument("--bubble-conf", type=float, default=0.50)
    parser.add_argument("--overlap", type=float, default=0.50)
    parser.add_argument("--padding", type=int, default=8)
    parser.add_argument("--allow-cpu", action="store_true")
    args = parser.parse_args()

    cfg = MLConfig(
        text_model_path=args.text_model,
        bubble_model_path=args.bubble_model,
        lama_model_path=args.lama_model,
        confidence_threshold=args.conf,
        bubble_confidence=args.bubble_conf,
        bubble_overlap_threshold=args.overlap,
        mask_padding=args.padding,
    )

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
