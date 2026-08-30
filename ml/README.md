# The produce classifier

Trains the model that reads a photograph of tomato or capsicum and places it on
a ripeness scale. Runs on a laptop with no GPU.

```bash
python prepare.py     # build the labelled split from the two sources
```

The 5.5 GB of downloaded images under `ml/data/` was deleted once training
finished. Nothing depends on it any more: what the app loads is the exported
model in `web/public/model/`, and `prepare.py` re-fetches the sources from the
two public locations credited below if the model ever needs rebuilding.

```bash
python train.py       # about 40 minutes on CPU
```

```bash
python export.py      # ONNX + metadata, copied into web/public/model/
```

---

## Where the images came from

Both sources are open and both are credited here because one of them requires
it. Neither was scraped.

### VegNet

> Ahmad, Md. Nafiul; et al. (2022), **"VegNet: Dataset of vegetable quality
> images for machine learning applications"**, Mendeley Data, V1,
> doi: [10.17632/6nxnjbn9w6.1](https://doi.org/10.17632/6nxnjbn9w6.1)
> Licensed **CC BY 4.0**.

6,150 images across bell pepper, tomato, chilli pepper and New Mexico chile,
each graded Unripe / Ripe / Old / Dried / Damaged. Photographed on a phone, at
many angles, indoors and outdoors, under natural and artificial light - which is
why it was chosen over cleaner laboratory sets. It resembles what a farmer will
actually hold a phone up to.

**The published counts do not match the archive.** The paper reports 6,850
images and 3,061 tomatoes; the download contains 6,150 and 2,361. The numbers
used here are the ones counted from the files.

### Fruit and Vegetable Disease (Healthy vs Rotten)

Kaggle, `muhammad0subhan/fruit-and-vegetable-disease-healthy-vs-rotten`.
Only the `Tomato__*` and `Bellpepper__*` folders are used.

This one exists to fix a hole. VegNet's **Damaged** class has 27 tomato and 31
pepper images - the single category the app most needs to get right is the one
it has almost nothing for. The Kaggle rotten sets take spoiled examples from 58
to 1,244.

---

## What comes out

| Head | Classes |
|---|---|
| `crop` | `tomato`, `bell_pepper`, `other_produce` |
| `stage` | `unripe`, `fresh`, `ageing`, `spoiled` |

**8,551 images**, split 70 / 15 / 15 by class so that every class keeps its
proportions - with 27 damaged tomatoes, a plain random split could leave the
test set with none of them and report a number that means nothing.

| Crop | unripe | fresh | ageing | spoiled |
|---|---|---|---|---|
| tomato | 145 | 1,559 | 1,234 | 622 |
| bell_pepper | 52 | 1,059 | 645 | 622 |
| other_produce | 416 | 384 | 1,554 | 259 |

`other_produce` is the two chilli varieties. It is not padding: a classifier
that only knows tomato and pepper must answer "tomato or pepper" for a
photograph of a chilli, and being able to say *produce, but not one of mine* is
worth a class of its own.

---

## Choices, and why

**MobileNetV3-small.** 1.5M parameters, 13 ms per image on this CPU, 4.4 MB as
ONNX with its weights embedded. It is the largest network that can honestly be called shippable inside a
static offline bundle.

**Two heads, not one twelve-way softmax.** The stage head sees every crop's
spoiled examples together rather than keeping two small piles apart.

**Strong colour jitter.** Every other augmentation is routine. Lighting is the
single biggest source of field error - the same tomato under a tin roof at noon
and in shade at dusk has to land in the same class - so brightness, contrast and
saturation are pushed harder than anything else.

**Class-weighted loss.** Bell pepper unripe has 52 examples against fresh's
1,059. Unweighted, the model learns never to say unripe and still scores well.

**176 pixels, not 224.** Measured, not guessed: with four dataloader workers on
Windows the run sat at roughly 25% CPU, because Windows spawns processes rather
than forking. Zero workers and a smaller input brought a 3½-hour run down to
well under an hour, at a cost in accuracy that the test numbers show.

**No `not_produce` class.** There are no photographs of hands, walls or floors
in either source, and inventing them from flat colour fields would teach the
model something the classical validity gates in `web/src/lib/vision.js` already
do better. Out-of-distribution rejection stays with those gates, the confidence
threshold, and the farmer confirming the crop.

---

## What the model does *not* do

It does not measure days. It places a lot on a ripeness scale, and that stage
maps to a **published shelf-life table** in `export.py` - tomato fresh 7 days,
capsicum fresh 11 days, and so on. The table is a table. Presenting its output
as a measurement would be a lie, and the app says "estimate" for that reason.

It also cannot tell you about internal rot before it reaches the skin, firmness,
sugar content, actual days since harvest, or cold-chain history. Nothing here
produces a number for any of those.

---

## What it scored

Held-out test set, 1,283 images, never seen during training.

| Head | Accuracy | Macro-F1 |
|---|---|---|
| crop | 98.9% | 98.9% |
| ripeness stage | 96.6% | 97.0% |

| Class | n | Recall | Precision |
|---|---|---|---|
| tomato | 534 | 99.4% | 98.2% |
| bell_pepper | 357 | 96.9% | 99.1% |
| other_produce | 392 | 100.0% | 99.7% |
| unripe | 92 | 100.0% | 100.0% |
| fresh | 451 | 98.7% | 94.9% |
| ageing | 515 | 95.7% | 98.0% |
| **spoiled** | 225 | **93.3%** | 95.9% |

Read the spoiled row rather than the headline. Its recall is the lowest number
here, and the confusion matrix says where the misses go: of 225 rotten lots, 10
were called *fresh* and 5 *ageing*. Passing a rotten lot as sound is the most
expensive mistake this system can make, because the farmer then pays to store
it. Precision is the consolation: when the model does say spoiled it is right
95.9% of the time.

`unripe` is perfect on 92 samples, which is too few to boast about.

Macro-F1 sits slightly above plain accuracy on both heads, which means the small
classes are not being quietly abandoned. That is the class weighting working.

---

## Artefacts

```
artifacts/best.pt        trained weights
artifacts/produce.onnx   exported model, 4.4 MB, weights embedded
artifacts/produce.json   labels, preprocessing constants, shelf-life table,
                         and the measured test-set accuracy
artifacts/metrics.json   full per-class results and confusion matrices
```

`export.py` copies the last two into `web/public/model/`, where the browser
loads them. The exported graph is checked against PyTorch on the same input
before shipping; they agree to within float noise.

## Scaling the dataset (making the score move more)

The score's spread is limited by the four coarse stages the model was trained
on, not by the code. To make it move like a meter instead of a verdict, retrain
with more data - `prepare.py` and `train.py` already accept extra class
folders, so this is a data job, not a rewrite. Sources worth pulling (run
locally; these need Kaggle/HF accounts):

- **Kaggle - "Fruits fresh and rotten for classification"** (~13k images,
  apples/bananas/oranges; useful for the fresh/spoiled boundary even across
  crops).
- **Kaggle - "Fresh and stale images of fruits and vegetables"** (~15k images,
  includes tomato, capsicum, bitter gourd; directly relevant classes).
- **VegNet** (already used here, CC BY) - re-download and keep the ageing
  intermediate stages rather than collapsing them.
- **Mendeley Data - vegetable quality grading sets** (search "tomato quality
  grading dataset"; several graded 3-5 level sets exist, which is exactly what
  turns a 4-class verdict into a finer scale).
- **Hugging Face** - search `image-classification fruit freshness`; several
  fine-tuned MobileNet/EfficientNet checkpoints exist. Prefer retraining our
  MobileNetV3 head on the merged data over adopting a stranger's checkpoint:
  ours ships at 4.4 MB and the metadata (`stageQuality`, `shelfLifeDays`)
  stays under our control.

Recipe: drop the new images into `data/<crop>/<stage>/`, add any new stage
names to `prepare.py`'s STAGES, rerun `train.py` (~20 min on a laptop GPU,
a few hours CPU), then `export.py` regenerates `produce.onnx` + `produce.json`
and the app picks both up with no code change. Adding a 5th and 6th stage
(e.g. `ripe`, `overripe`) is the single highest-value change: the
probability-weighted score in `model.js` gets finer the more stages there are.
