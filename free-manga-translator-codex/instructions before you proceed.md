# Instructions Before You Proceed
## Free Manga Translator — ML-Based Text Detection Pipeline

> **CRITICAL:** Read this document in full before touching any code. It contains the full
> context, current state, methodology, and iteration protocol. Guessing is forbidden.

---

## 1. Project Context & Final Goal

### The Chrome Extension
This project is a free Chrome extension (`free-manga-translator/`) that translates Japanese/
Chinese/Korean manga to English by sending page images to Google Gemini (or fallback providers)
and overlaying translated text via canvas rendering.

### The Python Subsystem (your active work area)
Inside `free-manga-translator-codex/` lives a **deep learning inference pipeline** that
solves the core geometric problem: given a raw manga image, use a pre-trained ML model to
find every Japanese text region and compute the eraser mask + English text placement rectangle.

**The ultimate goal in one sentence:**
> The ML model detects tight Green Boxes around Japanese text, an 8px-expanded Yellow Box
> defines the inpainting region, and OpenCV Telea inpainting removes ONLY the text strokes
> while reconstructing the background art (screentones, lines, shading) seamlessly.

Visualised:
```
┌──────────────────────────────┐   ← black speech bubble border
│                              │
│   ┌──────────────┐           │   ← Yellow Box  (inpainting region, +8px padding)
│   │  ┌────────┐  │           │
│   │  │ GREEN  │  │           │   ← Green Box   (ML-detected Japanese text bounds)
│   │  └────────┘  │           │
│   └──────────────┘           │
└──────────────────────────────┘
```

Yellow must:
- Completely contain the Green Box (no Japanese pixel left exposed).
- Expand exactly 8 pixels in all directions from the Green Box.
- Be clamped to image boundaries.
- Smart inpainting removes only text strokes; background art is reconstructed, not destroyed.

---

## 2. Architecture Pivot: Rule-Based CV → Deep Learning (2026-04-05)

### What Changed

The project has **permanently migrated** from rule-based OpenCV computer vision to deep learning
object detection. The old approach (threshold → morphology → contour → connected-component →
grow/trim) hit a mathematical ceiling — screentones, broken bubbles, and irregular artwork
defeated every combination of `cv2.findContours`, adaptive thresholds, and dilation kernels.

### What Was Deleted (Phase 0 Cleanup)

All legacy rule-based scripts were permanently deleted on 2026-04-05:

```
DELETED:
├── debug_region_lib.py          ← old core CV library (1300+ lines of threshold/contour logic)
├── debug_detect_sample.py       ← old single-image runner
├── debug_detect_text_regions.py ← early prototype
├── debug_expand_boxes.py        ← early prototype
├── debug_refine_boxes.py        ← early prototype
├── debug_target_benchmark.py    ← old tuning helper
├── debug_retest_all_samples.py  ← old batch runner
├── debug_claude_run.py          ← old output organization script
├── __pycache__/                 ← compiled bytecode
├── samples/**/sample_*_debug_*.json    ← all legacy JSON reports
├── samples/**/sample_*_debug_*.png     ← all legacy debug images
├── samples/claude_run_summary_claude.json
└── samples/sample_retest_summary_final.json
```

### What Remains

```
free-manga-translator-codex/
├── ml_region_lib.py                    ← NEW CORE PIPELINE (ML detection + masking)
├── models/
│   └── comictextdetector.pt.onnx       ← Pre-trained ONNX model (comic-text-detector)
├── YOLO_TRAINING_GUIDE.md              ← Instructions for fine-tuning YOLOv8
├── instructions before you proceed.md  ← THIS FILE
├── samples/
│   ├── sample1/sample.png              ← source image
│   ├── sample2/sample 2.jpeg + sample 2 i want.jpg
│   ├── sample3/sample 3.jpg + sample 3 i want.jpg
│   ├── sample4/sample 4.png + sample 4 i want.jpg
│   ├── sample5/sample 5.jpg + sample 5 i want.jpg
│   ├── sample6/sample 6.jpg + sample 6 i want.png
│   └── sampleN/claude_gpu_run_1/       ← ML pipeline output folders
├── .env, config.json, manifest.json    ← extension config
├── background.js, content.js, popup.* , translationPanel.js  ← extension source
└── .venv/                              ← Python virtual environment
```

---

## 3. The New ML Pipeline: `ml_region_lib.py`

### Model: comic-text-detector (ONNX)

- **File:** `models/comictextdetector.pt.onnx`
- **Input:** `[1, 3, 1024, 1024]` — RGB image normalized to [0, 1], resized to 1024×1024
- **Outputs:**
  - `blk [1, 64512, 7]` — YOLO-style detections: `[cx, cy, w, h, objectness, class0, class1]`
  - `seg [1, 1, 1024, 1024]` — text segmentation mask (currently unused)
  - `det [1, 2, 1024, 1024]` — text line heatmaps (currently unused)

### GPU Acceleration (STRICT — No CPU Fallback)

The pipeline is **locked to CUDAExecutionProvider only**. If CUDA is unavailable, the script
crashes immediately with a diagnostic error rather than silently falling back to CPU:

```python
# DEFAULT: GPU-only, crash if CUDA missing
session = ort.InferenceSession(model_path, providers=['CUDAExecutionProvider'])

# DEVELOPMENT ONLY: allow CPU fallback
session = load_model(model_path, allow_cpu=True)
```

**CUDA requirements:** cuDNN 9.x + CUDA 12.x DLLs must be in PATH.
Required DLL: `cublasLt64_12.dll` (from CUDA toolkit `bin/` directory).
Typical path: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.x\bin`

The `--allow-cpu` CLI flag exists for development/testing only.

### Three-Step Workflow

```
Raw manga page (BGR numpy array)
        │
        ▼
 Step 1: detect_text()              ← ML inference → Green Boxes
        │
        │   ┌────────────────────────────────────────────────────┐
        │   │  1. Resize image to 1024×1024, normalize [0,1]    │
        │   │  2. Run ONNX session.run() → blk output           │
        │   │  3. Filter by objectness > confidence_threshold    │
        │   │  4. Convert center-format → corner-format          │
        │   │  5. Apply Non-Maximum Suppression (NMS)            │
        │   │  6. Scale coordinates back to original image dims  │
        │   └────────────────────────────────────────────────────┘
        │
        ▼
  green_boxes: List[Box]
        │
        ▼
 Step 2: expand_boxes() + erase_regions()    ← Yellow Boxes + Smart Inpainting
        │
        │   ┌────────────────────────────────────────────────────┐
        │   │  For each green box:                               │
        │   │    1. Expand by mask_padding (8px) in all 4 dirs   │
        │   │    2. Clamp to image boundaries                    │
        │   │    3. Extract ROI from original image              │
        │   │    4. Convert ROI to grayscale                     │
        │   │    5. cv2.adaptiveThreshold → binary text mask     │
        │   │       (ONLY the dark text strokes become white)    │
        │   │    6. cv2.dilate with 3×3 kernel → thicken mask    │
        │   │       (covers anti-aliased glyph edges)            │
        │   │    7. cv2.inpaint(roi, mask, radius=3, TELEA)      │
        │   │       (reconstructs background through the mask)   │
        │   │    8. Paste inpainted ROI back into main image     │
        │   └────────────────────────────────────────────────────┘
        │
        ▼
  erased_image (text vanished, background art reconstructed)
        │
        ▼
 Step 3: insert_text()              ← English text inside Yellow Box
        │
        │   ┌────────────────────────────────────────────────────┐
        │   │  For each yellow box + translation string:         │
        │   │    1. Start at font_size_max (28pt)                │
        │   │    2. Word-wrap text to fit box width              │
        │   │    3. If total text height > box height → shrink   │
        │   │    4. Repeat until text fits or font_size_min (8)  │
        │   │    5. Center text horizontally and vertically      │
        │   │    6. Render with cv2.putText or Pillow            │
        │   └────────────────────────────────────────────────────┘
        │
        ▼
  translated_page (English text cleanly inside each bubble)
```

### Data Structures

| Class | Purpose |
|---|---|
| `Box(x1, y1, x2, y2)` | Immutable bounding box. Methods: `.width`, `.height`, `.area`, `.expanded()`, `.to_dict()` |
| `MLConfig` | All pipeline parameters: model path, confidence, NMS IoU, padding, font settings, debug colours |

### Key Configuration Values (final working state)

```python
# Detection
model_path = "models/comictextdetector.pt.onnx"
confidence_threshold = 0.35     # objectness score cutoff
nms_iou_threshold = 0.45        # NMS overlap threshold
input_size = 1024               # model input resolution
mask_padding = 8                # yellow box expansion (pixels, all 4 directions)

# Smart Inpainting
adaptive_block_size = 15        # adaptive threshold block size (must be odd)
adaptive_c = 4                  # adaptive threshold constant
dilate_kernel_size = 3          # dilation kernel to thicken text stroke mask
dilate_iterations = 1           # number of dilation passes
inpaint_radius = 3              # cv2.inpaint Telea neighbourhood radius
use_white_fallback = False      # True = old blunt white rects (for comparison only)
```

### NMS Implementation

The `_nms()` function implements standard Non-Maximum Suppression:
1. Sort detections by objectness score (descending).
2. Keep the highest-scoring box, suppress all boxes with IoU > 0.45 against it.
3. Repeat until no boxes remain.

This collapses the ~65-160 raw anchor hits per image down to 5-10 clean detections.

---

## 4. Current State — ML Pipeline Results (2026-04-05)

### Erasure Method Evolution

| Version | Method | Problem |
|---------|--------|---------|
| v1 (claude_gpu_run_1) | Blunt `#FFFFFF` rectangle | Destroys background art, screentones, action lines |
| **v2 (inpaint_run_1)** | **Telea inpainting via adaptive threshold text mask** | **Current — preserves background** |

### inpaint_run_1 — 6/6 Samples Verified (Smart Inpainting)

| Sample | Detections | Text Removed? | Background Preserved? | Artifacts? |
|--------|-----------|-------------|---------------------|-----------|
| sample1 | 5 | Yes, all bubbles | Brick/window art intact | None |
| sample2 | 5 | Yes, all text blocks | Characters, clothing intact | None |
| sample3 | 9 | Yes, all bubbles | Screentone backgrounds intact | Minimal |
| sample4 | 6 | Yes, large blocks | Classroom screentones **PRESERVED** | Slight smudge in dense halftone |
| sample5 | 8 | Yes, bubbles + SFX | Action lines, character art intact | Minimal |
| sample6 | 10 | Yes, all 10 regions | Screentone patterns intact | None |

**Config used:** `conf=0.35, nms_iou=0.45, padding=8, dilate=3x3, inpaint_radius=3`

### Output Files (per sample)

Each sample's results are in `samples/sampleN/inpaint_run_1/`:
- `debug_green_yellow.png` — visual debug with green (ML) + yellow (expanded) boxes
- `erased_inpainted.png` — image with smart inpainting applied (text removed, art preserved)
- `report.json` — detection coordinates and config

Old white-rectangle outputs remain in `samples/sampleN/claude_gpu_run_1/` for comparison.

### Visual Ground Truth Comparison

The "i want" reference images (`sample N i want.jpg/png`) show the expected Green+Yellow
box placement. The ML pipeline matches the visual intent:
- Green boxes tightly wrap Japanese text blocks
- Yellow boxes (8px expansion) define the inpainting region
- Text strokes are surgically removed via adaptive threshold masking
- Background art (screentones, action lines, shading) is reconstructed via Telea inpainting
- No bleed into manga artwork

---

## 5. Running the Pipeline

### Single Image (GPU-only, will crash if CUDA missing)
```bash
python ml_region_lib.py --image samples/sample1/sample.png --conf 0.35 --padding 8
```

### Single Image (allow CPU for dev/testing)
```bash
python ml_region_lib.py --image samples/sample1/sample.png --allow-cpu
```

### All 6 Samples (batch)
```bash
python ml_region_lib.py --all-samples --run-name inpaint_run_1 --conf 0.35 --padding 8
```

### Compare old white-rect vs new inpainting
```bash
python ml_region_lib.py --all-samples --run-name compare_white --white-fallback --allow-cpu
python ml_region_lib.py --all-samples --run-name compare_inpaint --allow-cpu
```

### In Code
```python
from ml_region_lib import MLConfig, load_model, run_pipeline

cfg = MLConfig(confidence_threshold=0.35, mask_padding=8)
session = load_model(cfg.model_path)
result = run_pipeline("samples/sample1/sample.png", cfg, session=session)

# result["ml_boxes"]       → List[Box] (green)
# result["expanded_boxes"] → List[Box] (yellow)
# result["debug_image"]    → numpy array (green+yellow overlay)
# result["erased_image"]   → numpy array (white masks applied)
```

---

## 6. Environment & Dependencies

```
Python 3.10+ (via .venv inside free-manga-translator-codex/)
  onnxruntime-gpu   (ort)  ← ML inference (CUDA priority, CPU fallback)
  opencv-python     (cv2)  ← image I/O, drawing, resizing
  numpy             (np)   ← array math
  Pillow            (PIL)  ← optional, for TTF font rendering in Step 3

GPU: NVIDIA RTX 4060 (CUDA 12.4)
  Requires: cuDNN 9.x, CUDA 12.x, cublasLt64_12.dll in PATH

Activate venv:
  Windows: .venv\Scripts\activate
  Unix:    source .venv/bin/activate
```

---

## 7. AI Workflow & Iteration Protocol

### Mandatory Verification

After every code change:

1. **Run the batch test:**
   ```bash
   python ml_region_lib.py --all-samples --run-name claude_gpu_run_N
   ```

2. **Visually compare** every `debug_green_yellow.png` against the `sample N i want` reference.

3. **Check erased images** — white masks should obliterate text, bubble outlines should remain.

### Iteration Rules

**Detection tuning:**
- If text regions are missed → lower `confidence_threshold` (try 0.25).
- If false positives appear → raise `confidence_threshold` (try 0.50).
- If duplicate boxes appear → lower `nms_iou_threshold` (try 0.35).

**Inpainting tuning:**
- If text strokes remain visible after inpainting → increase `dilate_kernel_size` (try 5) or `dilate_iterations` (try 2).
- If background gets too blurry/smudged → decrease `dilate_kernel_size` (try 2) or `inpaint_radius` (try 2).
- If thin strokes are missed by threshold → decrease `adaptive_c` (try 2) or increase `adaptive_block_size` (try 21).
- If non-text dark pixels are being masked → increase `adaptive_c` (try 6-8).

**Box tuning:**
- If padding is too wide (inpainting region too large) → reduce `mask_padding` (try 6).
- If padding is too narrow (text edges not covered) → increase `mask_padding` (try 10).

**Do not ask the user.** Iterate autonomously until output matches ground truth.

### What NOT to Do

- Do NOT `pip install comic-text-detector` — we use the raw ONNX model directly.
- Do NOT revert to rule-based CV (threshold/contour/morphology) — that path is dead.
- Do NOT modify the ONNX model file — inference only.
- Do NOT commit to git without the user's explicit request.

---

## 8. Fine-Tuning (Future)

If the pre-trained model fails on specific manga styles, refer to `YOLO_TRAINING_GUIDE.md`
for instructions on fine-tuning a YOLOv8 model using the 6 sample images as training data.
Label format: YOLO normalized `[class x_center y_center width height]`.

---

## 9. Padding & Inpainting Math Explanation

### Why 8 pixels padding?

The model's Green Box is a tight bounding box around detected text. Japanese glyphs have:
- Sub-pixel anti-aliased edges that extend 1-2px beyond the detected boundary
- Furigana (small reading guides) that may partially extend outside the box
- JPEG compression artifacts at text edges

An 8px expansion provides:
- 2-3px to cover anti-aliased text edges
- 3-4px safety margin from the speech bubble border
- 1-2px buffer for coordinate rounding from the 1024→original scale conversion

The expansion is clamped to image boundaries: `max(0, x1-pad)` and `min(img_w, x2+pad)`.

### Why Adaptive Threshold + Dilate + Telea Inpainting?

**Problem:** A blunt `#FFFFFF` rectangle destroys everything inside the bounding box —
screentones, action lines, shading, and any background art that overlaps with text.

**Solution:** Surgical text-only removal via a 4-step ROI pipeline:

1. **Adaptive threshold** (`ADAPTIVE_THRESH_GAUSSIAN_C`, `THRESH_BINARY_INV`):
   Isolates dark text strokes against their local background. The Gaussian weighting
   handles varying background brightness (white bubbles vs gray screentones). `blockSize=15`
   captures individual stroke width; `C=4` avoids false-positive masking of light screentone dots.

2. **Dilation** (`3×3 kernel, 1 iteration`):
   Expands the text mask by ~1px in all directions to cover the soft anti-aliased edges of
   Japanese characters that fall between the "definitely dark" and "definitely light" thresholds.
   Without this, faint gray halos would remain around erased characters.

3. **Telea inpainting** (`cv2.INPAINT_TELEA, radius=3`):
   Fast Marching Method propagates pixel values from the mask boundary inward, reconstructing
   whatever background pattern existed behind the text. For white bubble interiors this
   produces clean white; for screentone backgrounds it continues the halftone pattern.

4. **ROI paste-back**: Only the bounding box region is affected; the rest of the image is untouched.

### Why NOT Navier-Stokes inpainting?

`cv2.INPAINT_NS` produces smoother results but is significantly slower and tends to over-smooth
screentone dot patterns, creating visible "smeared" patches. Telea (`INPAINT_TELEA`) better
preserves the high-frequency texture of manga halftones.

---

## 10. GPU Enforcement Details

### Why crash instead of CPU fallback?

Previous iterations with `CPUExecutionProvider` caused:
- Massive CPU spikes (100% utilisation on all cores)
- 10-30x slower inference on large manga pages
- System responsiveness issues during batch processing

The strict GPU-only policy (`providers=['CUDAExecutionProvider']`) ensures:
- Inference runs on the RTX 4060 dedicated hardware
- CPU stays free for the OS, browser, and other tasks
- Consistent inference speed (~50-100ms per page)

If CUDA fails, the error message includes the exact DLL name and typical install path.

---

*Last updated: 2026-04-05 by Claude (claude-opus-4-6) — Smart Telea inpainting deployed, strict GPU enforcement, 6/6 samples verified.*
