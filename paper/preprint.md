# END2END-VI: Reproducible Integer Time–Frequency Speech-to-Action Surrogates with CVNSS4.0 Reference Lexicon and Base27 Ternary Transport

**Technical preprint, v0.1 — 13 November 2026**  
**Author:** Long Ngo  
**Submission status:** Draft; not peer reviewed.  
**Reproducibility repository:** https://github.com/xulytiengviet/end2end

## Abstract

We propose a constrained, auditable architecture for eventual Vietnamese command-driven edge robotics, in which a direct acoustic feature-to-action path is complemented by an orthographic CVNSS4.0 reference lexicon and a fail-closed gate. In the present **software proof of concept**, 16 kHz PCM is transformed into a sparse integer time–frequency representation (eight frames × eight Goertzel bands), and a supervised nearest-centroid classifier maps these features directly to six action labels. A separate rule-specified spectral signature checker may abstain on unsupported inputs. The labels are eligible for CVNSS4.0 lookup using the existing audit-safe reference implementation; ASCII codes can be bijectively represented by Base27 integers and three trits. We provide a fixed-seed synthetic experiment (144 training, 126 test waveforms) and independent C11/Python feature-parity tests. **The signals are artificial multitone waveforms and not human speech. Consequently, the numerical rates measure only toy-data software behavior; they do not constitute Vietnamese ASR, dialect, TTS, robot safety, or ESP32-S3 deployment evidence.**

**Keywords:** Vietnamese edge robotics; sparse spectrogram; speech-to-action; CVNSS4.0; ternary; Base27; fixed-point model; reproducibility.

## 1. Motivation and research scope

The direct-path hypothesis is that an acoustic representation can predict bounded robot intent without waiting for a full text transcription. An independently maintained orthographic dictionary can make a recognized command traceable and constrain the label vocabulary. The key methodological constraint is to separate (a) code-level invariants that can be proven exactly; (b) a generated acoustic surrogate that can be measured; and (c) genuine human speech and hardware outcomes that cannot yet be claimed.

The supplied conceptual manuscript also discusses dialect-aware ASR/CTC, grapheme-to-phoneme and TTS. These remain **future extensions** rather than implemented modules. We explicitly reject the inference that a finite label set or a verified orthographic code implies correct speech recognition.

## 2. Related research and distinctions

Graves et al. (2006) introduced CTC for unsegmented sequence-to-label learning, a plausible later baseline for the optional text-producing branch. Conneau et al. (2022) proposed FLEURS as a multilingual speech benchmark covering Vietnamese; test labels must be matched to the restricted command ontology before it can act as a command dataset. Nan et al. (2026) reported Speech-π0.5 for speech-conditioned robotic manipulation and lower response latency relative to an ASR pipeline; those are **external results** and are not measured here.

CVNSS4.0 was invented by **Kiều Trường Lâm and Trần Tư Bình**. Its audit-safe software adaptation explicitly records many-to-one and ambiguity behavior. It is an orthographic shorthand, **not** an IPA pronunciation system. The draft's experimental numerical-tone variants (e.g., word+tone digit) are not silently treated as canonical CVNSS4.0.

## 3. Methods

### 3.1 Integer sparse time–frequency front end

The prototype processes 5,120 PCM s16le samples at 16,000 Hz (0.32 s). For each of eight temporal segments, one 256-sample window is analyzed at eight Fourier bins, numbered 4, 7, 10, 13, 16, 19, 22 and 25. For a bin k, let

\[
c_k=\operatorname{round}(2^{14}\cdot 2\cos(2\pi k/256)).
\]

The fixed-point Goertzel recurrence is

\[
s_n=x_n+\operatorname{ashr}_{14}(c_ks_{n-1})-s_{n-2}.
\]

A non-negative power score is computed as

\[
P_{t,k}=\max\{0,s_1^2+s_2^2-\operatorname{ashr}_{14}(c_ks_1s_2)\}.
\]

The emitted integer time–frequency feature is

\[
F_{t,k}=
\begin{cases}
\left\lfloor255P_{t,k}/\max_jP_{t,j}\right\rfloor,&\max_jP_{t,j}>0;\\
0,&\text{otherwise}.
\end{cases}
\]

There are 64 unsigned 8-bit output features. This is a **sparse Goertzel spectrogram**, not a dense STFT or log-mel network. The implementation is designed to be straightforward to port to embedded C, but this release is **host compiled only**.

### 3.2 Feature-to-command decision

For six bounded labels (STOP, FORWARD, BACK, LEFT, RIGHT, LIGHT), supervised training averages class-specific 64-feature vectors and quantizes their means. The direct decision minimizes squared distance to the six centroids. A separately authored rule table specifies the eight expected dominant-frequency IDs per label. The verifier requires ≥7 of 8 signature matches. The gate returns NOOP if the verifier fails, the minimum-vs-second-minimum distance margin is below 1,000, or the label is outside the allowlist.

This is a **supervised but not deep neural** proof of a direct spectral-to-action data path. Both branches share the acoustic features and may suffer correlated errors; the term “independent” refers to rule authorship, **not** statistical independence.

### 3.3 CVNSS4.0 lexical role

The standard audit-safe converter from the original research repository is copied with attribution. A Node script generates a static dictionary of Unicode command strings, CVNSS4.0 codes, decoded default values and a flag for potentially ambiguous round trips. The CVNSS4.0 module is **outside the direct acoustic inference path** and supports audit, label normalization and codebook construction only.

A command's appearance in a dictionary does not validate that it was actually spoken. If the CVNSS reverse path has collisions, default candidate decoding cannot be represented as a lossless Unicode round-trip.

### 3.4 Integer Base27 to ternary transport

Let the alphabet be A–Z plus SPACE and define the canonical integer value v∈{0,…,26}, with SPACE=26. For each symbol,

\[
(t_2,t_1,t_0)=(\lfloor v/9\rfloor, \lfloor v/3\rfloor\bmod3, v\bmod3).
\]

Decoding v=9t₂+3t₁+t₀ recovers the original 27-symbol alphabet exactly; 3³=27. This proves a finite-domain **symbol-code bijection only**. It does not show more efficient physical binary memory representation, a native ternary ALU, lossless CVNSS→Unicode reconstruction, or an improvement in learned acoustic prediction.

## 4. Reproduction protocol

Synthetic class signatures are artificial frequency progressions, not Vietnamese phonemes. Acoustic perturbations comprise reproducible frequency drift and additive random noise; the three synthetic profiles are **not** North/Central/South accents. The generator uses independent train/test random seeds under experiment seed **20261113**. Training sample count: 6 known labels × 3 profiles × 8 instances = 144. Held-out test count: 7 labels (including artificial UNKNOWN) × 3 profiles × 6 instances = 126, consisting of 108 known and 18 unknown samples.

Exact reproduction commands:

    python3 experiment.py --seed 20261113 --train 8 --test 6
    python3 -m unittest discover -s tests -v
    gcc -O2 -std=c11 -Wall -Wextra -Werror firmware/infer.c -o infer
    ./infer --selftest
    node scripts/build_lexicon.js

The script exports results/report.json, results/model.json and results/predictions.json, along with a generated C model header. The C11 program can additionally process raw 5,120-sample little-endian PCM. The Python test suite compiles the C reference on the host and checks its full 64-dimensional output on six newly generated example signals.

## 5. Measured results

**Dataset designation: SYNTHETIC MULTITONE SURROGATE; not natural human speech.**

| Quantity | Reproduced result | Interpretation |
|:--|--:|:--|
| Synthetic training waveforms | 144 | Six artificial classes |
| Synthetic test waveforms | 126 | 108 known + 18 unknown |
| Direct classification accuracy (known) | 108/108 = 100% | Easy synthetic pattern generator |
| Hybrid accepted-correct rate (known) | 108/108 = 100% | No known rejections at selected noise |
| Hybrid false acceptance (unknown) | 0/18 = 0% | Not an estimated real-world safety rate |
| Exact single-symbol Base27 ↔ 3-trit cases | 27/27 | Finite-domain transport invariant |
| Unit-test groups on host software | 3/3 | Mathematical, gating, Python/C parity |
| Real Vietnamese WER/CER | Not measured | Needs speaker-disjoint real audio |
| ESP32-S3 memory / energy / latency | Not measured | Needs physical target instrumentation |
| Real robot safety | Not measured | Needs independent safety assessment |

The 100% scores are expected from highly separable synthetic labels whose generating signatures match the hand-written verifier; they should **not** be promoted as a breakthrough in Vietnamese speech recognition or cross-dialect generalization. Source-grounded machine-readable evidence lives in results/report.json, and the actual data-generating procedure is public.

## 6. Limitations

The model does not transcribe speech, handle duration variation, perform VAD, recognize North/Central/South accents, execute TTS, or perform speech-to-text. No external speech corpus is bundled. A “pass” in a label whitelist checks the space of authorized actions, not acoustic understanding. Shared features can create correlated error; a false negative at the gate reduces utility, while a false positive may still be dangerous. No motor or actuator commands are sent. On ESP32-S3, numeric overflow bounds, Q-format calibration, stack/flash/RAM, timing, noise, sensor fusion and hardware interlocks must all be verified explicitly.

## 7. Falsifiable roadmap

**H1:** On genuine Vietnamese commands with speaker-disjoint Northern, Central and Southern speakers, a compact log-mel CNN/CRNN direct classifier meets a preregistered acceptance criterion. **H2:** An independently trained, calibrated verification branch reduces false acceptance at an acceptable known-command rejection rate versus direct-only and ASR→intent baselines. **H3:** Quantized int8/ternary models reduce flash/RAM or energy versus the relevant int8 baseline on actual ESP32-S3 at bounded loss in recognition. **H4:** CVNSS4.0 lookup improves traceability or annotation consistency, while any WER advantage must be empirically tested rather than assumed.

A rigorous future study should register the command ontology, permissible actuators, speech recording protocol, microphone and development board, speaker splits, region balance, noise conditions, ground truth, baseline models, confidence intervals, error bars, checksums and an independent held-out validation set **before** drawing performance conclusions.

## 8. Conclusion

The artifact establishes a constrained integer time–frequency path, a simple trained direct classifier, deterministic gate behavior, C/Python software parity, CVNSS4.0 lexical export and mathematically reversible Base27 trit transport. The artifact **does not prove ASR/TTS performance or firmware deployment on actual hardware**. It is positioned as a testable research protocol and software preprint, not a finished experimental validation.

## References

1. Graves, A. et al. (2006), Connectionist Temporal Classification, ICML. https://www.cs.toronto.edu/~graves/icml_2006.pdf
2. Conneau, A. et al. (2022), FLEURS: Few-shot Learning Evaluation of Universal Representations of Speech, IEEE SLT. https://arxiv.org/abs/2205.12446
3. Nan, E. et al. (2026), Late Breaking Results: Audio-Language-Action Models with Direct Speech Conditioning for Robotic Manipulation (Speech-π0.5). https://arxiv.org/abs/2610.33866
4. Kiều Trường Lâm and Trần Tư Bình, CVNSS4.0 original work. Reference materials https://chuvietnhanh.sourceforge.net/ ; audit-safe reference implementation https://github.com/xulytiengviet/CVNSS4.0 .
