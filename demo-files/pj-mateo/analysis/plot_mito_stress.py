"""Mito stress traces: mean OCR per 1,000 nuclei +/- SD across wells, per line,
treatment and maturation day. Also writes the usual parameters per group.

    python analysis/plot_mito_stress.py             # three panels, day 35 / 60 / 100
    python analysis/plot_mito_stress.py --day 100   # one panel (figure for Elin's chapter)

in:  out/ocr_normalised.csv  (run analysis/normalise_ocr.py first)
out: out/mito_stress_traces.png (or mito_stress_traces_d100.png), out/mito_summary.csv
"""
from pathlib import Path
import argparse

import matplotlib
matplotlib.use("Agg")  # no screen needed, also works on the server
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
IN_FILE = ROOT / "out" / "ocr_normalised.csv"
OUT_DIR = ROOT / "out"

LINES = ["OUH-GBA03", "OUH-GBA03-GC", "EUREF-1"]
COLOURS = {"OUH-GBA03-GC": "#2a78d6", "OUH-GBA03": "#eb6834", "EUREF-1": "#1baf7a"}
STYLES = {"vehicle": ("-", "o"), "OUH-GC12": ("--", "s")}
INJECTIONS = {3: "Oligo", 6: "FCCP", 9: "Rot/AA"}  # injected after measurement n
Y = "OCR_per_1000_nuclei"


def usable(df):
    """Wells that count: no background, no wells where the cells lifted off."""
    return df[~df["is_background"] & ~df["low_nuclei"]]


def parameters(df):
    """Per well: non-mito, basal, ATP-linked, maximal, spare (pmol O2/min per 1,000 nuclei)."""
    w = df.pivot_table(index=["plate", "well", "day", "group", "treatment"],
                       columns="measurement", values=Y)
    non_mito = w[[10, 11, 12]].min(axis=1)
    out = pd.DataFrame({
        "non_mito": non_mito,
        "basal": w[3] - non_mito,
        "atp_linked": w[3] - w[[4, 5, 6]].min(axis=1),
        "maximal": w[[7, 8, 9]].max(axis=1) - non_mito,
    })
    out["spare"] = out["maximal"] - out["basal"]
    return out.reset_index()


def summary(params):
    cols = ["basal", "atp_linked", "maximal", "spare", "non_mito"]
    g = params.groupby(["day", "group", "treatment"])
    s = g[cols].agg(["mean", "std"]).round(3)
    s.columns = [f"{a}_{b}" for a, b in s.columns]
    s.insert(0, "n_wells", g.size())
    return s.reset_index()


def panel(ax, df, day):
    d = df[df["day"] == day]
    times = d.groupby("measurement")["time_min"].mean()
    for m, label in INJECTIONS.items():
        x = (times[m] + times[m + 1]) / 2
        ax.axvline(x, color="#c3c2b7", lw=1, ls=":", zorder=0)
        ax.text(x, 1.01, label, transform=ax.get_xaxis_transform(), ha="center", va="bottom",
                fontsize=8, color="#52514e")
    for line in LINES:
        for treat, (ls, marker) in STYLES.items():
            sel = d[(d["group"] == line) & (d["treatment"] == treat)]
            if sel.empty:
                continue
            stat = sel.groupby("measurement")[Y].agg(["mean", "std"])
            n = sel["well"].groupby(sel["plate"]).nunique().sum()
            ax.errorbar(times[stat.index], stat["mean"], yerr=stat["std"], color=COLOURS[line],
                        ls=ls, marker=marker, ms=4, lw=2, capsize=2, elinewidth=1,
                        label=f"{line}, {treat} (n={n})")
    ax.set_title(f"Day {day}", fontsize=11, pad=18)
    ax.set_xlabel("Time (min)")
    ax.grid(axis="y", color="#e1e0d9", lw=0.6)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--day", type=int, choices=[35, 60, 100], help="plot only this day")
    args = ap.parse_args()

    df = usable(pd.read_csv(IN_FILE))
    days = [args.day] if args.day else sorted(df["day"].unique())

    single = len(days) == 1
    fig, axes = plt.subplots(1, len(days), figsize=(4.6 * len(days) + 0.4, 5.4 if single else 4.2),
                             sharey=True, squeeze=False)
    for ax, day in zip(axes[0], days):
        panel(ax, df, day)
    axes[0][0].set_ylabel("OCR (pmol O$_2$/min per 1,000 nuclei)")
    handles, labels = axes[0][-1].get_legend_handles_labels()
    fig.legend(handles, [lab.split(" (n=")[0] for lab in labels], loc="lower center",
               ncol=2 if single else 3, frameon=False, fontsize=8)
    fig.tight_layout(rect=(0, 0.2 if single else 0.12, 1, 1))

    OUT_DIR.mkdir(exist_ok=True)
    png = OUT_DIR / (f"mito_stress_traces_d{args.day}.png" if args.day else "mito_stress_traces.png")
    fig.savefig(png, dpi=300)

    s = summary(parameters(df))
    s.to_csv(OUT_DIR / "mito_summary.csv", index=False)
    with pd.option_context("display.width", 140, "display.max_columns", 20):
        print(s[["day", "group", "treatment", "n_wells", "basal_mean", "maximal_mean", "spare_mean"]]
              .to_string(index=False))
    print(f"saved {png.relative_to(ROOT)} and out/mito_summary.csv")


if __name__ == "__main__":
    main()
