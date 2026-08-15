"""Turn the downloaded archives into one labelled training set.

Two sources, deliberately combined, because neither is sufficient alone:

* **VegNet** (Mendeley, CC BY, DOI 10.17632/6nxnjbn9w6.1) has tomato and bell
  pepper photographed on a phone at many angles and under mixed indoor and
  outdoor light, graded Unripe / Ripe / Old / Dried / Damaged. It is a good
  match for how a farmer will actually hold a phone. Its weakness is that
  **Damaged has 27 tomato and 31 pepper images** - the single class the app
  most needs to get right is the one with almost no examples.

* **Fruit and Vegetable Disease** (Kaggle) contributes healthy and rotten
  images for the same two crops, which is what fills that hole.

Two label heads come out of this, because the app asks two different questions:

    crop   - tomato | bell_pepper | other_produce
    stage  - unripe | fresh | ageing | spoiled

`other_produce` is the two chilli varieties in VegNet. It is not padding: a
classifier trained only on tomato and pepper must answer "tomato or pepper" for
a photograph of a chilli, and being able to say "produce, but not one of mine"
is worth a class of its own.

What is deliberately **not** here is a `not_produce` class. There are no
photographs of hands, walls or floors in either source, and inventing them from
flat colour fields would teach the model something the classical validity gates
already handle better. Out-of-distribution rejection is left to those gates, to
the confidence threshold, and to the farmer confirming the crop.
"""

from __future__ import annotations

import collections
import random
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / "data" / "raw" / "New VegNet"
KAGGLE = HERE / "data" / "kaggle"
OUT = HERE / "data" / "prepared"

SEED = 20260814
VAL_FRACTION = 0.15
TEST_FRACTION = 0.15

# VegNet folder -> (crop, stage).
#
# "Dried" is mapped to ageing rather than spoiled: a shrivelled, dehydrated
# pepper has lost condition but is not rotten, and calling it spoiled would
# teach the model to condemn produce a farmer could still sell.
VEGNET = {
    ("1. Bell Pepper", "Unripe"): ("bell_pepper", "unripe"),
    ("1. Bell Pepper", "Ripe"): ("bell_pepper", "fresh"),
    ("1. Bell Pepper", "Old"): ("bell_pepper", "ageing"),
    ("1. Bell Pepper", "Dried"): ("bell_pepper", "ageing"),
    ("1. Bell Pepper", "Damaged"): ("bell_pepper", "spoiled"),
    ("4. Tomato", "Unripe"): ("tomato", "unripe"),
    ("4. Tomato", "Ripe"): ("tomato", "fresh"),
    ("4. Tomato", "Old"): ("tomato", "ageing"),
    ("4. Tomato", "Damaged"): ("tomato", "spoiled"),
    ("2. Chile Pepper", "Unripe"): ("other_produce", "unripe"),
    ("2. Chile Pepper", "Ripe"): ("other_produce", "fresh"),
    ("2. Chile Pepper", "Old"): ("other_produce", "ageing"),
    ("2. Chile Pepper", "Dried"): ("other_produce", "ageing"),
    ("2. Chile Pepper", "Damaged"): ("other_produce", "spoiled"),
    ("3. New Mexico Green Chile", "Unripe"): ("other_produce", "unripe"),
    ("3. New Mexico Green Chile", "Ripe"): ("other_produce", "fresh"),
    ("3. New Mexico Green Chile", "Old"): ("other_produce", "ageing"),
    ("3. New Mexico Green Chile", "Dried"): ("other_produce", "ageing"),
    ("3. New Mexico Green Chile", "Damaged"): ("other_produce", "spoiled"),
}

# Kaggle folder name fragment -> (crop, stage). Matched case-insensitively.
KAGGLE_MAP = {
    "tomato__healthy": ("tomato", "fresh"),
    "tomato__rotten": ("tomato", "spoiled"),
    "bellpepper__healthy": ("bell_pepper", "fresh"),
    "bellpepper__rotten": ("bell_pepper", "spoiled"),
    "bell pepper__healthy": ("bell_pepper", "fresh"),
    "bell pepper__rotten": ("bell_pepper", "spoiled"),
    "capsicum__healthy": ("bell_pepper", "fresh"),
    "capsicum__rotten": ("bell_pepper", "spoiled"),
}


def collect() -> list[tuple[Path, str, str]]:
    items: list[tuple[Path, str, str]] = []

    if RAW.exists():
        for (folder, stage_dir), (crop, stage) in VEGNET.items():
            d = RAW / folder / stage_dir
            if not d.is_dir():
                print(f"  missing in VegNet: {folder}/{stage_dir}")
                continue
            for f in sorted(d.glob("*.jpg")):
                items.append((f, crop, stage))
    else:
        print("  VegNet not found at", RAW)

    if KAGGLE.exists():
        for d in sorted(p for p in KAGGLE.rglob("*") if p.is_dir()):
            key = d.name.lower().replace("_", "_").strip()
            match = None
            for frag, label in KAGGLE_MAP.items():
                if key == frag or key.replace(" ", "") == frag.replace(" ", ""):
                    match = label
                    break
            if not match:
                continue
            crop, stage = match
            for f in sorted(list(d.glob("*.jpg")) + list(d.glob("*.png")) + list(d.glob("*.jpeg"))):
                items.append((f, crop, stage))
    else:
        print("  Kaggle set not found at", KAGGLE, "- continuing with VegNet only")

    return items


def main() -> None:
    print("collecting ...")
    items = collect()
    if not items:
        raise SystemExit("no images found - run the downloads first")

    counts = collections.Counter((c, s) for _, c, s in items)
    print(f"\n{len(items)} images")
    print(f"\n{'crop':16s}{'stage':10s}{'count':>8s}")
    for (crop, stage), n in sorted(counts.items()):
        print(f"{crop:16s}{stage:10s}{n:8d}")

    # Split per (crop, stage) so every class keeps its proportions in all three
    # splits - with 27 damaged tomatoes, a random split could leave the test set
    # with none of them and report a meaningless score.
    rng = random.Random(SEED)
    by_class: dict[tuple[str, str], list[Path]] = collections.defaultdict(list)
    for path, crop, stage in items:
        by_class[(crop, stage)].append(path)

    if OUT.exists():
        shutil.rmtree(OUT)

    split_counts: collections.Counter[str] = collections.Counter()
    for (crop, stage), paths in by_class.items():
        paths = sorted(paths)
        rng.shuffle(paths)
        n = len(paths)
        n_test = max(1, round(n * TEST_FRACTION)) if n >= 4 else 0
        n_val = max(1, round(n * VAL_FRACTION)) if n >= 4 else 0
        parts = {
            "test": paths[:n_test],
            "val": paths[n_test:n_test + n_val],
            "train": paths[n_test + n_val:],
        }
        for split, group in parts.items():
            dest = OUT / split / f"{crop}__{stage}"
            dest.mkdir(parents=True, exist_ok=True)
            for i, src in enumerate(group):
                shutil.copy2(src, dest / f"{i:05d}{src.suffix.lower()}")
                split_counts[split] += 1

    print("\nsplit sizes:", dict(split_counts))
    print("written to", OUT)


if __name__ == "__main__":
    main()
