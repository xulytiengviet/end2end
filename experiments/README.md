# Optional recorded Vietnamese command-speech experiment

This training path is **separate** from the initial deterministic 126-waveform artificial experiment and produces **no claims** in the initial preprint. It supplies the neural, log-mel version of spectrogram → command classifier when genuine, consented speech data are supplied.

## Manifest CSV

Use header: path,label,speaker,region,split

Example (filenames are placeholders, not bundled data):

path,label,speaker,region,split
wavs/s001_a.wav,STOP,s001,Bac,train
wavs/s002_a.wav,FORWARD,s002,Trung,dev
wavs/s003_a.wav,UNKNOWN,s003,Nam,test

Supply **all six known command labels** in the training set (STOP, FORWARD, BACK, LEFT, RIGHT, LIGHT); UNKNOWN is supported only in dev/test. Every audio path must exist and be distinct, and the speaker IDs must not overlap across training, validation and test. The region column is metadata provided by the dataset protocol; do not infer accent from speaker residence. WAV files must be **16,000 Hz, mono, signed 16-bit PCM**.

The script uses fixed 1-second windows; longer utterances are cropped, not transcribed, and shorter ones are padded. Segment boundaries, VAD and ground-truth intent must be independently checked. Include many independent speakers and environments rather than repeated recordings by one person.

## Optional dependencies

    python -m pip install numpy torch torchaudio

Use a compatible CPU/GPU installation of PyTorch and torchaudio.

    python experiments/train_real.py --manifest data/real/manifest.csv --epochs 10 --seed 20261113 --threshold 0.8 --out results/real

The model is a small PyTorch CNN operating on 64-band log-mel spectrograms. Output is **six action-class logits**, not Unicode text or CVNSS tokens. The latter belong to the reference lexicon. Results include accuracy on known commands, accepted-correct rate, rejection rate, unknown false-accept, and region-wise counts. The threshold 0.8 is **not calibrated**, and softmax probabilities must not be interpreted as trustworthy physical-action confidence.

To test CVNSS transport separately:

    node scripts/build_lexicon.js

Do not compare the neural model's result to 100% synthetic surrogate accuracy without matched controls. The neural model is not quantized or flashed to ESP32-S3; its PyTorch model.pt is not a firmware image. For publication, include the manifest, data license, consent, recording protocol, checksums, full model settings and a locked external test set, along with confidence intervals and baseline ASR→intent systems.
