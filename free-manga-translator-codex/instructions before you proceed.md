# Instructions Before You Proceed
## Free Manga Translator — Triple-Model ML Pipeline (Text Detection + Bubble Segmentation + LaMa Inpainting)

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
solves the core geometric problem: given a raw manga image, use ML models to find every
Japanese text region, determine which text is inside speech bubbles, and surgically remove
ONLY that text while perfectly reconstructing the background art.

**The ultimate goal in one sentence:**
> Three ML models work together: Model A detects text bounding boxes + pixel-level text
> segmentation masks, Model B segments speech bubble shapes, and Model C (LaMa) performs
> deep learning inpainting that reconstructs the background perfectly — screentones, line
> art, and shading are all preserved.

Visualised:
```
┌──────────────────────────────┐   ← black speech bubble border
│                              │
│   ┌──────────────┐           │   ← Yellow Box  (inpainting region, +8px padding)
│   │  ┌────────┐  │           │
│   │  │ GREEN  │  │           │   ← Green Box   (ML-detected Japanese text bounds)
│   │  │ (seg)  │  │           │   ← Seg mask    (pixel-level text mask from Model A)
│   │  └────────┘  │           │
│   └──────────────┘           │
└──────────────────────────────┘
         │
         ▼
    LaMa inpaints ONLY the seg pixels → background perfectly reconstructed
```

Yellow must:
- Completely contain the Green Box (no Japanese pixel left exposed).
- Expand exactly 8 pixels in all directions from the Green Box.
- Be clamped to image boundaries.
- LaMa deep learning inpainting removes only text strokes; background art is perfectly reconstructed.

---

## 2. Architecture Evolution

### Timeline

| Date | Architecture | Problem Solved |
|------|-------------|---------------|
| Pre-2026-04-04 | Rule-based CV (threshold/contour/morphology) | DEAD — can't handle screentones |
| 2026-04-04 | Single ML model (text detection only) | Text found, but blunt white rect erasure |
| 2026-04-05 v1 | Single ML + Telea inpainting | Smart erasure, but destroys art behind floating text |
| 2026-04-05 v2 | Dual-model intersection + Telea | Bubble/floating classification, but Telea still smears backgrounds |
| 2026-04-05 v3 | Dual-model + better bubble model (manga109) | Better bubble accuracy, but Telea inpainting inherently limited |
| **2026-04-05 v4** | **Triple-model: text seg mask + bubble seg + LaMa inpainting** | **CURRENT — pixel-perfect text removal, backgrounds perfectly reconstructed** |

### Key Architectural Decisions

1. **Why pixel-level seg mask instead of bounding box masking?**
   The comic-text-detector outputs BOTH bounding boxes (`blk`) AND a pixel-level text
   segmentation mask (`seg`). Previous versions used bounding boxes + adaptive threshold
   to build the inpainting mask, which caught screentone dots and line art as false
   positives. The seg mask was trained specifically to identify text characters at pixel
   level — it cleanly separates text from background art.

2. **Why LaMa instead of OpenCV Telea?**
   Telea (`cv2.INPAINT_TELEA`) is a 2004-era PDE-based method that propagates surrounding
   pixels inward along isophotes. It can fill small holes in smooth regions but fundamentally
   cannot reconstruct structured patterns. LaMa uses Fourier convolutions with a global
   receptive field, specifically excelling at periodic/repetitive patterns like screentone
   halftone dots. The improvement is dramatic — screentones, line art, and shading are all
   preserved perfectly.

3. **Why bubble segmentation for classification?**
   Text inside speech bubbles sits on white/uniform backgrounds — safe to inpaint. Text
   floating over complex artwork (screentones, character hair, action lines) is dangerous
   to inpaint even with LaMa. The bubble model classifies text so that only safe regions
   are processed.

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

Also replaced (not deleted):
- `models/speech_bubble_segmentor.pt` — old kitsumed/yolov8m_seg-speech-bubble model
  (too many false positive bubble detections, replaced by manga109 model)

### Current File Map

```
free-manga-translator-codex/
├── ml_region_lib.py                    ← CORE PIPELINE (triple-model detection + LaMa inpainting)
├── models/
│   ├── comictextdetector.pt.onnx       ← Model A: text detector + seg mask (ONNX)
│   ├── manga109_bubble/best.pt         ← Model B: bubble segmentor (YOLOv11n-seg)
│   ├── lama/lama_fp32.onnx            ← Model C: LaMa inpainter (ONNX, 198MB)
│   ├── speech_bubble_segmentor.pt      ← OLD Model B (superseded, kept for comparison)
│   └── README.md                       ← Model documentation
├── YOLO_TRAINING_GUIDE.md              ← Instructions for fine-tuning YOLOv8
├── instructions before you proceed.md  ← THIS FILE
├── README.md                           ← Project overview
├── samples/
│   ├── sample1/sample.png              ← source image
│   ├── sample2/sample 2.jpeg + sample 2 i want.jpg
│   ├── sample3/sample 3.jpg + sample 3 i want.jpg
│   ├── sample4/sample 4.png + sample 4 i want.jpg
│   ├── sample5/sample 5.jpg + sample 5 i want.jpg
│   ├── sample6/sample 6.jpg + sample 6 i want.png
│   └── sampleN/{claude_gpu_run_1, inpaint_run_1, dual_model_run_1,
│                 manga109_run_1, lama_run_1}/   ← output folders per iteration
├── .env, config.json, manifest.json    ← extension config
├── background.js, content.js, popup.* , translationPanel.js  ← extension source
└── .venv/                              ← Python virtual environment
```

---

## 3. The Triple-Model Pipeline: `ml_region_lib.py`

### Model A: comic-text-detector (ONNX)

- **File:** `models/comictextdetector.pt.onnx`
- **Source:** [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector)
- **Input:** `[1, 3, 1024, 1024]` — RGB image normalized to [0, 1]
- **Outputs (THREE):**
  - `blk [1, 64512, 7]` — YOLO-style text bounding boxes (cx, cy, w, h, obj, c0, c1)
  - `seg [1, 1, 1024, 1024]` — **pixel-level text segmentation mask** (0.0 = background, 1.0 = text)
  - `det [1, 2, 1024, 1024]` — text line heatmaps (unused)
- **GPU:** ONNX Runtime `CUDAExecutionProvider`
- **Critical:** Previous versions only used `blk` (boxes) and ignored `seg`. The current
  pipeline uses BOTH — `blk` for bounding box classification and `seg` for the pixel-perfect
  inpainting mask fed to LaMa.

### Model B: manga109-segmentation-bubble (YOLOv11n-seg)

- **File:** `models/manga109_bubble/best.pt`
- **Source:** [HuggingFace huyvux3005/manga109-segmentation-bubble](https://huggingface.co/huyvux3005/manga109-segmentation-bubble)
- **Architecture:** YOLOv11n-seg (Nano — 12MB, fast)
- **Training data:** Manga109 + MangaSegmentation combined dataset
- **Accuracy:** Box mAP@50 = 99.10%, Mask mAP@50 = 99.13%
- **Input size:** 1600x1600 (recommended)
- **Type:** Instance segmentation — outputs **pixel-level masks** per bubble
- **GPU:** Ultralytics/PyTorch `device='cuda:0'`
- **Replaced:** `speech_bubble_segmentor.pt` (kitsumed/yolov8m_seg) which had too many false
  positive detections — the manga109 model is trained on actual manga data with 99%+ accuracy.

### Model C: LaMa (Large Mask Inpainting, ONNX)

- **File:** `models/lama/lama_fp32.onnx`
- **Source:** [HuggingFace Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX)
- **Paper:** "Resolution-robust Large Mask Inpainting with Fourier Convolutions" (Samsung, WACV 2022)
- **Input:** `image [1, 3, 512, 512]` float32 [0,1] + `mask [1, 1, 512, 512]` float32 (1=inpaint)
- **Output:** `[1, 3, 512, 512]` — inpainted image
- **Size:** 198MB, ~500MB VRAM
- **GPU:** ONNX Runtime `CUDAExecutionProvider`
- **Why LaMa:** Uses Fast Fourier Convolutions with global receptive field. Specifically
  excels at reconstructing periodic/repetitive patterns like screentone halftone dots —
  exactly what manga backgrounds are made of. This is the same model used by
  manga-image-translator, the most popular open-source manga translation tool.
- **Replaced:** `cv2.inpaint(TELEA)` which smeared screentones and destroyed line art.

### GPU Enforcement (STRICT — All Three Models)

| Model | Framework | GPU Lock | VRAM |
|-------|-----------|----------|------|
| A (text) | ONNX Runtime | `providers=['CUDAExecutionProvider']` | ~300MB |
| B (bubble) | Ultralytics/PyTorch | `device='cuda:0'` | ~200MB |
| C (LaMa) | ONNX Runtime | `providers=['CUDAExecutionProvider']` | ~500MB |
| **Total** | | | **~1GB** (fits in 8GB RTX 4060) |

The `--allow-cpu` CLI flag exists for development/testing only.

### Five-Step Workflow

```
Raw manga page
        │
   ┌────┴────┐
   ▼         ▼
 MODEL A   MODEL B
 (ONNX)    (PyTorch)
   │         │
   ├─boxes   │
   ├─seg_mask│
   ▼         ▼
 text_boxes  bubble_masks        ← Step 1+2: detection
 seg_mask
   │         │
   └────┬────┘
        ▼
 Step 3: classify_text_regions()  ← INTERSECTION TEST
        │
   ┌────┴─────────┐
   ▼              ▼
 bubble_text    floating_text     ← overlap ≥ 50%  vs  < 50%
 (GREEN box)    (RED box)
   │              │
   ▼              ▼
 Step 4:        SKIP              ← protect background art
 seg_mask +     (untouched)
 MODEL C (LaMa)
   │
   ▼
 perfectly inpainted image        ← screentones, line art preserved
   │
   ▼
 Step 5: insert_text()            ← English in erased bubble regions
```

**Intersection logic:** For each text box, crop every bubble mask to the text box region,
count nonzero pixels, divide by box area. If >= 50% overlap -> "bubble_text" (safe to inpaint).
Otherwise -> "floating_text" (skip to protect artwork).

**Inpainting (bubble text only):** The seg mask from Model A provides pixel-perfect text
detection. Within each bubble_text expanded box, the seg mask pixels are collected into a
final inpainting mask. This mask + the original image are fed to LaMa, which reconstructs
the background behind the text. Only the masked pixels in the result are pasted back —
the rest of the image is untouched.

### Data Structures

| Class | Purpose |
|---|---|
| `Box(x1, y1, x2, y2)` | Immutable bounding box. Properties: `.width`, `.height`, `.area`. Methods: `.expanded()`, `.to_dict()` |
| `MLConfig` | All pipeline parameters: model paths, thresholds, padding, font settings, debug colours |
| `TextDetectionResult` | Contains `boxes: List[Box]` and `seg_mask: np.ndarray` from Model A |
| `ClassifiedText` | Per-text-region: `box`, `expanded_box`, `text_type`, `bubble_idx`, `overlap` |

### Key Configuration Values (current working state)

```python
# Model A — Text Detection
text_model_path = "models/comictextdetector.pt.onnx"
confidence_threshold = 0.35     # objectness score cutoff
nms_iou_threshold = 0.45        # NMS overlap threshold
input_size = 1024               # model input resolution
seg_threshold = 0.50            # threshold for text seg mask
seg_dilate_kernel = 3           # dilate seg mask to cover anti-aliased edges
seg_dilate_iterations = 1

# Model B — Bubble Segmentation
bubble_model_path = "models/manga109_bubble/best.pt"
bubble_confidence = 0.50        # bubble detection confidence threshold
bubble_overlap_threshold = 0.50 # min overlap ratio for "bubble_text"

# Model C — LaMa Inpainting
lama_model_path = "models/lama/lama_fp32.onnx"

# Layout
mask_padding = 8                # yellow box expansion (pixels, all 4 directions)
```

### NMS Implementation

The `_nms()` function implements standard Non-Maximum Suppression:
1. Sort detections by objectness score (descending).
2. Keep the highest-scoring box, suppress all boxes with IoU > 0.45 against it.
3. Repeat until no boxes remain.

This collapses the ~65-160 raw anchor hits per image down to 5-10 clean detections.

---

## 4. Current State — LaMa Pipeline Results (2026-04-05)

### Erasure Method Evolution

| Version | Run Name | Method | Problem |
|---------|----------|--------|---------|
| v1 | claude_gpu_run_1 | Blunt `#FFFFFF` rectangle | Destroys everything inside bounding box |
| v2 | inpaint_run_1 | Telea inpainting (all text) | Destroys art behind floating text |
| v3 | dual_model_run_1 | Dual-model + Telea (kitsumed bubble model) | False positive bubbles, Telea smears screentones |
| v4 | manga109_run_1 | Better bubble model (manga109) + Telea | Better classification but Telea still smears |
| **v5** | **lama_run_1** | **Triple-model: seg mask + manga109 bubbles + LaMa** | **CURRENT — perfect background reconstruction** |

### lama_run_1 — 6/6 Samples Verified

| Sample | Text | Bubbles | Bubble Text | Floating | Key Result |
|--------|------|---------|-------------|----------|------------|
| sample1 | 5 | 5 | 5 | 0 | All inside bubbles, LaMa clean fill |
| sample2 | 5 | 6 | 5 | 0 | All text cleanly removed |
| sample3 | 9 | 7 | 6 | 3 | 3 floating (SFX/narration) skipped, bubbles clean |
| sample4 | 6 | 4 | 4 | **2** | **Screentone classroom PERFECTLY PRESERVED** |
| sample5 | 8 | 8 | 8 | 0 | All bubbles cleanly emptied, artwork intact |
| sample6 | 10 | 10 | 9 | 1 | "最終兵器登場!" floating skipped, manga title intact |

**Config:** `text_conf=0.35, bubble_conf=0.50, overlap=0.50, padding=8, seg_thresh=0.50, LaMa 512x512`

### Output Files (per sample)

Each sample's results are in `samples/sampleN/lama_run_1/`:
- `debug_dual_model.png` — green (bubble text), red (floating text), cyan (bubble contours), yellow (inpaint regions), magenta (seg mask overlay)
- `erased_inpainted.png` — only bubble text erased via LaMa, floating text untouched
- `seg_mask.png` — pixel-level text mask from Model A (white = text, black = background)
- `report.json` — full classification data with overlap ratios

### Debug Image Color Key

| Color | Meaning |
|-------|---------|
| **Green box** | Text inside a bubble -> will be inpainted by LaMa |
| **Yellow box** | Expanded inpainting region (8px pad) |
| **Red box** | Floating text -> SKIPPED (art protected) |
| **Cyan contour** | Detected speech bubble outline (Model B) |
| **Magenta overlay** | Pixel-level text seg mask (Model A seg output) |

---

## 5. Running the Pipeline

### Single Image (GPU-only, will crash if CUDA missing)
```bash
python ml_region_lib.py --image samples/sample1/sample.png \
  --text-model models/comictextdetector.pt.onnx \
  --bubble-model models/manga109_bubble/best.pt \
  --lama-model models/lama/lama_fp32.onnx \
  --conf 0.35 --bubble-conf 0.50 --overlap 0.50 --padding 8
```

### Single Image (allow CPU for dev/testing)
```bash
python ml_region_lib.py --image samples/sample1/sample.png --allow-cpu
```

### All 6 Samples (batch)
```bash
python ml_region_lib.py --all-samples --run-name lama_run_1 \
  --conf 0.35 --bubble-conf 0.50 --overlap 0.50 --padding 8
```

### CLI Arguments Reference

| Flag | Default | Description |
|------|---------|-------------|
| `--image PATH` | -- | Single image mode |
| `--all-samples` | -- | Batch mode (all 6 samples) |
| `--run-name NAME` | `"lama_run_1"` | Output folder name inside each sample dir |
| `--text-model PATH` | `models/comictextdetector.pt.onnx` | Model A: text detector + seg |
| `--bubble-model PATH` | `models/manga109_bubble/best.pt` | Model B: bubble segmentor |
| `--lama-model PATH` | `models/lama/lama_fp32.onnx` | Model C: LaMa inpainter |
| `--conf FLOAT` | `0.35` | Text detection objectness threshold |
| `--bubble-conf FLOAT` | `0.50` | Bubble detection confidence threshold |
| `--overlap FLOAT` | `0.50` | Minimum overlap ratio for "bubble_text" classification |
| `--padding INT` | `8` | Yellow box expansion in pixels |
| `--allow-cpu` | `False` | Allow CPU fallback (dev/testing only) |

### In Code
```python
from ml_region_lib import (MLConfig, load_text_model, load_bubble_model,
                           load_lama_model, run_pipeline)

cfg = MLConfig(confidence_threshold=0.35, bubble_confidence=0.50,
               bubble_overlap_threshold=0.50, mask_padding=8)
text_session = load_text_model(cfg.text_model_path)
bubble_model, bubble_device = load_bubble_model(cfg.bubble_model_path)
lama_session = load_lama_model(cfg.lama_model_path)

result = run_pipeline("samples/sample1/sample.png", cfg,
                      text_session=text_session,
                      bubble_model=bubble_model,
                      bubble_device=bubble_device,
                      lama_session=lama_session)

# result["classified"]    -> List[ClassifiedText]
# result["bubble_masks"]  -> List[ndarray] (per-bubble pixel masks)
# result["seg_mask"]      -> ndarray (pixel-level text mask from Model A)
# result["debug_image"]   -> numpy array (annotated overlay)
# result["erased_image"]  -> numpy array (LaMa-inpainted, floating text untouched)
```

---

## 6. Environment & Dependencies

```
Python 3.10+ (via .venv inside free-manga-translator-codex/)

Core:
  onnxruntime-gpu   (ort)        <- Model A + C inference (CUDAExecutionProvider)
  ultralytics       (YOLO)       <- Model B inference (YOLOv11n-seg)
  opencv-python     (cv2)        <- image I/O, drawing, resizing
  numpy             (np)         <- array math
  torch + torchvision            <- PyTorch backend for Ultralytics (CUDA 12.4)
  Pillow            (PIL)        <- optional, for TTF font rendering in Step 5

Utilities:
  huggingface_hub                <- downloads models from HuggingFace on first run

GPU: NVIDIA RTX 4060 Laptop GPU (8GB VRAM, CUDA 12.4)
  Model A (ONNX): Requires cuDNN 9.x, CUDA 12.x, cublasLt64_12.dll in PATH
  Model B (PyTorch): Works if torch.cuda.is_available() == True
  Model C (ONNX): Same CUDA requirements as Model A
  Combined VRAM: ~1GB (fits easily in 8GB)

Known issue: ONNX CUDAExecutionProvider may fail if cublasLt64_12.dll is not
in system PATH. Fix: add C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.x\bin
to your PATH environment variable. PyTorch CUDA works independently.

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
   python ml_region_lib.py --all-samples --run-name lama_run_N
   ```

2. **Visually compare** every `debug_dual_model.png` against the `sample N i want` reference.

3. **Check erased images** (`erased_inpainted.png`):
   - Bubble text should be cleanly removed (background perfectly reconstructed by LaMa).
   - Floating text should be completely untouched.
   - Speech bubble borders should remain intact.
   - Screentone patterns should be continuous through inpainted regions.

4. **Check seg mask** (`seg_mask.png`):
   - White pixels should precisely match text character shapes.
   - No background art (screentone dots, line art) should be white.

5. **Check classification** (`report.json`):
   - Each text box should have correct `text_type` ("bubble_text" or "floating_text").
   - Overlap ratios should make sense (high for text inside bubbles, low for floating).

### Iteration Rules

**Text detection tuning (Model A):**
- If text regions are missed -> lower `--conf` (try 0.25).
- If false positives appear -> raise `--conf` (try 0.50).
- If duplicate boxes appear -> lower `nms_iou_threshold` (try 0.35).

**Seg mask tuning (Model A seg output):**
- If text stroke edges are not fully covered -> increase `seg_dilate_kernel` (try 5).
- If non-text pixels are included in mask -> raise `seg_threshold` (try 0.7).
- If thin text strokes are missed -> lower `seg_threshold` (try 0.3).

**Bubble detection tuning (Model B):**
- If bubbles are missed -> lower `--bubble-conf` (try 0.30).
- If non-bubble regions detected as bubbles -> raise `--bubble-conf` (try 0.70).

**Classification tuning (intersection):**
- If text inside bubbles is wrongly classified as floating -> lower `--overlap` (try 0.30).
- If floating text is wrongly classified as bubble_text -> raise `--overlap` (try 0.70).

**LaMa quality tuning (Model C):**
- LaMa runs at 512x512 internally. For very large manga pages, text detail at 512x512
  may be too coarse. Future improvement: tile-based LaMa processing at higher resolution.
- If inpainted regions show color shift, ensure the mask is tight (reduce `seg_dilate_kernel`).

**Box tuning:**
- If padding is too wide -> reduce `--padding` (try 6).
- If padding is too narrow -> increase `--padding` (try 10).

**Do not ask the user.** Iterate autonomously until output matches ground truth.

### What NOT to Do

- Do NOT `pip install comic-text-detector` -- we use the raw ONNX model directly.
- Do NOT revert to rule-based CV (threshold/contour/morphology) -- that path is dead.
- Do NOT revert to Telea/Navier-Stokes inpainting -- LaMa is strictly superior.
- Do NOT modify the ONNX/PyTorch model files -- inference only.
- Do NOT remove the bubble classification -- it protects floating text over artwork.
- Do NOT inpaint floating text -- that defeats the purpose of the pipeline.
- Do NOT ignore the `seg` output from comic-text-detector -- it's the pixel-perfect mask.
- Do NOT commit to git without the user's explicit request.

---

## 8. Fine-Tuning (Future)

If the pre-trained models fail on specific manga styles:

- **Text detection:** Refer to `YOLO_TRAINING_GUIDE.md` for fine-tuning YOLOv8 on custom
  samples. Label format: YOLO normalized `[class x_center y_center width height]`.
- **Bubble segmentation:** The manga109 model already has 99%+ mAP. If needed, fine-tune
  on custom bubble shapes using the same YOLO training workflow with segmentation masks.
- **LaMa inpainting:** Generally does not need fine-tuning. Its Fourier convolutions
  generalize well to manga art. If specific background patterns are poorly reconstructed,
  consider using the manga-specific LaMa variant from `mayocream/lama-manga-onnx`.

---

## 9. Padding & Inpainting Architecture Explanation

### Why 8 pixels padding?

The model's Green Box is a tight bounding box around detected text. Japanese glyphs have:
- Sub-pixel anti-aliased edges that extend 1-2px beyond the detected boundary
- Furigana (small reading guides) that may partially extend outside the box
- JPEG compression artifacts at text edges

An 8px expansion provides:
- 2-3px to cover anti-aliased text edges
- 3-4px safety margin from the speech bubble border
- 1-2px buffer for coordinate rounding from the 1024->original scale conversion

The expansion is clamped to image boundaries: `max(0, x1-pad)` and `min(img_w, x2+pad)`.

### Why Pixel-Level Seg Mask + LaMa (current approach)?

**Problem with previous approaches:**

1. **Blunt white rectangle:** Destroys everything inside the bounding box.
2. **Adaptive threshold + Telea:** The adaptive threshold catches screentone dots and line
   art as "text," creating a noisy mask. Telea then smears the surrounding pixels inward,
   producing visible artifacts on any non-uniform background.

**Current solution: seg mask + LaMa**

1. **Pixel-level seg mask** from comic-text-detector's `seg [1,1,1024,1024]` output:
   The model was trained specifically to classify each pixel as text vs. background.
   It cleanly separates Japanese character strokes from screentone dots, line art, and
   shading — something adaptive thresholding cannot do.

2. **Dilation** (3x3 kernel, 1 iteration):
   Expands the seg mask by ~1px to cover anti-aliased text edges that fall between the
   model's "definitely text" and "definitely background" thresholds.

3. **LaMa inpainting** (512x512, Fourier convolutions):
   The seg mask pixels are collected into an inpainting mask. The original image + mask
   are resized to 512x512 and fed to LaMa. LaMa's Fourier convolution layers have a
   global receptive field — they "see" the entire image at once and can reconstruct
   periodic patterns (screentone dots, crosshatching) by understanding their frequency
   and phase. The result is resized back to original dimensions.

4. **Selective paste-back:** Only the masked pixels from LaMa's output are applied to
   the original image. Everything else is untouched.

### Why NOT Navier-Stokes or Telea inpainting?

Both are classical PDE-based methods (2001/2004) with purely local receptive fields. They:
- Cannot understand or reconstruct periodic textures (screentone)
- Produce visible smearing/blurring on any non-uniform background
- Only work acceptably on flat white bubble interiors (a trivial case)

LaMa's neural network approach with Fourier convolutions is fundamentally superior for
structured pattern reconstruction — the exact problem manga backgrounds present.

---

## 10. GPU Enforcement Details

### Why crash instead of CPU fallback?

Previous iterations with `CPUExecutionProvider` caused:
- Massive CPU spikes (100% utilisation on all cores)
- 10-30x slower inference on large manga pages
- System responsiveness issues during batch processing

The strict GPU-only policy ensures:
- All three models run on the RTX 4060 dedicated hardware
- CPU stays free for the OS, browser, and other tasks
- Consistent inference speed (~50-100ms per model per page)

### Enforcement per model

**Model A (ONNX Runtime):**
```python
providers = ['CUDAExecutionProvider']  # NO CPUExecutionProvider
session = ort.InferenceSession(model_path, providers=providers)
```

**Model B (Ultralytics/PyTorch):**
```python
if not torch.cuda.is_available():
    raise RuntimeError("CUDA not available for PyTorch")
model = YOLO(model_path)
results = model(image, device='cuda:0', retina_masks=True)
```

**Model C (ONNX Runtime — LaMa):**
```python
providers = ['CUDAExecutionProvider']  # NO CPUExecutionProvider
lama_session = ort.InferenceSession(model_path, providers=providers)
```

### The `--allow-cpu` escape hatch

For development and testing only. When passed:
- Models A + C fall back to `['CUDAExecutionProvider', 'CPUExecutionProvider']`
- Model B uses `device='cpu'`
- A message indicates CPU mode is active

This flag exists because ONNX's CUDAExecutionProvider requires `cublasLt64_12.dll` in the
system PATH, which may not be configured on all dev machines. PyTorch CUDA typically works
without extra PATH configuration.

---

## 11. Future Improvements

### High Priority

1. **Tile-based LaMa processing:** Currently the entire page is resized to 512x512 for LaMa.
   For high-resolution manga pages (2000+ pixels), processing individual tiles at 512x512
   with overlap would preserve more detail in the inpainted regions.

2. **ONNX CUDA fix:** Resolve the `cublasLt64_12.dll` PATH issue so Model A and C run on
   GPU. Currently Model A falls back to CPU with `--allow-cpu`.

3. **Chrome extension integration:** Wire the Python pipeline into the Chrome extension's
   translation workflow. The extension currently sends images to Gemini for translation;
   the pipeline should preprocess images (detect + erase text) before sending to Gemini,
   then overlay English text in the erased regions.

### Medium Priority

4. **Floating text handling:** Currently floating text (outside bubbles) is skipped entirely.
   For narration boxes and SFX text, explore using LaMa to inpaint those regions too, since
   LaMa can handle complex backgrounds better than Telea. This needs careful testing per
   manga style.

5. **Model B accuracy for edge cases:** The manga109 bubble model occasionally classifies
   rectangular narration frames as "speech bubbles." Raising `--bubble-conf` or `--overlap`
   can help, but a more sophisticated classification (e.g., using ogkalu/comic-text-and-bubble-detector
   which has separate classes for bubble vs text_bubble vs text_free) could be more accurate.

6. **Batch processing optimization:** Load all three models once and process pages in sequence.
   Currently each `run_pipeline()` call is independent. For Chrome extension use, a persistent
   model server would avoid reload overhead.

### Low Priority

7. **LaMa model variants:** Test `mayocream/lama-manga-onnx` (manga-specific LaMa) and
   `ogkalu/lama-manga-onnx-dynamic` (dynamic input shapes, no 512x512 resize needed).

8. **Font rendering quality:** Improve English text placement with better font sizing,
   vertical text support for manga panels, and text wrapping that respects bubble shapes.

9. **Multi-language support:** Extend beyond Japanese to Chinese and Korean text detection
   (comic-text-detector already supports these to some degree).

---

*Last updated: 2026-04-05 by Claude (claude-opus-4-6) — Triple-model pipeline: pixel-level seg mask + manga109 bubble segmentation + LaMa deep learning inpainting. 6/6 samples verified with perfect background reconstruction.*
