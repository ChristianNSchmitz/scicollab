"""Normalise Seahorse XF rates to Hoechst nuclei counts.

Reads the Wave export (one row per well and measurement) and the imager export
(one row per well), matches them well by well and writes one tidy table with
OCR, ECAR and PER per 1,000 nuclei.

    python analysis/normalise_ocr.py

in:  data/xf_exports_6plates.csv      (Wave writes wells as A01 ... H12)
     data/nuclei_counts_6plates.csv   (the imager writes them as A1 ... H12)
out: out/ocr_normalised.csv
"""
from pathlib import Path
import re

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
XF_FILE = ROOT / "data" / "xf_exports_6plates.csv"
NUCLEI_FILE = ROOT / "data" / "nuclei_counts_6plates.csv"
OUT_FILE = ROOT / "out" / "ocr_normalised.csv"

WELLS_PER_PLATE = 96
FIELDS_PER_WELL = 9   # 3 x 3 fields at 10x cover the bottom of an XF96 well
LOW_NUCLEI = 0.40     # flag wells with less than 40 % of the plate median (cells lifted off)

WELL_RE = re.compile(r"\s*([A-Ha-h])\s*0*([1-9]|1[0-2])\s*")


def well_id(w):
    """'A1', 'a01', ' A01' -> 'A01'. Anything else is an error, not a guess."""
    m = WELL_RE.fullmatch(str(w))
    if m is None:
        raise ValueError(f"unexpected well id: {w!r}")
    return f"{m.group(1).upper()}{int(m.group(2)):02d}"


def load():
    xf = pd.read_csv(XF_FILE, comment="#")
    nuclei = pd.read_csv(NUCLEI_FILE, comment="#")
    # both exports go through the same door, so the keys are spelled the same
    xf["well"] = xf["well"].map(well_id)
    nuclei["well"] = nuclei["Well"].map(well_id)
    return xf, nuclei.drop(columns="Well")


def match_wells(xf, nuclei):
    """One row per well on each side, and every well must match exactly once.

    validate= raises if a well appears twice; indicator= says for every well
    whether it was found in the Seahorse export, the imager export or both.
    Never align the two tables by row position: text sorting puts A10 before A2.
    """
    wells = xf[["plate", "well"]].drop_duplicates()
    check = wells.merge(nuclei, on=["plate", "well"], how="outer",
                        validate="one_to_one", indicator=True)
    unmatched = check[check["_merge"] != "both"]
    assert unmatched.empty, (
        f"{len(unmatched)} well IDs found on one side only:\n{unmatched.to_string(index=False)}")
    per_plate = check.groupby("plate")["well"].nunique()
    assert (per_plate == WELLS_PER_PLATE).all(), f"wells per plate:\n{per_plate}"
    return check.drop(columns="_merge")


def normalise(xf, wells):
    df = xf.merge(wells, on=["plate", "well"], how="left", validate="many_to_one")
    assert len(df) == len(xf)

    df["is_background"] = df["group"].eq("background")
    # a field that failed autofocus means fewer nuclei counted, not fewer cells
    df["fields_missing"] = df["fields_imaged"] < FIELDS_PER_WELL
    df["nuclei"] = df["nuclei_count"] * FIELDS_PER_WELL / df["fields_imaged"]

    median = (df[~df["is_background"]].drop_duplicates(["plate", "well"])
              .groupby("plate")["nuclei"].median())
    df["low_nuclei"] = ~df["is_background"] & (df["nuclei"] < LOW_NUCLEI * df["plate"].map(median))

    per_1000 = (df["nuclei"] / 1000).where(~df["is_background"])  # background wells: no cells
    for col, new in (("OCR_pmol_min", "OCR_per_1000_nuclei"),
                     ("ECAR_mpH_min", "ECAR_per_1000_nuclei"),
                     ("PER", "PER_per_1000_nuclei")):
        df[new] = (df[col] / per_1000).round(4)
    df["nuclei"] = df["nuclei"].round(0)
    return df.sort_values(["plate", "well", "measurement"]).reset_index(drop=True)


def main():
    xf, nuclei = load()
    wells = match_wells(xf, nuclei)
    df = normalise(xf, wells)

    OUT_FILE.parent.mkdir(exist_ok=True)
    df.to_csv(OUT_FILE, index=False)

    per_well = df.drop_duplicates(["plate", "well"])
    print(f"{len(wells)}/{xf[['plate', 'well']].drop_duplicates().shape[0]} wells matched "
          f"({wells['plate'].nunique()} plates x {WELLS_PER_PLATE})")
    print(f"background wells: {int(per_well['is_background'].sum())}, "
          f"low nuclei: {int(per_well['low_nuclei'].sum())}, "
          f"a field missing: {int(per_well['fields_missing'].sum())}")
    print(f"wrote {len(df)} rows -> {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
