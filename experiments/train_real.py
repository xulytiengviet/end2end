#!/usr/bin/env python3
"""Optional REAL recorded speech → log-Mel → tiny CNN → bounded intent.

Not run in the preprint's synthetic 100% results; do not conflate metrics.
Input CSV fields: path,label,speaker,region,split (split=train/dev/test).
Known labels: STOP FORWARD BACK LEFT RIGHT LIGHT. UNKNOWN allowed in dev/test.
Separate speakers across splits. Audio: WAV, PCM16 mono, exactly 16 kHz.
Requires torch, torchaudio, numpy, installed separately.
"""
import argparse
import csv
import json
import random
import wave
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
from torch import nn
import torchaudio

NAMES = ("STOP", "FORWARD", "BACK", "LEFT", "RIGHT", "LIGHT")
FS = 16000
LENGTH = FS


def read_manifest(filename):
    root = Path(filename).resolve().parent
    with open(filename, newline="", encoding="utf-8-sig") as stream:
        rows = list(csv.DictReader(stream))
    if not rows:
        raise ValueError("CSV manifest is empty")
    required = {"path", "label", "speaker", "region", "split"}
    if not required.issubset(rows[0]):
        raise ValueError("missing manifest columns: " + ",".join(sorted(required - set(rows[0]))))
    seen = set()
    speakers = defaultdict(set)
    for row in rows:
        label = row["label"].strip().upper()
        split = row["split"].strip().lower()
        if label not in NAMES + ("UNKNOWN",) or split not in ("train", "dev", "test"):
            raise ValueError("invalid label or split")
        if split == "train" and label == "UNKNOWN":
            raise ValueError("UNKNOWN is held out from the six-class training classifier")
        path = (root / row["path"]).resolve()
        if not path.is_file() or path in seen:
            raise ValueError("file absent or duplicate: " + str(path))
        if not row["speaker"].strip() or not row["region"].strip():
            raise ValueError("speaker and region are mandatory")
        row.update(label=label, split=split, path=str(path))
        seen.add(path)
        speakers[split].add(row["speaker"])
    for a, b in (("train", "dev"), ("train", "test"), ("dev", "test")):
        if speakers[a] & speakers[b]:
            raise ValueError("speaker leakage across " + a + "/" + b)
    if not all(any(r["split"] == s for r in rows) for s in ("train", "dev", "test")):
        raise ValueError("train, dev and test must all have records")
    present = {r["label"] for r in rows if r["split"] == "train"}
    if present != set(NAMES):
        raise ValueError("training must contain each of the six known classes")
    return rows


def wav_to_fixed(path, training=False):
    with wave.open(str(path), "rb") as f:
        if f.getframerate() != FS or f.getnchannels() != 1 or f.getsampwidth() != 2:
            raise ValueError("requires PCM16 mono 16k WAV: " + str(path))
        pcm = f.readframes(f.getnframes())
    data = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    if data.size >= LENGTH:
        start = random.randint(0, data.size - LENGTH) if training else (data.size - LENGTH) // 2
        data = data[start:start + LENGTH]
    else:
        data = np.pad(data, (0, LENGTH - data.size))
    return torch.from_numpy(data.copy())


def batches(rows, batch_size, device, training=False):
    selected = list(rows)
    if training:
        random.shuffle(selected)
    for i in range(0, len(selected), batch_size):
        block = selected[i:i + batch_size]
        signal = torch.stack([wav_to_fixed(r["path"], training) for r in block]).to(device)
        target = torch.tensor([NAMES.index(r["label"]) if r["label"] in NAMES else -1 for r in block],
                              dtype=torch.long, device=device)
        yield signal, target, block


class TinyMelCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.mel = torchaudio.transforms.MelSpectrogram(
            sample_rate=FS, n_fft=400, win_length=400, hop_length=160,
            n_mels=64, power=2.0
        )
        self.net = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 24, kernel_size=3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(24, 32, kernel_size=3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten(),
            nn.Linear(32, len(NAMES))
        )

    def forward(self, audio):
        x = torch.log1p(self.mel(audio)).unsqueeze(1)
        mean = x.mean(dim=(-1, -2), keepdim=True)
        std = x.std(dim=(-1, -2), keepdim=True).clamp_min(1e-4)
        return self.net((x - mean) / std)


@torch.no_grad()
def evaluate(model, rows, batch_size, device, threshold):
    model.eval()
    record = []
    for wave_data, _, block in batches(rows, batch_size, device):
        probs = torch.softmax(model(wave_data), dim=-1).cpu()
        for i, r in enumerate(block):
            conf, predicted = probs[i].max(dim=-1)
            selected = NAMES[int(predicted)] if float(conf) >= threshold else "NOOP"
            record.append({"label": r["label"], "region": r["region"], "speaker": r["speaker"],
                           "pred": NAMES[int(predicted)], "confidence": round(float(conf), 6),
                           "decision": selected})
    known = [x for x in record if x["label"] != "UNKNOWN"]
    unknown = [x for x in record if x["label"] == "UNKNOWN"]
    return {
        "known_n": len(known), "unknown_n": len(unknown),
        "accuracy_known_direct": sum(x["pred"] == x["label"] for x in known) / len(known) if known else None,
        "correct_accepted_known": sum(x["decision"] == x["label"] for x in known) / len(known) if known else None,
        "unknown_false_accept": sum(x["decision"] != "NOOP" for x in unknown) / len(unknown) if unknown else None,
        "known_rejected": sum(x["decision"] == "NOOP" for x in known) / len(known) if known else None,
        "region": {region: {
            "n": sum(x["region"] == region for x in known),
            "correct_accepted": sum(x["region"] == region and x["decision"] == x["label"] for x in known)
        } for region in sorted({x["region"] for x in known})},
        "predictions": record
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", required=True)
    p.add_argument("--epochs", type=int, default=10)
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--seed", type=int, default=20261113)
    p.add_argument("--threshold", type=float, default=0.8)
    p.add_argument("--out", default="results/real")
    args = p.parse_args()
    if not 0 <= args.threshold <= 1 or args.epochs < 1 or args.batch_size < 1:
        p.error("threshold must be 0..1 and epochs/batch-size >=1")
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(1)
    rows = read_manifest(args.manifest)
    device = torch.device("cpu")
    model = TinyMelCNN().to(device)
    optim = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)
    train = [r for r in rows if r["split"] == "train"]
    dev = [r for r in rows if r["split"] == "dev"]
    test = [r for r in rows if r["split"] == "test"]
    history = []
    for ep in range(args.epochs):
        model.train()
        losses = []
        for audio, labels, _ in batches(train, args.batch_size, device, training=True):
            optim.zero_grad()
            loss = nn.functional.cross_entropy(model(audio), labels)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optim.step()
            losses.append(float(loss.detach()))
        result = evaluate(model, dev, args.batch_size, device, args.threshold)
        history.append({"epoch": ep+1, "train_loss": sum(losses)/len(losses),
                        "dev_direct_accuracy": result["accuracy_known_direct"]})
    test_result = evaluate(model, test, args.batch_size, device, args.threshold)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    torch.save({"model": model.state_dict(), "classes": NAMES, "sample_rate": FS,
                "threshold": args.threshold, "seed": args.seed}, out/"model.pt")
    report = {"kind": "real_pcm16_speech_user_manifest_unverified_external_data",
              "manifest": str(Path(args.manifest).resolve()), "epochs": args.epochs,
              "seed": args.seed, "decision_threshold_fixed_not_calibrated": args.threshold,
              "train_count": len(train), "dev_count": len(dev), "test_count": len(test),
              "speaker_disjoint": True, "test_metrics": test_result,
              "history": history,
              "limitations": "This is an optional user-dataset pipeline; generated results are not in the initial preprint. No device/hardware benchmark."}
    (out/"report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k!="test_metrics"}, ensure_ascii=False, indent=2))
    print("TEST:", json.dumps({k:v for k,v in test_result.items() if k!="predictions"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
