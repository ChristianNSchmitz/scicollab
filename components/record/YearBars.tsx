/**
 * Small server-rendered bar chart: one bar per year, ink on the house rule
 * colour. The current year is still filling, so it is drawn in mute, as in
 * WeeklyBars. Values are in the accessible label and in each bar's title.
 */
export default function YearBars({
  points, unit, height = 64, labels = true, current,
}: {
  points: { year: number; value: number }[];
  unit: string;
  height?: number;
  labels?: boolean;
  /** The year that is still in progress. */
  current?: number;
}) {
  if (points.length === 0) return null;
  const W = 300, gap = 3;
  const max = Math.max(1, ...points.map((p) => p.value));
  const bw = (W - gap * (points.length - 1)) / points.length;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img"
           aria-label={`${unit} per year: ${points.map((p) => `${p.year} ${p.value}`).join(", ")}`}
           style={{ display: "block" }}>
        <line x1={0} x2={W} y1={height - 0.5} y2={height - 0.5} stroke="var(--rule)" />
        {points.map((p, i) => {
          const h = p.value === 0 ? 0 : Math.max(2, (p.value / max) * (height - 4));
          return (
            <rect key={p.year} x={i * (bw + gap)} y={height - h} width={bw} height={h}
                  fill={p.year === current ? "var(--mute)" : "var(--ink)"}>
              <title>{`${p.year}${p.year === current ? " (so far)" : ""}: ${p.value} ${unit}`}</title>
            </rect>
          );
        })}
      </svg>
      {labels && (
        <div style={{ display: "flex", justifyContent: "space-between", font: "400 11px/1 var(--mono)", color: "var(--mute)", marginTop: 5 }}>
          <span>{points[0].year}</span>
          <span>max {max}</span>
          <span>{points.at(-1)!.year}</span>
        </div>
      )}
    </div>
  );
}
