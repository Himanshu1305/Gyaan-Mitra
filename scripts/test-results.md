# Diagram System — Mechanical Test Results

- **Generated:** 2026-08-06T17:39:09.480Z
- **Mode:** FULL (21 runs, 21 produced output, 0 errored)
- **Server:** http://localhost:3010
- **Service key present (P1/P2/N8 enabled):** YES

> Mechanical checks only. Visual correctness (right diagram, answer-leaking pixels) is human vetting and NOT tested here.

## Summary

| Check | Gate | Description | Result (failed / applicable) |
|-------|------|-------------|-------------------------------|
| P1 | NOW | Diagram-heavy paper has ≥2 pool images | ✅ 0 / 13 |
| P2 | NOW | Pool image URLs are valid (supabase diagram-pool) | ✅ 0 / 13 |
| N1 | NOW | No question block has >1 image | ✅ 0 / 21 |
| N2 | NOW | Zero data:image/svg in any Science paper | ✅ 0 / 18 |
| N3 | NOW | SVG allowed ONLY in Maths runs | ✅ 0 / 21 |
| N4 | NOW | No raw %%DIAGRAM / [SVG: / [FIGURE: / [DIAGRAM: markers | ✅ 0 / 21 |
| N5 | GATE | draw/sketch/label-the-diagram questions have NO image | ❌ 1 / 21 FAILED |
| N6 | NOW | Unseeded runs: zero images, no crash, no orphan markers | ✅ 0 / 2 |
| N7 | NOW | Answer-key text passes N1–N4 | ✅ 0 / 3 |
| N8 | NOW | missing_diagram_log gained rows during the run | n/a |
| PF | NOW | Finalise preserves the draft's pool images (no silent strip) | ❌ 2 / 3 FAILED |

### [NOW] checks
- **P1** — ✅ 0 of 13 applicable runs failed.
- **P2** — ✅ 0 of 13 applicable runs failed.
- **N1** — ✅ 0 of 21 applicable runs failed.
- **N2** — ✅ 0 of 18 applicable runs failed.
- **N3** — ✅ 0 of 21 applicable runs failed.
- **N4** — ✅ 0 of 21 applicable runs failed.
- **N6** — ✅ 0 of 2 applicable runs failed.
- **N7** — ✅ 0 of 3 applicable runs failed.
- **N8** — not applicable in this matrix.
- **PF** — ❌ 2 of 3 applicable runs failed.

### [GATE] checks
- **N5** — ❌ 1 of 21 applicable runs failed.

## Frequency by category

- **C10-Sci-Ch10** (5 runs) — P1: 0/5 failed, P2: 0/5 failed, N1: 0/5 failed, N2: 0/5 failed, N3: 0/5 failed, N4: 0/5 failed, N5: 0/5 failed
- **C10-Sci-Ch5** (5 runs) — P1: 0/5 failed, P2: 0/5 failed, N1: 0/5 failed, N2: 0/5 failed, N3: 0/5 failed, N4: 0/5 failed, N5: 0/5 failed
- **C10-Sci-Ch5+10** (3 runs) — P1: 0/3 failed, P2: 0/3 failed, N1: 0/3 failed, N2: 0/3 failed, N3: 0/3 failed, N4: 0/3 failed, N5: 1/3 failed
- **C10-Sci-Ch10-FINALISE** (3 runs) — N1: 0/3 failed, N2: 0/3 failed, N3: 0/3 failed, N4: 0/3 failed, N5: 0/3 failed, PF: 2/3 failed, N7: 0/3 failed
- **C10-Maths-Geometry** (3 runs) — N1: 0/3 failed, N3: 0/3 failed, N4: 0/3 failed, N5: 0/3 failed
- **C9-Sci-Unseeded** (2 runs) — N1: 0/2 failed, N2: 0/2 failed, N3: 0/2 failed, N4: 0/2 failed, N5: 0/2 failed, N6: 0/2 failed

## N8 — missing_diagram_log

- Rows before: 0, after: 0
- ⚠️ No new/updated rows detected during the run.
  Note: rows are only logged when Claude emits a `[DIAGRAM:key]` for a topic key that has no approved image. Unseeded subjects (Class 9 / Maths) are offered NO topic keys, so they cannot log here by design.

## Failures — evidence

### C10-Sci-Ch5+10 — run 2  `scripts/test-runs/12_C10-Sci-Ch5+10_r2.txt`
- **N5 FAILED** (GATE): 1 draw-question(s) with an image

```
**Q13.** The diagram above shows a common eye defect. Identify the defect shown, state its cause, and explain how it can be corrected with the help of a suitable lens. Draw a ray diagram to show the correction.

_____________________________
_____________________________
____________________________
   → attached image(s): https://bpvakrgthezixqzslmng.supabase.co/storage/v1/object/public/ncert-figures/diagram-pool/myopia_defect/myopia_defect_labeled_03.png
```

### C10-Sci-Ch10-FINALISE — run 1  `scripts/test-runs/14_C10-Sci-Ch10-FINALISE_r1.txt`
- **PF FAILED** (NOW): draft 3 → finalised 0 pool image(s)

```
Finalisation dropped 3 of 3 pool image(s) — final printable paper is missing diagrams.
```

### C10-Sci-Ch10-FINALISE — run 2  `scripts/test-runs/15_C10-Sci-Ch10-FINALISE_r2.txt`
- **PF FAILED** (NOW): draft 3 → finalised 0 pool image(s)

```
Finalisation dropped 3 of 3 pool image(s) — final printable paper is missing diagrams.
```


## Raw evidence files

- `scripts/test-runs/01_C10-Sci-Ch10_r1.txt` — C10-Sci-Ch10 r1: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/02_C10-Sci-Ch10_r2.txt` — C10-Sci-Ch10 r2: images=4, pool=4, svg=0, markers=0
- `scripts/test-runs/03_C10-Sci-Ch10_r3.txt` — C10-Sci-Ch10 r3: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/04_C10-Sci-Ch10_r4.txt` — C10-Sci-Ch10 r4: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/05_C10-Sci-Ch10_r5.txt` — C10-Sci-Ch10 r5: images=2, pool=2, svg=0, markers=0
- `scripts/test-runs/06_C10-Sci-Ch5_r1.txt` — C10-Sci-Ch5 r1: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/07_C10-Sci-Ch5_r2.txt` — C10-Sci-Ch5 r2: images=4, pool=4, svg=0, markers=0
- `scripts/test-runs/08_C10-Sci-Ch5_r3.txt` — C10-Sci-Ch5 r3: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/09_C10-Sci-Ch5_r4.txt` — C10-Sci-Ch5 r4: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/10_C10-Sci-Ch5_r5.txt` — C10-Sci-Ch5 r5: images=4, pool=4, svg=0, markers=0
- `scripts/test-runs/11_C10-Sci-Ch5+10_r1.txt` — C10-Sci-Ch5+10 r1: images=5, pool=5, svg=0, markers=0
- `scripts/test-runs/12_C10-Sci-Ch5+10_r2.txt` — C10-Sci-Ch5+10 r2: images=4, pool=4, svg=0, markers=0
- `scripts/test-runs/13_C10-Sci-Ch5+10_r3.txt` — C10-Sci-Ch5+10 r3: images=5, pool=5, svg=0, markers=0
- `scripts/test-runs/14_C10-Sci-Ch10-FINALISE_r1.txt` — C10-Sci-Ch10-FINALISE r1: images=0, pool=0, svg=0, markers=0
- `scripts/test-runs/15_C10-Sci-Ch10-FINALISE_r2.txt` — C10-Sci-Ch10-FINALISE r2: images=0, pool=0, svg=0, markers=0
- `scripts/test-runs/16_C10-Sci-Ch10-FINALISE_r3.txt` — C10-Sci-Ch10-FINALISE r3: images=3, pool=3, svg=0, markers=0
- `scripts/test-runs/17_C10-Maths-Geometry_r1.txt` — C10-Maths-Geometry r1: images=0, pool=0, svg=0, markers=0
- `scripts/test-runs/18_C10-Maths-Geometry_r2.txt` — C10-Maths-Geometry r2: images=0, pool=0, svg=0, markers=0
- `scripts/test-runs/19_C10-Maths-Geometry_r3.txt` — C10-Maths-Geometry r3: images=0, pool=0, svg=0, markers=0
- `scripts/test-runs/20_C9-Sci-Unseeded_r1.txt` — C9-Sci-Unseeded r1: images=0, pool=0, svg=0, markers=0
- `scripts/test-runs/21_C9-Sci-Unseeded_r2.txt` — C9-Sci-Unseeded r2: images=0, pool=0, svg=0, markers=0
