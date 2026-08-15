"""Train the produce classifier.

One MobileNetV3-small backbone, two heads:

    crop   - tomato | bell_pepper | other_produce
    stage  - unripe | fresh | ageing | spoiled

Two heads rather than one twelve-way softmax, for a reason that matters with
this data: the stage head sees *every* crop's spoiled examples, not just its
own. Bell pepper contributes 622 spoiled images and tomato 622; a single
combined label would keep those two piles apart, and both are small enough that
sharing them is worth having.

Chosen for a laptop with no GPU:

* **MobileNetV3-small** - 1.5M parameters, 13 ms per image on this CPU, and
  296 KB once exported to ONNX. It is the largest model that can honestly be
  described as shippable inside a static offline bundle.
* **ImageNet initialisation, then fine-tuned end to end.** With ~6,000 training
  images, training from scratch would overfit long before it learned edges.
* **Colour jitter that is deliberately strong.** Every other augmentation is
  routine, but lighting is the single biggest source of error in the field -
  the same tomato under a tin roof at noon and in shade at dusk must land in
  the same class - so brightness, contrast and saturation are pushed hard.
* **Class-weighted loss.** Bell pepper unripe has 52 examples against bell
  pepper fresh's 1,059. Unweighted, the model would learn to never say unripe
  and still score well.

Run:  python train.py            (about an hour on CPU)
"""

from __future__ import annotations

import json
import time
from collections import Counter
from pathlib import Path

import torch
import torchvision
from torch import nn
from torch.utils.data import DataLoader
from torchvision import transforms
from torchvision.datasets import ImageFolder

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "prepared"
OUT = HERE / "artifacts"

CROPS = ["bell_pepper", "other_produce", "tomato"]
STAGES = ["ageing", "fresh", "spoiled", "unripe"]

SIZE = 176
BATCH = 32
EPOCHS = 10
WARMUP_EPOCHS = 2          # heads only, backbone frozen
LR_HEAD = 3e-3
LR_BACKBONE = 3e-4
SEED = 20260814

torch.manual_seed(SEED)


def split_label(folder_name: str) -> tuple[int, int]:
    crop, stage = folder_name.split("__")
    return CROPS.index(crop), STAGES.index(stage)


class TwoHeadDataset(torch.utils.data.Dataset):
    """Wraps ImageFolder so each item carries both labels."""

    def __init__(self, root: Path, tf):
        self.inner = ImageFolder(root, transform=tf)
        self.pairs = [split_label(c) for c in self.inner.classes]

    def __len__(self) -> int:
        return len(self.inner)

    def __getitem__(self, i):
        x, folder_idx = self.inner[i]
        crop, stage = self.pairs[folder_idx]
        return x, crop, stage


NORMALISE = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

TRAIN_TF = transforms.Compose([
    transforms.RandomResizedCrop(SIZE, scale=(0.6, 1.0), ratio=(0.8, 1.25)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(p=0.2),
    transforms.RandomRotation(20),
    # Lighting is the thing that breaks this in the field, so it is attacked
    # harder than anything else.
    transforms.ColorJitter(brightness=0.4, contrast=0.35, saturation=0.35, hue=0.04),
    transforms.ToTensor(),
    NORMALISE,
])

EVAL_TF = transforms.Compose([
    transforms.Resize(int(SIZE * 1.14)),
    transforms.CenterCrop(SIZE),
    transforms.ToTensor(),
    NORMALISE,
])


class TwoHeadNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        weights = torchvision.models.MobileNet_V3_Small_Weights.IMAGENET1K_V1
        base = torchvision.models.mobilenet_v3_small(weights=weights)
        self.features = base.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        hidden = base.classifier[0].in_features
        self.trunk = nn.Sequential(
            nn.Linear(hidden, 256), nn.Hardswish(), nn.Dropout(0.25)
        )
        self.crop_head = nn.Linear(256, len(CROPS))
        self.stage_head = nn.Linear(256, len(STAGES))

    def forward(self, x):
        z = self.pool(self.features(x)).flatten(1)
        z = self.trunk(z)
        return self.crop_head(z), self.stage_head(z)


def class_weights(counts: Counter, labels: list[str]) -> torch.Tensor:
    total = sum(counts.values())
    w = [total / (len(labels) * max(1, counts[i])) for i in range(len(labels))]
    return torch.tensor(w, dtype=torch.float32)


def macro_f1(confusion: torch.Tensor) -> float:
    f1s = []
    for i in range(confusion.size(0)):
        tp = confusion[i, i].item()
        fp = confusion[:, i].sum().item() - tp
        fn = confusion[i, :].sum().item() - tp
        if tp == 0:
            f1s.append(0.0)
            continue
        precision = tp / (tp + fp)
        recall = tp / (tp + fn)
        f1s.append(2 * precision * recall / (precision + recall))
    return sum(f1s) / len(f1s)


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    cm_crop = torch.zeros(len(CROPS), len(CROPS), dtype=torch.long)
    cm_stage = torch.zeros(len(STAGES), len(STAGES), dtype=torch.long)
    for x, crop, stage in loader:
        pc, ps = model(x.to(device))
        for t, p in zip(crop, pc.argmax(1).cpu()):
            cm_crop[t, p] += 1
        for t, p in zip(stage, ps.argmax(1).cpu()):
            cm_stage[t, p] += 1
    return cm_crop, cm_stage


def report(name: str, cm: torch.Tensor, labels: list[str]) -> dict:
    total = cm.sum().item()
    correct = cm.diag().sum().item()
    acc = correct / max(1, total)
    print(f"\n  {name}: accuracy {acc*100:.1f}%   macro-F1 {macro_f1(cm)*100:.1f}%")
    print(f"    {'class':16s}{'n':>6s}{'recall':>9s}{'precision':>11s}")
    per = {}
    for i, label in enumerate(labels):
        n = cm[i].sum().item()
        tp = cm[i, i].item()
        recall = tp / n if n else 0.0
        col = cm[:, i].sum().item()
        precision = tp / col if col else 0.0
        per[label] = {"n": n, "recall": round(recall, 4), "precision": round(precision, 4)}
        print(f"    {label:16s}{n:6d}{recall*100:8.1f}%{precision*100:10.1f}%")
    return {"accuracy": round(acc, 4), "macro_f1": round(macro_f1(cm), 4), "per_class": per}


def main() -> None:
    device = torch.device("cpu")
    OUT.mkdir(exist_ok=True)

    train_ds = TwoHeadDataset(DATA / "train", TRAIN_TF)
    val_ds = TwoHeadDataset(DATA / "val", EVAL_TF)
    test_ds = TwoHeadDataset(DATA / "test", EVAL_TF)
    print(f"train {len(train_ds)}  val {len(val_ds)}  test {len(test_ds)}")

    # Zero workers on purpose. Windows spawns rather than forks, and for
    # 256-pixel JPEGs the decode is cheap enough that the spawn overhead
    # costs more than the parallelism returns - measured at roughly 25%
    # CPU utilisation with four workers against near-full without them.
    workers = 0
    train_dl = DataLoader(train_ds, batch_size=BATCH, shuffle=True, num_workers=workers, drop_last=True)
    val_dl = DataLoader(val_ds, batch_size=64, num_workers=workers)
    test_dl = DataLoader(test_ds, batch_size=64, num_workers=workers)

    crop_counts = Counter()
    stage_counts = Counter()
    for c, s in (train_ds.pairs[i] for i in train_ds.inner.targets):
        crop_counts[c] += 1
        stage_counts[s] += 1

    crop_loss = nn.CrossEntropyLoss(weight=class_weights(crop_counts, CROPS).to(device),
                                    label_smoothing=0.05)
    stage_loss = nn.CrossEntropyLoss(weight=class_weights(stage_counts, STAGES).to(device),
                                     label_smoothing=0.05)

    model = TwoHeadNet().to(device)

    head_params = list(model.trunk.parameters()) + list(model.crop_head.parameters()) + \
        list(model.stage_head.parameters())
    optimiser = torch.optim.AdamW(
        [{"params": head_params, "lr": LR_HEAD},
         {"params": model.features.parameters(), "lr": LR_BACKBONE}],
        weight_decay=1e-4,
    )
    schedule = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=EPOCHS)

    best = -1.0
    history = []

    for epoch in range(1, EPOCHS + 1):
        frozen = epoch <= WARMUP_EPOCHS
        for p in model.features.parameters():
            p.requires_grad = not frozen

        model.train()
        started = time.time()
        running = 0.0
        seen = 0
        batches = len(train_dl)
        for step, (x, crop, stage) in enumerate(train_dl, 1):
            x, crop, stage = x.to(device), crop.to(device), stage.to(device)
            pc, ps = model(x)
            # The stage is what the farmer acts on, so it carries more weight.
            loss = crop_loss(pc, crop) + 1.3 * stage_loss(ps, stage)
            optimiser.zero_grad()
            loss.backward()
            optimiser.step()
            running += loss.item() * x.size(0)
            seen += x.size(0)
            if step % 40 == 0 or step == batches:
                print(f'    epoch {epoch} step {step}/{batches} loss {running/seen:.3f}', flush=True)
        schedule.step()

        cm_crop, cm_stage = evaluate(model, val_dl, device)
        score = (macro_f1(cm_crop) + macro_f1(cm_stage)) / 2
        history.append({"epoch": epoch, "loss": round(running / seen, 4),
                        "val_score": round(score, 4)})
        flag = ""
        if score > best:
            best = score
            torch.save(model.state_dict(), OUT / "best.pt")
            flag = "  <- best"
        print(f"epoch {epoch:2d}/{EPOCHS}  loss {running/seen:.3f}  "
              f"val macro-F1 {score*100:.1f}%  {time.time()-started:.0f}s{flag}"
              f"{'  (backbone frozen)' if frozen else ''}")

    print("\n" + "=" * 62)
    print("FINAL - held-out test set, never seen during training")
    print("=" * 62)
    model.load_state_dict(torch.load(OUT / "best.pt"))
    cm_crop, cm_stage = evaluate(model, test_dl, device)
    metrics = {
        "crop": report("crop", cm_crop, CROPS),
        "stage": report("stage", cm_stage, STAGES),
        "history": history,
        "train_size": len(train_ds), "val_size": len(val_ds), "test_size": len(test_ds),
    }
    print("\n  crop confusion (rows = truth)\n   ", CROPS)
    for i, row in enumerate(cm_crop.tolist()):
        print(f"    {CROPS[i]:16s}{row}")
    print("\n  stage confusion (rows = truth)\n   ", STAGES)
    for i, row in enumerate(cm_stage.tolist()):
        print(f"    {STAGES[i]:16s}{row}")

    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("\nsaved", OUT / "best.pt", "and metrics.json")


if __name__ == "__main__":
    main()
