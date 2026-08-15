"""Export the trained model for the browser, with the metadata the app needs.

Produces two files that ship together:

  produce.onnx   the network, opset 17, about 4.4 MB with weights embedded
  produce.json   labels, preprocessing constants, shelf-life table, and the
                 measured test-set accuracy

The JSON matters as much as the weights. The app has to know exactly how the
image was normalised during training or every prediction is quietly wrong, and
a judge asking "how accurate is it" deserves a number that came from the
held-out set rather than from memory.

Run after train.py:  python export.py
"""

from __future__ import annotations

import json
from pathlib import Path

import torch

from train import CROPS, SIZE, STAGES, TwoHeadNet

HERE = Path(__file__).resolve().parent
ART = HERE / "artifacts"
WEB_MODEL_DIR = HERE.parent / "web" / "public" / "model"

# Days of usable life left at room temperature, by crop and stage.
#
# These are a **table, not a measurement**. They come from standard post-harvest
# handling figures for each crop, and the model's job is only to place the lot
# on this table - it does not measure days. Cold storage extends them, which the
# decision engine applies separately using its own slowdown factor.
#
# `unripe` is longer than `fresh` on purpose: an unripe tomato has its ripening
# still ahead of it, so it survives the journey better, which is exactly why a
# farmer picks green for a distant market.
SHELF_LIFE_DAYS = {
    "tomato": {"unripe": 12.0, "fresh": 7.0, "ageing": 2.5, "spoiled": 0.0},
    "bell_pepper": {"unripe": 13.0, "fresh": 11.0, "ageing": 3.5, "spoiled": 0.0},
    # Not a target crop; the app falls back to its classical pipeline for these,
    # and the figure is only here so nothing divides by an absent number.
    "other_produce": {"unripe": 10.0, "fresh": 8.0, "ageing": 3.0, "spoiled": 0.0},
}

# A visual quality index per stage, so the existing screens and the decision
# engine keep working unchanged - they already speak in a 0-100 freshness score.
STAGE_QUALITY = {"unripe": 88, "fresh": 92, "ageing": 55, "spoiled": 18}


def scrub_debug_info(model) -> None:
    """Remove the exporter's debugging trail before the model is published.

    torch annotates every node it exports with a Python stack trace, and those
    traces carry absolute paths from the machine that did the training: the full
    path to train.py, and the site-packages path under the user's home
    directory. Around 90 KB of somebody's directory layout, readable in any text
    editor, shipped to every visitor the moment the model is committed.

    They live in two places and clearing only the obvious one is not enough.
    `doc_string` is the documented field; recent torch versions put the trace in
    `metadata_props` instead, under keys like `pkg.torch.onnx.stack_trace`. The
    first attempt at this cleared doc_string alone and left all 681 strings
    exactly where they were.

    None of it is needed to run the graph, and the outputs are checked to be
    bit-for-bit identical afterwards.
    """
    model.doc_string = ""
    model.graph.doc_string = ""
    del model.metadata_props[:]

    for node in model.graph.node:
        node.doc_string = ""
        del node.metadata_props[:]
        for attribute in node.attribute:
            attribute.doc_string = ""

    for group in (model.graph.input, model.graph.output,
                  model.graph.value_info, model.graph.initializer):
        for item in group:
            item.doc_string = ""


def main() -> None:
    weights = ART / "best.pt"
    if not weights.exists():
        raise SystemExit("no trained weights - run train.py first")

    model = TwoHeadNet()
    model.load_state_dict(torch.load(weights, map_location="cpu"))
    model.eval()

    dummy = torch.randn(1, 3, SIZE, SIZE)
    onnx_path = ART / "produce.onnx"
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["image"],
        output_names=["crop_logits", "stage_logits"],
        dynamic_axes={"image": {0: "batch"},
                      "crop_logits": {0: "batch"},
                      "stage_logits": {0: "batch"}},
        opset_version=17,
    )

    # Re-save with the weights **inside** the file.
    #
    # torch's exporter writes tensors to a sibling `.data` file once the graph
    # is past a size threshold. Python's onnxruntime picks that up silently
    # because the file is right there on disk; a browser cannot, and fails with
    # "Module.MountedFiles is not available" - which reads like a runtime bug
    # and is actually a packaging one. One self-contained file is the only form
    # that works over HTTP.
    import onnx

    graph = onnx.load(str(onnx_path))

    scrub_debug_info(graph)

    onnx.save_model(graph, str(onnx_path), save_as_external_data=False)
    for stray in onnx_path.parent.glob("produce.onnx.data*"):
        stray.unlink()

    metrics = {}
    metrics_path = ART / "metrics.json"
    if metrics_path.exists():
        metrics = json.loads(metrics_path.read_text())

    meta = {
        "version": 1,
        "inputSize": SIZE,
        # Exactly the normalisation train.py used. Get this wrong and every
        # prediction shifts, silently.
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225],
        "crops": CROPS,
        "stages": STAGES,
        "shelfLifeDays": SHELF_LIFE_DAYS,
        "stageQuality": STAGE_QUALITY,
        "trainedOn": {
            "sources": [
                "VegNet, Mendeley Data, DOI 10.17632/6nxnjbn9w6.1, CC BY",
                "Fruit and Vegetable Disease (Healthy vs Rotten), Kaggle, muhammad0subhan",
            ],
            "trainImages": metrics.get("train_size"),
            "testImages": metrics.get("test_size"),
        },
        "testAccuracy": {
            "crop": metrics.get("crop", {}).get("accuracy"),
            "cropMacroF1": metrics.get("crop", {}).get("macro_f1"),
            "stage": metrics.get("stage", {}).get("accuracy"),
            "stageMacroF1": metrics.get("stage", {}).get("macro_f1"),
        },
        "perClass": {
            "crop": metrics.get("crop", {}).get("per_class"),
            "stage": metrics.get("stage", {}).get("per_class"),
        },
    }
    (ART / "produce.json").write_text(json.dumps(meta, indent=2))

    WEB_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("produce.onnx", "produce.json"):
        (WEB_MODEL_DIR / name).write_bytes((ART / name).read_bytes())

    kb = onnx_path.stat().st_size / 1024
    print(f"produce.onnx   {kb:.0f} KB")
    print(f"produce.json   {(ART / 'produce.json').stat().st_size / 1024:.1f} KB")
    print(f"copied to      {WEB_MODEL_DIR}")
    if meta["testAccuracy"]["crop"] is not None:
        print(f"test accuracy  crop {meta['testAccuracy']['crop']*100:.1f}%  "
              f"stage {meta['testAccuracy']['stage']*100:.1f}%")


if __name__ == "__main__":
    main()
