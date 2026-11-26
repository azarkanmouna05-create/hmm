/* Small, accessible charts for hmm. (no library). Every chart is labelled directly, has a hover/tap tooltip
   (title), and a screen-reader table. Colours: validated chart palette (see styles: --viz-*). */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const srTable = (caption, rows) => `<table class="sr-only"><caption>${esc(caption)}</caption>${rows.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</table>`;

/* Vertical bars, one series. Highest bar emphasised (wireframe: "Step 3 · 41%"). */
export function columns(items, { caption = "", unit = "%" } = {}) {
  if (!items.length) return "";
  const max = Math.max(1, ...items.map((d) => d.value));
  const top = items.reduce((a, b) => (b.value > a.value ? b : a), items[0]);
  return `<figure class="viz-cols" role="img" aria-label="${esc(caption)}">
    <div class="viz-cols__plot">${items.map((d) => `
      <div class="viz-cols__col" title="${esc(d.label)}: ${d.value}${unit}">
        <span class="viz-cols__val">${d.value}${unit}</span>
        <span class="viz-cols__bar ${d === top ? "is-top" : ""}" style="height:${Math.max(4, Math.round(100 * d.value / max))}%"></span>
      </div>`).join("")}</div>
    <div class="viz-cols__axis">${items.map((d) => `<span title="${esc(d.label)}">${esc(d.short || d.label)}</span>`).join("")}</div>
    ${srTable(caption, items.map((d) => [d.label, d.value + unit]))}
  </figure>`;
}

/* Horizontal bars with labels (courses, misconceptions). */
export function hbars(items, { caption = "", color = "var(--viz-1)", unit = "" } = {}) {
  const max = Math.max(1, ...items.map((d) => d.value));
  return `<figure class="viz-hbars" aria-label="${esc(caption)}">${items.map((d) => `
    <div class="viz-hbars__row" title="${esc(d.label)}: ${d.value}${unit}">
      <span class="viz-hbars__label">${esc(d.label)}</span>
      <span class="viz-hbars__track"><span class="viz-hbars__bar" style="width:${Math.max(2, Math.round(100 * d.value / max))}%;background:${d.color || color}"></span></span>
      <b class="viz-hbars__val">${d.value}${unit}</b>
    </div>`).join("")}${srTable(caption, items.map((d) => [d.label, d.value + unit]))}</figure>`;
}

/* Donut + legend (≤ 3 categories here: the three characters). */
export function donut(items, { caption = "" } = {}) {
  const total = items.reduce((a, d) => a + d.value, 0) || 1;
  const R = 36, C = 2 * Math.PI * R; let off = 0;
  const arcs = items.map((d) => {
    const len = (d.value / total) * C; const gap = items.length > 1 ? 2 : 0;
    const a = `<circle r="${R}" cx="50" cy="50" fill="none" stroke="${d.color}" stroke-width="16" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}"><title>${esc(d.label)}: ${Math.round(100 * d.value / total)}%</title></circle>`;
    off += len; return a;
  }).join("");
  return `<figure class="viz-donut" aria-label="${esc(caption)}">
    <svg viewBox="0 0 100 100" width="104" height="104" role="img" aria-label="${esc(caption)}"><g transform="rotate(-90 50 50)">${arcs}</g></svg>
    <ul class="viz-legend">${items.map((d) => `<li><i style="background:${d.color}"></i>${esc(d.label)} <b>${Math.round(100 * d.value / total)}%</b></li>`).join("")}</ul>
    ${srTable(caption, items.map((d) => [d.label, Math.round(100 * d.value / total) + "%"]))}
  </figure>`;
}

/* One stacked bar (ordered categories, e.g. Gentle → Balanced → Tough), labelled inside. */
export function stack(items, { caption = "" } = {}) {
  const total = items.reduce((a, d) => a + d.value, 0) || 1;
  return `<figure class="viz-stack" role="img" aria-label="${esc(caption)}"><div class="viz-stack__bar">${items.map((d) => {
    const pct = Math.round(100 * d.value / total);
    return pct ? `<span style="flex:${d.value};background:${d.color};color:${d.ink || "#fff"}" title="${esc(d.label)}: ${pct}%">${pct >= 14 ? `${esc(d.label)} ${pct}%` : ""}</span>` : "";
  }).join("")}</div>${srTable(caption, items.map((d) => [d.label, Math.round(100 * d.value / total) + "%"]))}</figure>`;
}

/* Skills triangle (radar with 3 axes): Problem-solving (top), Explaining (right), Arguing (left). */
export function triangle({ solve = 0, explain = 0, argue = 0 }, { labels = ["Problem-solving", "Explaining", "Arguing"] } = {}) {
  const max = Math.max(10, solve, explain, argue);
  const cx = 110, cy = 92, R = 66;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * (2 * Math.PI / 3); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = (f) => [0, 1, 2].map((i) => pt(i, R * f).join(",")).join(" ");
  const vals = [solve, explain, argue];
  const shape = vals.map((v, i) => pt(i, R * Math.max(0.06, v / max)).join(",")).join(" ");
  const lab = [[cx, cy - R - 10, "middle"], [pt(1, R)[0] + 4, pt(1, R)[1] + 18, "middle"], [pt(2, R)[0] - 4, pt(2, R)[1] + 18, "middle"]];
  return `<figure class="viz-tri"><svg viewBox="0 0 220 190" role="img" aria-label="Skills map: ${labels.map((l, i) => l + " " + vals[i]).join(", ")}">
    ${[1, 0.66, 0.33].map((f) => `<polygon points="${ring(f)}" fill="none" stroke="var(--hairline)" stroke-width="1"/>`).join("")}
    ${[0, 1, 2].map((i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" stroke="var(--hairline)"/>`).join("")}
    <polygon points="${shape}" fill="hsl(var(--cham-h) 55% 45% / .28)" stroke="hsl(var(--cham-h) 55% 30%)" stroke-width="2" stroke-linejoin="round"/>
    ${vals.map((v, i) => { const [x, y] = pt(i, R * Math.max(0.06, v / max)); return `<circle cx="${x}" cy="${y}" r="4" fill="hsl(var(--cham-h) 55% 30%)"><title>${esc(labels[i])}: ${v}</title></circle>`; }).join("")}
    ${lab.map(([x, y, a], i) => `<text x="${x}" y="${y}" text-anchor="${a}" class="viz-tri__label">${esc(labels[i])} · ${vals[i]}</text>`).join("")}
  </svg></figure>`;
}

/* Segmented meter (x of n), e.g. class confidence, hint ladder. */
export const segments = (value, n = 5, { color = "var(--ink)", label = "" } = {}) =>
  `<span class="viz-seg" role="meter" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${value}" aria-label="${esc(label)}">${Array.from({ length: n }, (_, i) =>
    `<i style="${i < Math.round(value) ? `background:${color};border-color:${color}` : ""}"></i>`).join("")}</span>`;
