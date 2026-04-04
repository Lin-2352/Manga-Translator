"""
ml_region_lib.py  —  ML-based manga text detection & replacement pipeline.

Uses the comic-text-detector ONNX model (comictextdetector.pt.onnx) with
STRICT GPU-only acceleration via onnxruntime CUDAExecutionProvider.

Workflow:
  Step 1 (Green Box):  ONNX model detects Japanese text bounding boxes.
  Step 2 (Yellow Box): Boxes expanded by configurable padding, then smart
                        Telea inpainting erases ONLY the text strokes while
                        preserving background art (screentones, lines, etc).
  Step 3 (English):    Translated text rendered inside yellow box with a
                        font-shrink loop to guarantee containment.
"""

from __future__ import annotations

import json
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Box
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Box:
    """Axis-aligned bounding box: (x1, y1) top-left, (x2, y2) bottom-right."""
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
    model_path: str = "models/comictextdetector.pt.onnx"
    confidence_threshold: float = 0.35
    nms_iou_threshold: float = 0.45
    input_size: int = 1024

    # Step 2: smart inpainting
    mask_padding: int = 8
    adaptive_block_size: int = 15       # adaptive threshold block size (must be odd)
    adaptive_c: int = 4                 # adaptive threshold constant
    dilate_kernel_size: int = 3         # kernel to thicken text stroke mask
    dilate_iterations: int = 1          # number of dilation passes
    inpaint_radius: int = 3             # cv2.inpaint neighbourhood radius
    use_white_fallback: bool = False    # True = old blunt white rect (for comparison)

    # Step 3: English text
    font_path: Optional[str] = None
    font_size_max: int = 28
    font_size_min: int = 8
    font_color: Tuple[int, int, int] = (0, 0, 0)
    line_spacing: float = 1.3

    # Debug colours (BGR)
    green_color: Tuple[int, int, int] = (0, 255, 0)
    yellow_color: Tuple[int, int, int] = (0, 255, 255)
    box_thickness: int = 2


# ===================================================================
# MODEL LOADING  (STRICT GPU-ONLY — no CPU fallback)
# ===================================================================

def load_model(model_path: str, allow_cpu: bool = False):
    """
    Load ONNX model with STRICT CUDA-only execution.

    If CUDA is unavailable, the script crashes immediately rather than
    silently falling back to CPU (which causes massive CPU spikes).

    Set allow_cpu=True only for development/testing on machines without GPU.
    """
    import onnxruntime as ort

    if allow_cpu:
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        session = ort.InferenceSession(model_path, providers=providers)
        active = session.get_providers()
        if 'CUDAExecutionProvider' in active:
            print("[GPU] Running on CUDA (RTX 4060)")
        else:
            print("[CPU] WARNING: Running on CPU (allow_cpu=True)")
        return session

    # STRICT GPU-ONLY: crash if CUDA is not available
    try:
        session = ort.InferenceSession(
            model_path,
            providers=['CUDAExecutionProvider'],
        )
    except Exception as e:
        raise RuntimeError(
            f"CUDA GPU REQUIRED but unavailable.\n"
            f"Underlying error: {e}\n"
            f"\n"
            f"Fix: Ensure these DLLs are in your system PATH:\n"
            f"  - cublasLt64_12.dll  (from CUDA 12.x toolkit)\n"
            f"  - cudnn*.dll         (from cuDNN 9.x)\n"
            f"\n"
            f"Typical path: C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.x\\bin\n"
            f"\n"
            f"To temporarily allow CPU: load_model(path, allow_cpu=True)"
        ) from e

    print("[GPU] LOCKED to CUDA (RTX 4060) — CPU fallback disabled")
    return session


# ===================================================================
# STEP 1 — ML DETECTION  (The Green Box)
# ===================================================================

def _preprocess(image: np.ndarray, input_size: int) -> np.ndarray:
    """Resize to input_size x input_size, normalize, convert to NCHW float32."""
    resized = cv2.resize(image, (input_size, input_size))
    blob = resized.astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))   # HWC → CHW
    blob = np.expand_dims(blob, axis=0)     # add batch dim
    return blob


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float) -> List[int]:
    """
    Non-Maximum Suppression on [N, 4] boxes (x1, y1, x2, y2) and [N] scores.
    Returns indices of kept boxes.
    """
    if len(boxes) == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
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

        remaining = np.where(iou <= iou_thresh)[0]
        order = order[remaining + 1]

    return keep


def detect_text(
    session,
    image: np.ndarray,
    cfg: MLConfig,
) -> List[Box]:
    """
    Run comic-text-detector inference.

    The model outputs:
      blk [1, 64512, 7]: YOLO-style [cx, cy, w, h, objectness, class0, class1]
                          in input_size pixel coordinates.
      seg [1, 1, 1024, 1024]: text segmentation mask (unused here).
      det [1, 2, 1024, 1024]: text line heatmaps (unused here).

    We decode blk → filter by confidence → NMS → scale to original image.
    """
    h_orig, w_orig = image.shape[:2]
    scale_x = w_orig / cfg.input_size
    scale_y = h_orig / cfg.input_size

    blob = _preprocess(image, cfg.input_size)
    outputs = session.run(None, {"images": blob})
    blk = outputs[0]  # [1, 64512, 7]

    # Drop batch dim
    preds = blk[0]  # [64512, 7]

    # Filter by objectness confidence
    obj_scores = preds[:, 4]
    mask = obj_scores > cfg.confidence_threshold
    preds = preds[mask]
    obj_scores = obj_scores[mask]

    if len(preds) == 0:
        return []

    # Convert center-format → corner-format (in model input coords)
    cx, cy, w, h = preds[:, 0], preds[:, 1], preds[:, 2], preds[:, 3]
    x1 = cx - w / 2
    y1 = cy - h / 2
    x2 = cx + w / 2
    y2 = cy + h / 2
    corners = np.stack([x1, y1, x2, y2], axis=1)

    # NMS
    keep = _nms(corners, obj_scores, cfg.nms_iou_threshold)
    corners = corners[keep]

    # Scale to original image dimensions and clamp
    boxes: List[Box] = []
    for det in corners:
        bx1 = int(max(0, det[0] * scale_x))
        by1 = int(max(0, det[1] * scale_y))
        bx2 = int(min(w_orig, det[2] * scale_x))
        by2 = int(min(h_orig, det[3] * scale_y))
        if bx2 > bx1 and by2 > by1:
            boxes.append(Box(x1=bx1, y1=by1, x2=bx2, y2=by2))

    return boxes


# ===================================================================
# STEP 2 — SMART TEXT INPAINTING  (The Yellow Box)
# ===================================================================

def expand_boxes(boxes: List[Box], pad: int, img_w: int, img_h: int) -> List[Box]:
    return [b.expanded(pad, img_w, img_h) for b in boxes]


def _build_text_mask_for_roi(roi_gray: np.ndarray, cfg: MLConfig) -> np.ndarray:
    """
    Build a binary mask of text strokes within an ROI using adaptive thresholding.

    Pipeline:
      1. Adaptive threshold isolates dark text strokes against lighter background.
      2. Dilation thickens the mask to cover anti-aliased edges.

    Returns a uint8 mask: 255 = text pixel, 0 = background.
    """
    # Adaptive threshold: dark text strokes become white (255) in the output
    thresh = cv2.adaptiveThreshold(
        roi_gray,
        maxValue=255,
        adaptiveMethod=cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        thresholdType=cv2.THRESH_BINARY_INV,  # invert: dark strokes → 255
        blockSize=cfg.adaptive_block_size,
        C=cfg.adaptive_c,
    )

    # Dilate to thicken and cover anti-aliased edges
    kernel = np.ones(
        (cfg.dilate_kernel_size, cfg.dilate_kernel_size), dtype=np.uint8
    )
    mask = cv2.dilate(thresh, kernel, iterations=cfg.dilate_iterations)

    return mask


def erase_regions(image: np.ndarray, expanded_boxes: List[Box], cfg: MLConfig) -> np.ndarray:
    """
    Smart text erasure using Telea inpainting.

    For each expanded box:
      1. Extract ROI from the original image.
      2. Build a binary mask of ONLY the text strokes (adaptive threshold + dilate).
      3. cv2.inpaint reconstructs the background art where text was.
      4. Paste the inpainted ROI back.

    Falls back to blunt white rectangles if cfg.use_white_fallback is True.
    """
    erased = image.copy()

    if cfg.use_white_fallback:
        for b in expanded_boxes:
            cv2.rectangle(erased, (b.x1, b.y1), (b.x2, b.y2),
                          (255, 255, 255), thickness=-1)
        return erased

    for b in expanded_boxes:
        # Extract ROI
        roi = erased[b.y1:b.y2, b.x1:b.x2]
        if roi.size == 0:
            continue

        roi_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

        # Build text stroke mask
        text_mask = _build_text_mask_for_roi(roi_gray, cfg)

        # Inpaint: Telea algorithm reconstructs background through the mask
        inpainted = cv2.inpaint(
            roi, text_mask,
            inpaintRadius=cfg.inpaint_radius,
            flags=cv2.INPAINT_TELEA,
        )

        # Paste back
        erased[b.y1:b.y2, b.x1:b.x2] = inpainted

    return erased


# ===================================================================
# STEP 3 — ENGLISH TEXT INSERTION
# ===================================================================

def insert_text(
    image: np.ndarray,
    expanded_boxes: List[Box],
    translations: List[str],
    cfg: MLConfig,
) -> np.ndarray:
    result = image.copy()
    for box, text in zip(expanded_boxes, translations):
        if not text.strip():
            continue
        box_w = box.x2 - box.x1
        box_h = box.y2 - box.y1
        if cfg.font_path:
            _insert_text_pillow(result, box, text, cfg)
        else:
            _insert_text_opencv(result, box, text, box_w, box_h, cfg)
    return result


def _insert_text_opencv(image, box, text, box_w, box_h, cfg):
    font_face = cv2.FONT_HERSHEY_SIMPLEX
    scale = cfg.font_size_max / 20.0
    min_scale = cfg.font_size_min / 20.0

    while scale >= min_scale:
        thickness = max(1, int(scale))
        (char_w, char_h), _ = cv2.getTextSize("W", font_face, scale, thickness)
        if char_w == 0:
            break
        max_chars = max(1, box_w // char_w)
        lines = textwrap.wrap(text, width=max_chars)
        line_h = int(char_h * cfg.line_spacing)
        total_h = line_h * len(lines)
        if total_h <= box_h and all(
            cv2.getTextSize(ln, font_face, scale, thickness)[0][0] <= box_w
            for ln in lines
        ):
            break
        scale -= 0.05

    if scale < min_scale:
        scale = min_scale
        thickness = max(1, int(scale))
        (char_w, char_h), _ = cv2.getTextSize("W", font_face, scale, thickness)
        max_chars = max(1, box_w // char_w) if char_w > 0 else 10
        lines = textwrap.wrap(text, width=max_chars)
        line_h = int(char_h * cfg.line_spacing)
        total_h = line_h * len(lines)

    y_off = box.y1 + max(0, (box_h - total_h) // 2) + char_h
    for ln in lines:
        (tw, _), _ = cv2.getTextSize(ln, font_face, scale, thickness)
        x_off = box.x1 + max(0, (box_w - tw) // 2)
        cv2.putText(image, ln, (x_off, y_off), font_face, scale,
                    cfg.font_color, thickness, cv2.LINE_AA)
        y_off += line_h


def _insert_text_pillow(image, box, text, cfg):
    from PIL import Image, ImageDraw, ImageFont

    pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)
    box_w, box_h = box.x2 - box.x1, box.y2 - box.y1
    font_size = cfg.font_size_max

    while font_size >= cfg.font_size_min:
        font = ImageFont.truetype(cfg.font_path, font_size)
        wrapped = _wrap_text_pillow(draw, text, font, box_w)
        line_h = int(font_size * cfg.line_spacing)
        total_h = line_h * len(wrapped)
        if total_h <= box_h and all(draw.textlength(ln, font=font) <= box_w for ln in wrapped):
            break
        font_size -= 1

    if font_size < cfg.font_size_min:
        font_size = cfg.font_size_min
        font = ImageFont.truetype(cfg.font_path, font_size)
        wrapped = _wrap_text_pillow(draw, text, font, box_w)
        line_h = int(font_size * cfg.line_spacing)
        total_h = line_h * len(wrapped)

    y_start = box.y1 + max(0, (box_h - total_h) // 2)
    rgb = (cfg.font_color[2], cfg.font_color[1], cfg.font_color[0])
    for i, ln in enumerate(wrapped):
        tw = draw.textlength(ln, font=font)
        x = box.x1 + max(0, (box_w - int(tw)) // 2)
        draw.text((x, y_start + i * line_h), ln, fill=rgb, font=font)

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
    ml_boxes: List[Box],
    expanded_boxes: List[Box],
    cfg: MLConfig,
) -> np.ndarray:
    debug_img = image.copy()
    for b in expanded_boxes:
        cv2.rectangle(debug_img, (b.x1, b.y1), (b.x2, b.y2),
                      cfg.yellow_color, cfg.box_thickness)
    for b in ml_boxes:
        cv2.rectangle(debug_img, (b.x1, b.y1), (b.x2, b.y2),
                      cfg.green_color, cfg.box_thickness)
    return debug_img


# ===================================================================
# FULL PIPELINE
# ===================================================================

def run_pipeline(
    image_path: str | Path,
    cfg: MLConfig,
    session=None,
    translations: Optional[List[str]] = None,
) -> dict:
    if session is None:
        session = load_model(cfg.model_path)

    image = cv2.imread(str(image_path))
    if image is None:
        raise FileNotFoundError(f"Cannot load image: {image_path}")

    h, w = image.shape[:2]

    # Step 1: ML Detection (Green Boxes)
    ml_boxes = detect_text(session, image, cfg)
    print(f"  [Step 1] Detected {len(ml_boxes)} text regions")

    # Step 2: Expand + Smart Inpaint (Yellow Boxes)
    expanded_boxes = expand_boxes(ml_boxes, cfg.mask_padding, w, h)
    erased_image = erase_regions(image, expanded_boxes, cfg)
    mode = "white-rect" if cfg.use_white_fallback else "Telea-inpaint"
    print(f"  [Step 2] Expanded by {cfg.mask_padding}px, {mode} on {len(expanded_boxes)} regions")

    # Debug image
    debug_image = draw_debug_boxes(image, ml_boxes, expanded_boxes, cfg)

    result = {
        "ml_boxes": ml_boxes,
        "expanded_boxes": expanded_boxes,
        "erased_image": erased_image,
        "debug_image": debug_image,
    }

    # Step 3: English Insertion (optional)
    if translations is not None:
        n = min(len(translations), len(expanded_boxes))
        final_image = insert_text(erased_image, expanded_boxes[:n], translations[:n], cfg)
        result["final_image"] = final_image
        print(f"  [Step 3] Inserted {n} English translations")

    return result


# ===================================================================
# BATCH RUNNER — All samples
# ===================================================================

def run_all_samples(cfg: MLConfig, samples_dir: Path, run_name: str = "claude_gpu_run_1", session=None):
    """Run pipeline on all sample directories, save outputs to isolated run folders."""
    if session is None:
        session = load_model(cfg.model_path)

    sample_map = {
        "sample1": "sample.png",
        "sample2": "sample 2.jpeg",
        "sample3": "sample 3.jpg",
        "sample4": "sample 4.png",
        "sample5": "sample 5.jpg",
        "sample6": "sample 6.jpg",
    }

    for sample_name, img_file in sample_map.items():
        sample_dir = samples_dir / sample_name
        img_path = sample_dir / img_file
        if not img_path.exists():
            print(f"[SKIP] {img_path} not found")
            continue

        out_dir = sample_dir / run_name
        out_dir.mkdir(exist_ok=True)

        print(f"\n{'='*60}")
        print(f"Processing {sample_name}: {img_file}")
        print(f"{'='*60}")

        result = run_pipeline(img_path, cfg, session=session)

        # Save outputs
        cv2.imwrite(str(out_dir / "debug_green_yellow.png"), result["debug_image"])
        cv2.imwrite(str(out_dir / "erased_inpainted.png"), result["erased_image"])

        # Save report
        report = {
            "sample": sample_name,
            "image": img_file,
            "confidence": cfg.confidence_threshold,
            "nms_iou": cfg.nms_iou_threshold,
            "padding": cfg.mask_padding,
            "num_detections": len(result["ml_boxes"]),
            "detections": [b.to_dict() for b in result["ml_boxes"]],
            "expanded": [b.to_dict() for b in result["expanded_boxes"]],
        }
        (out_dir / "report.json").write_text(json.dumps(report, indent=2))

        print(f"  Saved to {out_dir}/")


# ===================================================================
# CLI
# ===================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="ML manga text detection pipeline")
    parser.add_argument("--image", type=Path, default=None,
                        help="Single image to process")
    parser.add_argument("--all-samples", action="store_true",
                        help="Run on all samples 1-6")
    parser.add_argument("--samples-dir", type=Path, default=Path("samples"),
                        help="Samples directory")
    parser.add_argument("--run-name", type=str, default="claude_gpu_run_1",
                        help="Output subfolder name")
    parser.add_argument("--model", type=str, default="models/comictextdetector.pt.onnx")
    parser.add_argument("--conf", type=float, default=0.35)
    parser.add_argument("--nms-iou", type=float, default=0.45)
    parser.add_argument("--padding", type=int, default=8)
    parser.add_argument("--allow-cpu", action="store_true",
                        help="Allow CPU fallback (default: GPU-only, crash if no CUDA)")
    parser.add_argument("--white-fallback", action="store_true",
                        help="Use old blunt white rectangles instead of inpainting")
    parser.add_argument("--dilate-kernel", type=int, default=3,
                        help="Dilation kernel size for text mask (odd number)")
    parser.add_argument("--inpaint-radius", type=int, default=3,
                        help="cv2.inpaint neighbourhood radius")
    args = parser.parse_args()

    cfg = MLConfig(
        model_path=args.model,
        confidence_threshold=args.conf,
        nms_iou_threshold=args.nms_iou,
        mask_padding=args.padding,
        dilate_kernel_size=args.dilate_kernel,
        inpaint_radius=args.inpaint_radius,
        use_white_fallback=args.white_fallback,
    )

    # Load model with GPU enforcement
    session = load_model(cfg.model_path, allow_cpu=args.allow_cpu)

    if args.all_samples:
        run_all_samples(cfg, args.samples_dir, args.run_name, session=session)
    elif args.image:
        result = run_pipeline(args.image, cfg, session=session)
        stem = args.image.stem
        cv2.imwrite(f"{stem}_ml_debug.png", result["debug_image"])
        cv2.imwrite(f"{stem}_ml_erased.png", result["erased_image"])
        print(f"Saved {stem}_ml_debug.png and {stem}_ml_erased.png")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
