/**
 * Pictures for the demo crowd (crowd.ts): figures of the kind researchers
 * post, drawn as SVG and kept inline as data: URLs like any demo image. They
 * are invented data and say so in small print; no photos, no people.
 */

/** A small seeded random generator, so the demo looks the same on every start. */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const svg = (w: number, h: number, body: string, bg = "#ffffff") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Helvetica, Arial, sans-serif"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`)}`;
const note = (w: number, h: number, fill = "#9a9aa0") => `<text x="${w - 10}" y="${h - 8}" font-size="10" fill="${fill}" text-anchor="end">example data · demo</text>`;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Grouped bars with error bars and the points on top. */
export function barChart(seed: number, title: string, groups: string[], unit: string, colour = "#1B4FA0"): string {
  const r = rng(seed), W = 640, H = 400, x0 = 70, y0 = 330, top = 60;
  const vals = groups.map((_, i) => 30 + r() * 60 + (i === groups.length - 1 ? 15 : 0));
  const max = Math.max(...vals) * 1.25;
  const bw = (W - x0 - 40) / groups.length;
  let body = `<text x="${x0}" y="34" font-size="18" font-weight="700" fill="#16161a">${esc(title)}</text>`;
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${y0}" stroke="#333"/><line x1="${x0}" y1="${y0}" x2="${W - 20}" y2="${y0}" stroke="#333"/>`;
  for (let t = 0; t <= 4; t++) { const y = y0 - (t / 4) * (y0 - top); body += `<text x="${x0 - 8}" y="${y + 4}" font-size="11" text-anchor="end" fill="#555">${Math.round((t / 4) * max)}</text><line x1="${x0 - 4}" x2="${x0}" y1="${y}" y2="${y}" stroke="#333"/>`; }
  body += `<text x="20" y="${(top + y0) / 2}" font-size="12" fill="#555" transform="rotate(-90 20 ${(top + y0) / 2})" text-anchor="middle">${esc(unit)}</text>`;
  groups.forEach((g, i) => {
    const h = (vals[i] / max) * (y0 - top), x = x0 + i * bw + bw * 0.2, w = bw * 0.6, err = 4 + r() * 10;
    body += `<rect x="${x}" y="${y0 - h}" width="${w}" height="${h}" fill="${colour}" opacity="${0.55 + 0.4 * (i / groups.length)}" rx="3"/>`;
    const ey = y0 - h, eh = (err / max) * (y0 - top);
    body += `<line x1="${x + w / 2}" x2="${x + w / 2}" y1="${ey - eh}" y2="${ey + eh}" stroke="#16161a"/><line x1="${x + w / 2 - 8}" x2="${x + w / 2 + 8}" y1="${ey - eh}" y2="${ey - eh}" stroke="#16161a"/>`;
    for (let k = 0; k < 5; k++) body += `<circle cx="${x + w * (0.2 + r() * 0.6)}" cy="${ey + (r() - 0.5) * eh * 2.4}" r="3.2" fill="#16161a" opacity=".7"/>`;
    body += `<text x="${x + w / 2}" y="${y0 + 18}" font-size="12" text-anchor="middle" fill="#333">${esc(g)}</text>`;
  });
  return svg(W, H, body + note(W, H));
}

/** Sigmoid dose-response curves for two conditions, log axis. */
export function doseResponse(seed: number, title: string, a: string, b: string): string {
  const r = rng(seed), W = 640, H = 400, x0 = 70, y0 = 330, top = 60, x1 = W - 30;
  const curve = (ec: number, hill: number, col: string) => {
    let d = "", dots = "";
    for (let i = 0; i <= 60; i++) { const lx = -3 + (i / 60) * 5, y = 100 / (1 + Math.pow(10, (ec - lx) * hill)); d += `${i ? "L" : "M"}${x0 + (i / 60) * (x1 - x0)},${y0 - (y / 100) * (y0 - top)}`; }
    for (let i = 0; i <= 8; i++) { const lx = -3 + (i / 8) * 5, y = 100 / (1 + Math.pow(10, (ec - lx) * hill)) + (r() - 0.5) * 9; dots += `<circle cx="${x0 + (i / 8) * (x1 - x0)}" cy="${y0 - (Math.max(0, Math.min(104, y)) / 100) * (y0 - top)}" r="4" fill="${col}"/>`; }
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5"/>${dots}`;
  };
  let body = `<text x="${x0}" y="34" font-size="18" font-weight="700" fill="#16161a">${esc(title)}</text>`;
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${y0}" stroke="#333"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#333"/>`;
  ["1 nM", "10 nM", "100 nM", "1 µM", "10 µM", "100 µM"].forEach((t, i) => body += `<text x="${x0 + (i / 5) * (x1 - x0)}" y="${y0 + 18}" font-size="11" text-anchor="middle" fill="#555">${t}</text>`);
  body += curve(-0.6 + r() * 0.6, 1.1, "#1B4FA0") + curve(0.4 + r() * 0.8, 0.9, "#B33600");
  body += `<rect x="${x1 - 170}" y="${top}" width="12" height="12" fill="#1B4FA0"/><text x="${x1 - 152}" y="${top + 11}" font-size="12" fill="#333">${esc(a)}</text>`;
  body += `<rect x="${x1 - 170}" y="${top + 20}" width="12" height="12" fill="#B33600"/><text x="${x1 - 152}" y="${top + 31}" font-size="12" fill="#333">${esc(b)}</text>`;
  body += `<text x="20" y="${(top + y0) / 2}" font-size="12" fill="#555" transform="rotate(-90 20 ${(top + y0) / 2})" text-anchor="middle">response (% of max)</text>`;
  return svg(W, H, body + note(W, H));
}

/** A western blot: lanes with bands of varying strength, a loading control below. */
export function westernBlot(seed: number, title: string, lanes: string[], target: string, control = "β-actin"): string {
  const r = rng(seed), W = 640, H = 380, x0 = 120, lw = (W - x0 - 30) / lanes.length;
  let body = `<text x="24" y="34" font-size="18" font-weight="700" fill="#16161a">${esc(title)}</text>`;
  lanes.forEach((l, i) => body += `<text x="${x0 + i * lw + lw / 2}" y="70" font-size="12" text-anchor="middle" fill="#333">${esc(l)}</text>`);
  const strip = (y: number, h: number, strength: (i: number) => number) => {
    let s = `<rect x="${x0 - 10}" y="${y}" width="${W - x0 - 10}" height="${h}" fill="#e9e7e3" rx="3"/>`;
    lanes.forEach((_, i) => { const o = strength(i); s += `<ellipse cx="${x0 + i * lw + lw / 2}" cy="${y + h / 2}" rx="${lw * 0.36}" ry="${h * 0.22}" fill="#141414" opacity="${o.toFixed(2)}" filter="url(#b)"/>`; });
    return s;
  };
  body += `<defs><filter id="b"><feGaussianBlur stdDeviation="2.2"/></filter></defs>`;
  body += strip(90, 70, (i) => Math.max(0.12, 0.95 - i * (0.12 + r() * 0.08)));
  body += `<text x="24" y="131" font-size="13" fill="#333">${esc(target)}</text>`;
  body += strip(190, 50, () => 0.7 + r() * 0.15);
  body += `<text x="24" y="221" font-size="13" fill="#333">${esc(control)}</text>`;
  body += `<text x="24" y="290" font-size="12" fill="#666">Quantified against the loading control, n = 3 blots.</text>`;
  return svg(W, H, body + note(W, H));
}

/** Fluorescence micrograph look: nuclei and a second channel on black, with a scale bar. */
export function micrograph(seed: number, label: string, colour = "#4ade80"): string {
  const r = rng(seed), W = 640, H = 480;
  let body = `<defs><filter id="g"><feGaussianBlur stdDeviation="3"/></filter><filter id="g2"><feGaussianBlur stdDeviation="7"/></filter></defs>`;
  for (let i = 0; i < 26; i++) {
    const x = 30 + r() * (W - 60), y = 30 + r() * (H - 90), rx = 16 + r() * 14, ry = rx * (0.7 + r() * 0.4), rot = r() * 180;
    body += `<ellipse cx="${x}" cy="${y}" rx="${rx * 2}" ry="${ry * 1.7}" transform="rotate(${rot} ${x} ${y})" fill="${colour}" opacity="${0.18 + r() * 0.3}" filter="url(#g2)"/>`;
    body += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#3b82f6" opacity="${0.6 + r() * 0.35}" filter="url(#g)"/>`;
  }
  body += `<rect x="${W - 130}" y="${H - 40}" width="90" height="5" fill="#fff"/><text x="${W - 85}" y="${H - 48}" font-size="12" fill="#fff" text-anchor="middle">50 µm</text>`;
  body += `<text x="16" y="28" font-size="14" fill="#fff" font-weight="600">${esc(label)}</text>`;
  return svg(W, H, body + note(W, H, "#8a8a8e"), "#050608");
}

/** Lines over time with a shaded band, e.g. a sensor log or a growth curve. */
export function timeSeries(seed: number, title: string, series: string[], unit: string): string {
  const r = rng(seed), W = 640, H = 380, x0 = 64, y0 = 320, top = 60, x1 = W - 24;
  const cols = ["#1B4FA0", "#B33600", "#0B7A4B", "#6B3FA0"];
  let body = `<text x="${x0}" y="34" font-size="18" font-weight="700" fill="#16161a">${esc(title)}</text>`;
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${y0}" stroke="#333"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#333"/>`;
  series.forEach((name, k) => {
    let v = 0.4 + r() * 0.2, d = "";
    for (let i = 0; i <= 80; i++) { v = Math.max(0.05, Math.min(0.95, v + (r() - 0.5) * 0.06 + (k === 1 && i > 50 ? 0.006 : 0))); d += `${i ? "L" : "M"}${x0 + (i / 80) * (x1 - x0)},${y0 - v * (y0 - top)}`; }
    body += `<path d="${d}" fill="none" stroke="${cols[k % 4]}" stroke-width="2"/><text x="${x1 - 6}" y="${top + 16 + k * 16}" font-size="12" text-anchor="end" fill="${cols[k % 4]}">${esc(name)}</text>`;
  });
  ["day 1", "day 2", "day 3", "day 4", "day 5", "day 6", "day 7"].forEach((t, i) => body += `<text x="${x0 + (i / 6) * (x1 - x0)}" y="${y0 + 18}" font-size="11" text-anchor="middle" fill="#555">${t}</text>`);
  body += `<text x="18" y="${(top + y0) / 2}" font-size="12" fill="#555" transform="rotate(-90 18 ${(top + y0) / 2})" text-anchor="middle">${esc(unit)}</text>`;
  return svg(W, H, body + note(W, H));
}

/** A scatter plot with a fitted line and r. */
export function scatter(seed: number, title: string, xl: string, yl: string): string {
  const r = rng(seed), W = 640, H = 420, x0 = 70, y0 = 350, top = 60, x1 = W - 30, slope = 0.4 + r() * 0.8;
  let body = `<text x="${x0}" y="34" font-size="18" font-weight="700" fill="#16161a">${esc(title)}</text>`;
  body += `<line x1="${x0}" y1="${top}" x2="${x0}" y2="${y0}" stroke="#333"/><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#333"/>`;
  for (let i = 0; i < 60; i++) { const x = r(), y = Math.max(0.02, Math.min(0.98, 0.1 + slope * x * 0.8 + (r() - 0.5) * 0.3)); body += `<circle cx="${x0 + x * (x1 - x0)}" cy="${y0 - y * (y0 - top)}" r="4" fill="#1B4FA0" opacity=".6"/>`; }
  body += `<line x1="${x0}" y1="${y0 - 0.1 * (y0 - top)}" x2="${x1}" y2="${y0 - (0.1 + slope * 0.8) * (y0 - top)}" stroke="#B33600" stroke-width="2.5"/>`;
  body += `<text x="${x1 - 10}" y="${top + 14}" font-size="13" text-anchor="end" fill="#B33600">r = ${(0.35 + slope * 0.4).toFixed(2)}</text>`;
  body += `<text x="${(x0 + x1) / 2}" y="${y0 + 32}" font-size="12" text-anchor="middle" fill="#555">${esc(xl)}</text>`;
  body += `<text x="20" y="${(top + y0) / 2}" font-size="12" fill="#555" transform="rotate(-90 20 ${(top + y0) / 2})" text-anchor="middle">${esc(yl)}</text>`;
  return svg(W, H, body + note(W, H));
}

/** A simple bench scene for stories: flasks, a pipette and a label. */
export function benchScene(seed: number, line: string, bg = "#0f172a"): string {
  const r = rng(seed), W = 720, H = 1280;
  const cols = ["#f59e0b", "#22c55e", "#3b82f6", "#ec4899", "#a78bfa"];
  let body = `<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#t)"/>`;
  body += `<rect x="0" y="${H * 0.68}" width="${W}" height="${H * 0.32}" fill="#1f2937"/>`;
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 120 + r() * 20, y = H * 0.68, h = 160 + r() * 110, c = cols[i % cols.length];
    body += `<path d="M${x},${y} L${x + 20},${y - h * 0.55} L${x + 20},${y - h} L${x + 50},${y - h} L${x + 50},${y - h * 0.55} L${x + 70},${y} Z" fill="#e5e7eb" opacity=".25" stroke="#e5e7eb" stroke-width="3"/>`;
    body += `<path d="M${x + 6},${y - 4} L${x + 23},${y - h * 0.42} L${x + 47},${y - h * 0.42} L${x + 64},${y - 4} Z" fill="${c}" opacity=".85"/>`;
  }
  body += `<rect x="${W * 0.62}" y="${H * 0.2}" width="18" height="420" rx="9" fill="#cbd5e1" transform="rotate(18 ${W * 0.62} ${H * 0.2})"/>`;
  body += `<text x="${W / 2}" y="${H * 0.86}" font-size="44" font-weight="700" fill="#fff" text-anchor="middle">${esc(line)}</text>`;
  return svg(W, H, body + note(W, H, "#94a3b8"), bg);
}

/** A conference poster board for stories. */
export function posterScene(seed: number, title: string): string {
  const r = rng(seed), W = 720, H = 1280;
  let body = `<rect width="${W}" height="${H}" fill="#1e1b4b"/><rect x="70" y="200" width="${W - 140}" height="760" rx="10" fill="#f8fafc"/>`;
  body += `<rect x="70" y="200" width="${W - 140}" height="110" rx="10" fill="#1B4FA0"/><text x="${W / 2}" y="268" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${esc(title)}</text>`;
  for (let c = 0; c < 3; c++) for (let k = 0; k < 4; k++) {
    const x = 100 + c * 180, y = 340 + k * 150;
    body += k % 2 ? `<rect x="${x}" y="${y}" width="150" height="120" fill="#e2e8f0"/><path d="M${x + 10},${y + 100} ${Array.from({ length: 6 }, (_, i) => `L${x + 10 + i * 26},${y + 100 - r() * 80}`).join(" ")}" fill="none" stroke="#B33600" stroke-width="3"/>`
      : `<rect x="${x}" y="${y}" width="150" height="10" fill="#94a3b8"/><rect x="${x}" y="${y + 22}" width="130" height="10" fill="#cbd5e1"/><rect x="${x}" y="${y + 44}" width="140" height="10" fill="#cbd5e1"/><rect x="${x}" y="${y + 66}" width="100" height="10" fill="#cbd5e1"/>`;
  }
  body += `<text x="${W / 2}" y="1080" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">Poster session, board 42</text>`;
  return svg(W, H, body + note(W, H, "#a5b4fc"), "#1e1b4b");
}
