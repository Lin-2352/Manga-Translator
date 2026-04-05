# YOLO Fine-Tuning Guide for Manga Text Detection

How to train a custom YOLOv8 model on your difficult manga samples (1-6).

> **Note:** The current pipeline uses a pre-trained `comictextdetector.pt.onnx` (ONNX) for
> text detection. This guide is for cases where the pre-trained model fails on specific manga
> styles and you need to train a custom detector. For bubble segmentation, the `manga109-
> segmentation-bubble` model already has 99%+ mAP and generally does not need fine-tuning.

---

## Step 1: Organize Your Images

Create this folder structure:

```
dataset/
├── images/
│   ├── train/
│   │   ├── sample1.png
│   │   ├── sample2.png
│   │   ├── sample3.png
│   │   └── sample4.png
│   └── val/
│       ├── sample5.png
│       └── sample6.png
└── labels/
    ├── train/
    │   ├── sample1.txt
    │   ├── sample2.txt
    │   ├── sample3.txt
    │   └── sample4.txt
    └── val/
        ├── sample5.txt
        └── sample6.txt
```

**Rule:** Each image file must have a matching `.txt` file with the same name in the parallel `labels/` folder.

---

## Step 2: Label Your Ground-Truth Boxes

For each image, create a `.txt` label file. Each line represents one bounding box:

```
<class_id> <x_center> <y_center> <width> <height>
```

All values are **normalized** (0.0 to 1.0) relative to the image dimensions.

### Conversion Formula

If your "I want" ground-truth box is `[x1, y1, x2, y2]` in pixels, and the image is `W × H` pixels:

```
x_center = ((x1 + x2) / 2) / W
y_center = ((y1 + y2) / 2) / H
width    = (x2 - x1) / W
height   = (y2 - y1) / H
```

### Example

Image is 1200×1800 pixels. A text box spans `[100, 200, 350, 450]`:

```
x_center = (100 + 350) / 2 / 1200 = 0.1875
y_center = (200 + 450) / 2 / 1800 = 0.1806
width    = (350 - 100) / 1200      = 0.2083
height   = (450 - 200) / 1800      = 0.1389
```

Label line (class 0 = "text"):
```
0 0.1875 0.1806 0.2083 0.1389
```

If an image has 5 text regions, the `.txt` file has 5 lines.

---

## Step 3: (Recommended) Use a Labeling Tool

Manual math is tedious. Use a GUI tool instead:

- **[labelImg](https://github.com/HumanSignal/labelImg)** — lightweight, exports YOLO format directly
- **[CVAT](https://www.cvat.ai/)** — web-based, export as "YOLO 1.1"
- **[Roboflow](https://roboflow.com/)** — upload images, draw boxes in browser, export YOLO format

With any of these, you draw boxes around text regions and the tool generates the normalized `.txt` files for you.

---

## Step 4: Create the Dataset Config File

Create `dataset/manga_text.yaml`:

```yaml
# manga_text.yaml
path: ./dataset           # root directory
train: images/train       # train images (relative to path)
val: images/val           # validation images (relative to path)

# Classes
names:
  0: text
```

---

## Step 5: Install Ultralytics

```bash
pip install ultralytics
```

---

## Step 6: Train

```bash
yolo detect train \
  model=yolov8n.pt \
  data=dataset/manga_text.yaml \
  epochs=100 \
  imgsz=1024 \
  batch=4 \
  name=manga-text-detector
```

| Flag | Meaning |
|------|---------|
| `model=yolov8n.pt` | Start from pre-trained YOLOv8-nano (smallest/fastest). Use `yolov8s.pt` or `yolov8m.pt` for more accuracy. |
| `imgsz=1024` | Manga pages are large — 1024 preserves small text detail. |
| `batch=4` | Reduce if you run out of GPU memory. |
| `epochs=100` | For 6 images this will overfit fast. 50-100 is a starting point. |

Training output will be in `runs/detect/manga-text-detector/`.

---

## Step 7: Validate

```bash
yolo detect val \
  model=runs/detect/manga-text-detector/weights/best.pt \
  data=dataset/manga_text.yaml
```

This prints mAP (mean Average Precision). For text detection, aim for mAP50 > 0.80.

---

## Step 8: Use Your Trained Model

Copy `runs/detect/manga-text-detector/weights/best.pt` into your project's `models/` folder.

**Important:** The current pipeline (`ml_region_lib.py`) uses an ONNX model that outputs BOTH
bounding boxes and a pixel-level segmentation mask. A custom YOLO detector would only provide
bounding boxes. To fully integrate a custom model, you would need to either:

1. Export it to ONNX with segmentation support, or
2. Modify `detect_text()` in `ml_region_lib.py` to use the YOLO model for boxes and fall
   back to the pre-trained comic-text-detector for the seg mask.

For testing the detector alone:

```bash
# Using Ultralytics CLI
yolo detect predict model=models/best.pt source=samples/sample1/sample.png conf=0.35

# Or in Python
from ultralytics import YOLO
model = YOLO("models/best.pt")
results = model("sample.png", conf=0.35, imgsz=1024)
for box in results[0].boxes:
    print(box.xyxy, box.conf)
```

---

## Tips for Small Datasets (6 images)

1. **Augmentation is critical.** Ultralytics applies augmentation by default (flip, scale, mosaic, HSV shifts). For manga, add:
   ```bash
   yolo detect train ... augment=True mosaic=1.0 flipud=0.0
   ```
   (Disable vertical flip — manga text doesn't appear upside-down.)

2. **Use transfer learning.** Starting from `yolov8n.pt` (pre-trained on COCO) gives you feature extraction for free. Your 6 images only need to teach the model *what manga text looks like*.

3. **More data always helps.** Even 20-30 labeled pages will dramatically improve robustness. Consider labeling a few pages from each manga series you want to support.

4. **Freeze early layers** to prevent overfitting on tiny datasets:
   ```bash
   yolo detect train ... freeze=10
   ```

---

## Appendix: Training a Bubble Segmentor

The same YOLO workflow applies for training a custom speech bubble segmentor, but using
**instance segmentation** instead of detection:

```bash
yolo segment train \
  model=yolov8n-seg.pt \
  data=dataset/manga_bubbles.yaml \
  epochs=100 \
  imgsz=1600 \
  batch=2 \
  name=manga-bubble-seg
```

Labels for segmentation use polygon format instead of bounding boxes:
```
<class_id> <x1> <y1> <x2> <y2> <x3> <y3> ... <xN> <yN>
```
All coordinates are normalized (0.0 to 1.0). Use [Roboflow](https://roboflow.com/) or
[CVAT](https://www.cvat.ai/) to draw polygon masks around bubble shapes.

The current pipeline uses `manga109-segmentation-bubble` (99%+ mAP on Manga109 data).
Custom training is only needed if you encounter manga styles with unusual bubble shapes
that the pre-trained model cannot handle.

---

## Appendix: Current Pipeline Architecture

For context, the full pipeline uses three models (see `instructions before you proceed.md`):

1. **Model A** — comic-text-detector (ONNX): text boxes + pixel seg mask
2. **Model B** — manga109-segmentation-bubble (YOLOv11n-seg): speech bubble masks
3. **Model C** — LaMa (ONNX): deep learning inpainting

A custom YOLO text detector (this guide) would replace only Model A's bounding box output.
The seg mask and LaMa inpainting would still be needed for high-quality text removal.
