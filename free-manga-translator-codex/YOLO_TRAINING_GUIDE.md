# YOLO Fine-Tuning Guide for Manga Text Detection

How to train a custom YOLOv8 model on your difficult manga samples (1-6).

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

Copy `runs/detect/manga-text-detector/weights/best.pt` into your project's `models/` folder, then use it with `ml_region_lib.py`:

```bash
python ml_region_lib.py \
  --image sample.png \
  --model models/best.pt \
  --backend yolo \
  --conf 0.35 \
  --padding 8
```

Or in code:

```python
from ml_region_lib import MLConfig, run_pipeline

cfg = MLConfig(
    model_path="models/best.pt",
    backend="yolo",
    confidence_threshold=0.35,
    mask_padding=8,
)
result = run_pipeline("sample.png", cfg)
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
