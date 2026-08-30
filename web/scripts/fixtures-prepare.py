"""Decode the held-out fixtures and run the model on them, without a browser.

The Chromium driven checks stopped being usable on this machine, so the vision
pipeline is exercised in Node instead. Node has no canvas and no image decoder,
so this script supplies both halves of what the browser used to provide:

  · the pixels, decoded and resized to exactly the working size vision.js asks
    for, so the Node side never has to resample and cannot diverge from what
    canvas would have produced;

  · the model's answer, from the same ONNX graph the browser loads, through the
    same preprocessing the training script used.

Writes into scripts/.fixtures/ which is disposable and git-ignored.

    python scripts/fixtures-prepare.py
"""

import json
import pathlib

import numpy as np
import onnxruntime as ort
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
WEB = HERE.parent
FIXTURES = WEB / "public" / "fixtures"
MODEL_DIR = WEB / "public" / "model"
OUT = HERE / ".fixtures"

WORK_SIZE = 192  # must match WORK_SIZE in src/lib/vision.js

meta = json.loads((MODEL_DIR / "produce.json").read_text(encoding="utf-8"))
session = ort.InferenceSession(str(MODEL_DIR / "produce.onnx"), providers=["CPUExecutionProvider"])

size = meta["inputSize"]
mean = np.array(meta["mean"], dtype=np.float32).reshape(3, 1, 1)
std = np.array(meta["std"], dtype=np.float32).reshape(3, 1, 1)


def preprocess(img):
    """Resize short side to 1.14x then centre crop, exactly as eval did."""
    short = round(size * 1.14)
    w, h = img.size
    scale = short / min(w, h)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.BILINEAR)
    w, h = img.size
    left, top = (w - size) // 2, (h - size) // 2
    img = img.crop((left, top, left + size, top + size))
    x = np.asarray(img, dtype=np.float32).transpose(2, 0, 1) / 255.0
    return ((x - mean) / std)[None, ...]


def softmax(v):
    e = np.exp(v - v.max())
    return e / e.sum()


OUT.mkdir(exist_ok=True)
predictions = {}
manifest = {}

for path in sorted(FIXTURES.glob("*.jpg")):
    name = path.name
    img = Image.open(path).convert("RGB")

    # Pixels at the working size, so the Node canvas shim only ever copies.
    height = max(1, round(WORK_SIZE * img.height / img.width))
    work = img.resize((WORK_SIZE, height), Image.BILINEAR)
    rgba = np.dstack([np.asarray(work), np.full((height, WORK_SIZE, 1), 255, np.uint8)])
    (OUT / f"{name}.bin").write_bytes(rgba.astype(np.uint8).tobytes())
    manifest[name] = {"width": WORK_SIZE, "height": height, "bin": f"{name}.bin"}

    outputs = session.run(None, {"image": preprocess(img)})
    names = [o.name for o in session.get_outputs()]
    crop_probs = softmax(outputs[names.index("crop_logits")][0])
    stage_probs = softmax(outputs[names.index("stage_logits")][0])

    crop = meta["crops"][int(crop_probs.argmax())]
    stage = meta["stages"][int(stage_probs.argmax())]

    expected_quality = float(
        sum(p * meta.get("stageQuality", {}).get(s, 50) for s, p in zip(meta["stages"], stage_probs))
    )
    expected_shelf = float(
        sum(
            p * meta.get("shelfLifeDays", {}).get(crop, {}).get(s, 0)
            for s, p in zip(meta["stages"], stage_probs)
        )
    )

    predictions[name] = {
        "crop": crop,
        "stage": stage,
        # The expectation over stages - what model.js now computes in the
        # browser. Recorded here so the Node harness reconciles the very same
        # numbers the app would.
        "expectedFreshness": round(expected_quality, 1),
        "expectedRemainingDays": round(expected_shelf, 1),
        "cropConfidence": round(float(crop_probs.max()) * 100),
        "stageConfidence": round(float(stage_probs.max()) * 100),
        "remainingDays": meta.get("shelfLifeDays", {}).get(crop, {}).get(stage),
        "freshness": meta.get("stageQuality", {}).get(stage),
        "cropProbabilities": {c: round(float(p) * 100) for c, p in zip(meta["crops"], crop_probs)},
        "stageProbabilities": {s: round(float(p) * 100) for s, p in zip(meta["stages"], stage_probs)},
        "accuracy": meta.get("testAccuracy"),
    }

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
(OUT / "predictions.json").write_text(json.dumps(predictions, indent=2), encoding="utf-8")

stub = f'''export async function classifyProduce() {{
  const all = {json.dumps(predictions)}
  return all[globalThis.__fixture] ?? null
}}
export function preloadModel() {{}}
export function modelState() {{
  return {{ ready: true, failed: false, reason: null, meta: null }}
}}
export const MODEL_CROP_TO_APP = {{ tomato: 'tomato', bell_pepper: 'capsicum' }}
'''
(OUT / "model-stub.mjs").write_text(stub, encoding="utf-8")

print(f"prepared {len(manifest)} fixtures at {WORK_SIZE}px + model predictions")
for name, p in predictions.items():
    print(f"  {name:<22} {p['crop']:<14}{p['cropConfidence']:>3}%   {p['stage']:<8}{p['stageConfidence']:>3}%")
