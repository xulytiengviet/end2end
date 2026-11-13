# CVNSS4.0-Sonic v0.2 — a falsifiable research programme

**Status:** proposed scientific framework; **not** an established theorem of universal speech/robot correctness. **Author of this research prototype:** Long Ngo. **Original CVNSS4.0 creators:** Kiều Trường Lâm and Trần Tư Bình. Protocol frozen for the synthetic baseline on 2026-11-13.

## 1. Core distinction

An **orthographic reference code** is not a waveform, an IPA transcription, a semantic grounding model, or an actuator control signal. “Executable sound wave” is used **only as a metaphor for a testable, constrained signal-to-action pipeline**, not for a deterministic bijection between arbitrary written Vietnamese and a physical sound wave. The proposed benefit is testable auditability, not a solved symbol-grounding problem.

The fast branch is `PCM → 8×8 sparse Goertzel time–frequency energy → supervised nearest-centroid → action candidate`. The checking path performs *algorithmically distinct but statistically dependent* dominant-frequency validation on **the same PCM features**. CVNSS4.0 is an **orthographic reference lexicon**, not a required component of the fast acoustic classifier. Every output is checked by an allowlist + margin/signature gate. The program never connects to a robot motor.

## 2. Five axioms recast as design obligations

| Code | Design obligation | Evidence and scope |
|---|---|---|
| A1 Determinism | Fixed decoder and lexicon yield repeatable output | 10,000 repeated calls of six *fixed labels* verified, not 10,000 unique Vietnamese sentences |
| A2 Structure | Orthographic coding should preserve recoverable distinctions on an explicitly defined domain | six commands round-trip; full CVNSS4.0 is **not injective**; onset/rhyme/tone preservation not universally demonstrated |
| A3 Regionality | Speaker/accent group labels, dialect-conditioned models, and balanced regional splits are required | untested; three synthetic perturbations are **not** three accents |
| A4 Reference lexicon | The CVNSS4.0 converter and fixed dictionary constrain authorised command *labels* | six concrete terms verified; does **not** establish that audio was understood |
| A5 Auditability | Every accepted command should record source inference, constraints, and lookup version | results JSON and SHA256 content provenance available; real device audit remains untested |

## 3. Precise mathematical domains

- **O**: Unicode orthography, NFC-normalised with a stated canonicalisation policy. **S**: ASCII CVNSS4.0 code strings. **P**: phonological descriptions **indexed by region and context**. **A**: finite typed action records.
- `E: O → S` is deterministic for converter-supported strings, but **not globally injective**. A concrete falsification: `E("ề") = E("oet") = "ed"`, also `ẽ/oec → es`, `ồ/oat → od`, `ộ/oap → of`, `õ/oac → os` in the pinned converter.
- A **restricted whitelist** `O_W` of six complete command labels has pairwise-distinct codes, and `decode_default(E(o)) = o` for every `o` in `O_W`. This is a finite-domain checked property, not universal `E⁻¹ ∘ E = identity`.
- An augmented representation `(E(o), disambiguation_tag)` **could** provide lossless reverse mapping if the tag is specified and stored; this project does not implement it, and Base27 **does not fix CVNSS ambiguity**.
- `D: S × region × context → P` may be deterministic **if** a complete G2P rule system with specified context and accents exists. It is not generally invertible because pronunciation is many-to-one and can vary within an orthographic form.
- **C1** `D⁻¹(D(s)) = s`: **UNTESTED and not generally justified**. **C2** `E⁻¹(E(o)) = o`: **REFUTED globally**, **PASS on O_W only**. **C3** `T(s) = R(D(s))` and **C4** `T(E(o)) = R(D(E(o)))`: conditional commuting-diagram obligations, **UNTESTED** until an independent regional phonology map and `R` are implemented.
- `Base27 (A…Z + SPACE) ↔ (t₂,t₁,t₀) ∈ {0,1,2}³` is bijective over **exactly 27 symbols**. The identity `v=9t₂+3t₁+t₀` has 27 exhaustive executable cases. A three-trit sequence is a *numeral*, not evidence of a ternary physical processor or compression.

## 4. Falsifiable hypotheses (NOT observed results)

**H1:** Under speaker-disjoint real Vietnamese commands, a fixed, pre-registered hybrid gate lowers false accept rate compared with an otherwise identical direct model, at a reported cost in false rejects. **H2:** CVNSS4.0 label normalisation improves an ASR/intent task versus Unicode labels, after controlling for vocabulary and tokenizer; a null or negative difference falsifies the improvement. **H3:** int8/fixed-point inference on a named ESP32-S3 board meets its measured memory, latency and power budget under a frozen firmware build. **H4:** Region-aware training reduces worst-group error compared with a speaker-disjoint non-region-aware baseline; it may not. **H5:** The declared safety layer never actuates forbidden commands in a fixed threat-model test suite; no claim of general robot safety follows from zero observed incidents.

Pre-registration for real audio: consented recordings, speakers grouped into North/Central/South **only as metadata**; separate training/development/held-out test speakers; list every command and out-of-vocabulary utterance; include microphone distance, fan/motor noise, near-homophones and code-switching. Fix thresholds on development only; report per-region sample counts, speaker counts, WER/CER (only when transcription exists), accuracy, FAR, FRR, ECE, measured end-to-end and branch latency p50/p95/p99. Use paired bootstrap speaker-level 95% intervals, ablations, and post hoc error analysis without retuning the test split.

Ablations: direct only; direct+lexicon; direct+spectral signature; complete fail-closed gate; ASR→intent baseline; optional CVNSS-labelled ASR; optional region-conditioning. Keep action taxonomy, data, split, and inference budget fixed where possible. WER ≤8%, ≤15% noisy, gate agreement ≥90%, latency ≤110/300 ms and zero observed violations in 10,000 tests are **target thresholds**, not findings. A 0/10,000 rate does **not** prove zero risk.

## 5. Reproduce, falsify, audit

```bash
python3 experiment.py --seed 20261113 --train 8 --test 6
node scripts/build_lexicon.js
node scripts/verify_sonic.js
python3 -m unittest discover -s tests -v
gcc -std=c11 -O2 -Wall -Wextra -Werror firmware/infer.c -o infer
./infer --selftest
sha256sum vendor/cvnss-converter.js data/lexicon.json scripts/verify_sonic.js
python3 -m http.server 8000 # /docs/
```

Machine-readable evidence is generated deterministically in `results/sonic-proof.json` alongside `results/report.json`. SHA-256 hashes record source lineage. Changes to converter rules or command lexicon **must** regenerate evidence in CI. Exact data generator parameters/seed are in `experiment.py`. The browser demonstration creates approximate feature vectors and is **not** the same as the Python/C fixed-point sample generator; its output must never be mixed into the measured report.

## 6. Evidence ledger / interpretation

| Claim | Current status | Observation / counterexample |
|---|---|---|
| Exactly 27 3-trit codes | **PASS** | exhaustively tested 27/27 |
| CVNSS4.0 invertibility on six command labels | **PASS** | six checked round trips |
| CVNSS4.0 globally bijective | **REFUTED** | `ề` and `oet` both encode `ed` |
| C1, C3, C4 (phonological inverse and action consistency) | **UNTESTED** | no complete phonology map |
| Artificial-signal recognition | **MEASURED (synthetic only)** | read `results/report.json` |
| Vietnamese speech WER, accent generalization, TTS naturalness | **UNMEASURED** | no recorded speech dataset |
| ESP32-S3 RAM/Flash/power/latency | **UNMEASURED** | C11 host simulator not MCU benchmark |
| Fail-closed gating in finite toy model | **PASS (unit tests)** | not a robot safety certificate |

**Scientific rule:** mathematical proofs, checked software invariants, synthetic measurements, research hypotheses, and real-world validations remain separately labelled in all artifacts. A failed theoretical assertion is not repaired by a 100% synthetic score.
