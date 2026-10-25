# GBA1 maturation series — Seahorse analysis

> SciCollab demo project: all data are simulated and the materials (cell lines, OUH-GC12) are invented.

Seahorse XF mito stress test on iPSC-derived dopaminergic neurons: the GBA1 N370S line
OUH-GBA03, its isogenic gene-corrected control OUH-GBA03-GC and the reference line EUREF-1,
at day 35, 60 and 100 of maturation, with vehicle or OUH-GC12 (10 µM, the 14 days before
each assay). OCR is normalised to Hoechst nuclei counts. Protocol: MC-1187. Results: MC-1219.

## Data (`data/`)

| file | what | rows |
|---|---|---|
| `xf_exports_6plates.csv` | Wave export, one row per well and measurement: OCR, ECAR, PER per well, not normalised | 6,912 (6 plates × 96 wells × 12) |
| `nuclei_counts_6plates.csv` | imager export, Hoechst nuclei per well (9 fields at 10×, Cellpose) | 576 (6 × 96) |

- Plates: P1–P2 day 35, P3–P4 day 60, P5–P6 day 100. One differentiation, re-plated at day 25.
- Plate map, the same on every plate: columns 1-4-7-10 OUH-GBA03, 2-5-8-11 OUH-GBA03-GC,
  3-6-9-12 EUREF-1; rows A–D vehicle, E–H OUH-GC12; background wells A1, A12, H1, H12.
- Measurements 1–3 basal, 4–6 after oligomycin (1.5 µM), 7–9 after FCCP (1.0 µM),
  10–12 after rotenone + antimycin A (0.5 µM each; Hoechst 33342 is in the same port).

**Well IDs.** Wave writes `A01`, the imager writes `A1`. `normalise_ocr.py` pads both to `A01`
and stops with an error if any well does not match (96/96 per plate). Please do not remove
this check: without it the merge kept only columns 10–12 and nothing gave an error
(thread "After normalising OCR to nuclei counts I lose two thirds of my wells", #stats-and-code).

## How to run

From this folder:

```
pip install -r requirements.txt
python analysis/normalise_ocr.py               # -> out/ocr_normalised.csv
python analysis/plot_mito_stress.py            # -> out/mito_stress_traces.png, out/mito_summary.csv
python analysis/plot_mito_stress.py --day 100  # one panel only (figure for Elin's chapter)
```

Tested with Python 3.13, pandas 3.0, numpy 2.5, matplotlib 3.11.

## Scripts

- `analysis/normalise_ocr.py` — matches the two exports well by well, scales the nuclei count
  to 9 fields when the autofocus missed a field, and writes OCR, ECAR and PER per 1,000 nuclei.
  Background wells get no normalised value. Wells with less than 40 % of the plate median
  nuclei are flagged `low_nuclei` (cells lifted off during the washes).
- `analysis/plot_mito_stress.py` — mean ± SD traces per line, treatment and day (background and
  `low_nuclei` wells left out) and a table per group: basal, ATP-linked, maximal and spare
  respiration and non-mitochondrial OCR, as in the Wave report.
- `analysis/seahorse_qc.R` — CV of basal OCR per group and flags for strange wells. Actually it
  only runs on my laptop: the data path is my Windows folder and it needs `plyr`, which is not
  installed here. TODO: move it to Python.

## People

Mateo Ruiz Calderón (owner), Ingrid Sørlie, Jonas Verbeke (well-ID check, 25 Sep).
