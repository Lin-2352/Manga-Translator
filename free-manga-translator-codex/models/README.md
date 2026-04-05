# Models Directory

This directory contains the three ML models used by `ml_region_lib.py`.

## Model A: comic-text-detector (Text Detection + Segmentation)

- **File:** `comictextdetector.pt.onnx`
- **Source:** [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector)
- **Framework:** ONNX
- **Size:** ~100MB
- **GPU:** ONNX Runtime CUDAExecutionProvider

### What it does
Detects Japanese/Chinese/Korean text in manga pages. Produces THREE outputs:
- `blk [1, 64512, 7]` — YOLO-style bounding boxes (cx, cy, w, h, objectness, class0, class1)
- `seg [1, 1, 1024, 1024]` — **pixel-level text segmentation mask** (critical for LaMa inpainting)
- `det [1, 2, 1024, 1024]` — text line heatmaps (unused in our pipeline)

### Input
`[1, 3, 1024, 1024]` — RGB image normalized to [0, 1]

### Critical note
Previous pipeline versions only used the `blk` output (bounding boxes) and ignored `seg`.
The current pipeline uses BOTH: `blk` for classification and `seg` for the pixel-perfect
inpainting mask. The seg output is what separates text pixels from screentone dots and
line art — something adaptive thresholding cannot do.

---

## Model B: manga109-segmentation-bubble (Speech Bubble Segmentation)

- **File:** `manga109_bubble/best.pt`
- **Source:** [HuggingFace huyvux3005/manga109-segmentation-bubble](https://huggingface.co/huyvux3005/manga109-segmentation-bubble)
- **Framework:** Ultralytics YOLOv11n-seg (PyTorch)
- **Size:** 12MB
- **GPU:** PyTorch device='cuda:0'
- **License:** Apache 2.0

### What it does
Instance segmentation of speech bubbles — outputs per-bubble pixel-level masks that trace
the exact irregular shape (ovals, jagged, cloud bubbles).

### Accuracy (published by authors)
- Box mAP@50: 99.10%
- Mask mAP@50: 99.13%
- Precision: 97.55%
- Recall: 97.03%

### Training data
Manga109 + MS92/MangaSegmentation combined dataset (real manga data).

### Input
Recommended input size: 1600x1600 (set via `imgsz=1600`)

### Why this model?
Replaced `speech_bubble_segmentor.pt` (kitsumed/yolov8m_seg-speech-bubble, 54.8MB, GPL-3.0)
which had too many false positive detections — it classified narration boxes, SFX text areas,
and open artwork regions as "speech bubbles." The manga109 model is trained on actual manga
data and is 4x smaller with dramatically better accuracy.

---

## Model C: LaMa (Large Mask Inpainting)

- **File:** `lama/lama_fp32.onnx`
- **Source:** [HuggingFace Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX)
- **Paper:** "Resolution-robust Large Mask Inpainting with Fourier Convolutions" (Samsung AI, WACV 2022)
- **Framework:** ONNX
- **Size:** 198MB (~27M parameters)
- **GPU:** ONNX Runtime CUDAExecutionProvider (~500MB VRAM)
- **License:** Apache 2.0

### What it does
Deep learning image inpainting — given an image and a binary mask indicating which pixels
to remove, it reconstructs the missing regions by understanding the surrounding visual
patterns. Its Fourier convolution layers have a global receptive field, making it
particularly good at reconstructing periodic/repetitive patterns like screentone halftone
dots — exactly what manga backgrounds consist of.

### Input
- `image [1, 3, 512, 512]` — RGB float32 [0, 1]
- `mask [1, 1, 512, 512]` — float32 (1.0 = inpaint this pixel, 0.0 = keep)

### Output
- `output [1, 3, 512, 512]` — RGB float32 [0, 1], the inpainted image

### Why this model?
Replaced `cv2.inpaint(TELEA)` which is a 2004-era PDE method that smears screentones
and destroys line art. LaMa is the same inpainting model used by manga-image-translator,
the most popular open-source manga translation tool. The improvement is dramatic.

### Alternative variants
- `mayocream/lama-manga-onnx` — manga-specific LaMa variant (197MB)
- `ogkalu/lama-manga-onnx-dynamic` — dynamic input shapes, no 512x512 resize (196MB)
- `opencv/inpainting_lama` — OpenCV zoo version, smaller (88MB)

---

## Superseded Models

### speech_bubble_segmentor.pt (OLD - kept for comparison)
- **Source:** [HuggingFace kitsumed/yolov8m_seg-speech-bubble](https://huggingface.co/kitsumed/yolov8m_seg-speech-bubble)
- **Framework:** Ultralytics YOLOv8m-seg (PyTorch)
- **Size:** 54.8MB
- **License:** GPL-3.0
- **Status:** SUPERSEDED by manga109_bubble/best.pt
- **Why replaced:** Too many false positive bubble detections. Classified narration areas,
  SFX zones, and open artwork as "speech bubbles," causing text in those regions to be
  incorrectly inpainted and destroying the background art. No published accuracy metrics.

---

## VRAM Budget (RTX 4060, 8GB)

| Model | VRAM Usage |
|-------|-----------|
| A (comic-text-detector) | ~300MB |
| B (manga109-bubble) | ~200MB |
| C (LaMa) | ~500MB |
| **Total** | **~1GB** |

All three models fit comfortably in the RTX 4060's 8GB VRAM with room to spare.

---

## Downloading Models

Models B and C can be downloaded from HuggingFace:

```python
from huggingface_hub import hf_hub_download

# Model B
hf_hub_download(repo_id='huyvux3005/manga109-segmentation-bubble',
                filename='best.pt', local_dir='models/manga109_bubble')

# Model C
hf_hub_download(repo_id='Carve/LaMa-ONNX',
                filename='lama_fp32.onnx', local_dir='models/lama')
```

Model A (`comictextdetector.pt.onnx`) is included in the repository.
