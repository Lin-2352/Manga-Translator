# Free Manga Translator — Architectural Upgrade Plan

Date: 2026-04-05  
Owner role: Principal ML Architect  
Scope: Planning only (no code changes yet)

---

## 1) Goal

Upgrade the current CUDA-only triple-model pipeline to fix two production blockers:

1. **Floating Text Flaw**: not all floating text is SFX; floating dialogue must be erased and translated.
2. **Bubble Smudge Flaw**: tight text masks leave anti-aliased ink edges, causing residual smudges after inpainting.

Required upgrade:
- Add **semantic text classification** (`dialogue` vs `onomatopoeia`) in Model A routing.
- Add **dynamic anti-smudge masking** that adapts dilation by context (inside bubble vs over art).

---

## 2) Current Baseline (as implemented)

Current `ml_region_lib.py` pipeline:

1. **Model A** (`comictextdetector.pt.onnx`) detects text boxes + pixel text segmentation mask.
2. **Model B** (`manga109-segmentation-bubble`, YOLOv11n-seg) detects bubble instance masks.
3. Intersection classifies text boxes as:
   - `bubble_text` if overlap >= 50%
   - `floating_text` otherwise
4. Only `bubble_text` is sent to **Model C** (LaMa ONNX) for erasure.
5. `floating_text` is always skipped to protect artwork.

Consequence:
- Misses floating conversational dialogue.
- Bubble erasure can leave edge ghosts/smudges.

---

## 3) Model A Semantic Upgrade (Found Candidate)

## Recommended semantic detector candidate

- **Model**: `mnemic/comic_speechbubble_yolov8` (Hugging Face, YOLOv8 PyTorch checkpoints)
- **Checkpoint files observed**:
  - `comic_speechbubble_m_yolov8_v1.pt`
  - `comic_speechbubble_s_yolov8_v1.pt`
- **Training dataset lineage** references `yolomanga/speechballoon_comic` classes:
  - `General_speech`
  - `narration speech`
  - `thought_speech`
  - `blast_sound`
  - `hit_sound`
  - `Roar`

### Semantic mapping to project routing

- `General_speech`, `narration speech`, `thought_speech` -> `dialogue`
- `blast_sound`, `hit_sound`, `Roar` -> `onomatopoeia`

### Important risk note

- Model/source notes indicate possible **research-only or uncertain commercial provenance** from comic imagery.
- Architecture-wise this solves the classification requirement now.
- For long-term production/commercial safety, plan a follow-up retraining on clearly licensed data with equivalent label schema.

---

## 4) New Routing Logic (Semantic-first)

Routing must no longer depend only on bubble overlap.

### Stage A — semantic gate

For each text detection from semantic Model A:

1. Read class label + confidence.
2. Map label to `dialogue` or `onomatopoeia`.
3. If `onomatopoeia` -> `skip_protect` immediately (never inpaint).
4. If `dialogue` -> continue to contextual masking path.

### Stage B — contextual sub-routing for dialogue only

Compute bubble context score:

$\rho_i = \frac{|B_i \cap U_{bubble}|}{|B_i| + \epsilon}$

Where:
- $B_i$ = dialogue box or seed-mask support for instance $i$
- $U_{bubble}$ = union bubble mask

Then route:
- `dialogue` + safely inside bubble -> `erase_bubble_aggressive`
- `dialogue` + floating/edge-near art -> `erase_floating_precise`

Final routes:
- `skip_protect` (onomatopoeia)
- `erase_bubble_aggressive` (dialogue, safe in bubble)
- `erase_floating_precise` (dialogue, over artwork)

---

## 5) Dynamic Anti-Smudge Masking (OpenCV math plan)

Because semantic detector outputs boxes (not pixel-perfect text masks), build per-instance masks from image evidence and adapt dilation by context.

## Step 5.1 — Build tight seed mask in each dialogue ROI

For each dialogue ROI $R_i$:

1. Convert to grayscale; apply local contrast normalization (CLAHE).
2. Adaptive dark-ink extraction:

$M_t(x,y) = \mathbf{1}[I(x,y) < \mu_{\mathcal{N}(x,y)} - C]$

3. Canny edges -> $E_i$.
4. Seed union:

$M_0 = M_t \lor E_i$

5. Morph close (`3x3` ellipse) + connected-component filtering:
   - drop tiny noise
   - drop implausibly large blobs

Output seed mask: $M_1$ (tight and text-centric)

## Step 5.2 — Compute safety/complexity signals

For each dialogue instance:

1. Bubble containment (on seed):

$\rho_i = \frac{|M_1 \cap U_i|}{|M_1| + \epsilon}$

2. Distance to bubble boundary using distance transform:

$d_i = \text{median}(\text{DT}(U_i) \mid M_1 = 1)$

3. Local art complexity in ring around ROI (Sobel magnitude normalized):

$\kappa_i = \frac{\text{mean}(|\nabla I|_{ring})}{255}$

## Step 5.3 — Dynamic dilation radius (anti-smudge control)

Base radius by bubble safety:

$ r_{base} =
\begin{cases}
5, & \rho_i \ge 0.90 \;\land\; d_i \ge 8 \\
3, & \rho_i \ge 0.70 \\
1, & 0.45 \le \rho_i < 0.70 \\
0, & \rho_i < 0.45
\end{cases}
$

Texture-aware reduction to protect artwork:

$ r_i = \max(0,\; r_{base} - \lfloor 2.5\kappa_i \rfloor ) $

Apply dilation with ellipse kernel size $(2r_i+1)$:

$ M_2 = \text{dilate}(M_1, \text{ellipse}(2r_i+1), 1) $

## Step 5.4 — Route-specific finishing

### A) Bubble aggressive path (`erase_bubble_aggressive`)

Swallow anti-aliased fringes via morphological gradient halo:

$ H = \text{morph\_gradient}(M_2, \text{ellipse}(3)) $

$ M_{final} = M_2 \lor H $

Goal: zero visible ink ghosts in bubble interiors.

### B) Floating precise path (`erase_floating_precise`)

Constrain to stable core to avoid over-erasing line art/screentones:

$ C = \mathbf{1}(\text{DT}(M_1) \ge 1) $

$ M_{final} = M_2 \land C $

Goal: remove dialogue while minimizing collateral art damage.

### C) Onomatopoeia path (`skip_protect`)

$ M_{final} = \varnothing $

No inpainting is performed.

### Final LaMa mask

$ M_{lama} = \bigcup M_{final}^{dialogue-only} $

Only dialogue contributes to LaMa erasure mask.

---

## 6) `ml_region_lib.py` Refactor Plan (no code yet)

1. **Config additions**
   - semantic model path and class-map
   - thresholds for $\rho_i$, $d_i$, $\kappa_i$
   - dynamic dilation parameters

2. **Detection output schema changes**
   - carry `class_name`, `class_conf`, `semantic_type`
   - carry `route_type` for each region

3. **Routing refactor**
   - replace binary bubble/floating erasure gate with semantic-first + contextual sub-routing

4. **Mask synthesis module**
   - implement per-ROI seed extraction
   - implement dynamic dilation and route-specific finishing

5. **LaMa integration update**
   - compose global mask from dialogue routes only
   - guarantee onomatopoeia exclusion

6. **Debug/reporting update**
   - route-colored overlays:
     - skipped onomatopoeia
     - aggressive bubble dialogue
     - precise floating dialogue
   - JSON report counts per route

---

## 7) Validation & Acceptance Criteria

## Functional checks

1. **Onomatopoeia protection**
   - SFX labels never enter LaMa mask.

2. **Floating dialogue handling**
   - Dialogue outside bubbles is no longer globally skipped.

3. **Bubble anti-smudge quality**
   - Edge ghosts significantly reduced in bubble interiors.

4. **Artwork preservation**
   - Floating dialogue erasure shows lower collateral damage than fixed dilation.

## Quantitative metrics (recommended)

- Residual text pixel ratio in erased regions
- Structural similarity outside mask (collateral damage proxy)
- Route confusion matrix on manually labeled sample pages
- Route-wise false erase rate (especially SFX)

## A/B protocol

Compare current pipeline vs upgraded pipeline on sample set:
- same pages
- same GPU (RTX 4060)
- same LaMa backend
- evaluate route-level behavior and visual artifacts

---

## 8) Risks and Mitigations

1. **License/commercial uncertainty of found semantic model**
   - Mitigation: treat current model as architecture bootstrap; retrain equivalent model on clearly licensed data if needed.

2. **Class taxonomy mismatch across datasets**
   - Mitigation: explicit class remap table in config; reject unknown classes by default (`skip_protect`).

3. **Over-dilation near art boundaries**
   - Mitigation: complexity-aware radius reduction and precise-path core clamp.

4. **Threshold sensitivity across art styles**
   - Mitigation: expose all thresholds in config and tune with route-aware reports.

---

## 9) Implementation Sequence (next execution order)

1. Integrate semantic detector loading + inference abstraction.
2. Add class remap and semantic routing state.
3. Add dynamic mask builder and route-specific mask post-processing.
4. Replace selective erase logic with route-aware mask composition.
5. Expand debug visualizations and per-route reporting.
6. Run A/B evaluation on sample suite; tune thresholds.

---

## 10) Completion status for this deliverable

- [x] Investigated current pipeline implementation.
- [x] Researched available open-source model candidates.
- [x] Identified practical semantic candidate and class mapping.
- [x] Designed semantic-first routing logic.
- [x] Designed OpenCV dynamic anti-smudge masking math.
- [x] Defined `ml_region_lib.py` refactor plan and validation protocol.

No code changes were made in this planning step.
