// --- Parliament Kundli :: compatibility matrix ------------------------------

// Diverging 5-stop color scale, matching the CSS legend.
// Pass 8: desaturated continuum. Deep burgundy → terracotta → warm stone
// → sage → deep moss. No candy. Nothing shouts.
const COLOR_STOPS = [
  { t: 5,  c: '#8c3a4a' },  // deep burgundy (cursed)
  { t: 12, c: '#b8766b' },  // terracotta-rose (do not proceed)
  { t: 18, c: '#c8b8a0' },  // warm stone (threshold)
  { t: 26, c: '#8fa78f' },  // sage (solid)
  { t: 36, c: '#3c5f52' },  // deep moss (ordained)
];

function scoreColor(score) {
  if (score == null) return '#ececec';
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i], b = COLOR_STOPS[i + 1];
    if (score <= b.t) {
      const u = (score - a.t) / (b.t - a.t);
      return d3.interpolateRgb(a.c, b.c)(Math.max(0, Math.min(1, u)));
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].c;
}

function drawMatrix({ people, matches, order, onCellClick }) {
  const holder = document.getElementById('matrix');
  holder.innerHTML = '';

  const n = order.length;

  // Adaptive sizing: big rosters need tiny cells and no text labels.
  // Breakpoints chosen to keep the grid under ~1600px on a side.
  let CELL, LABEL_W, LABEL_H, showLabels;
  if (n <= 40)        { CELL = 22; LABEL_W = 230; LABEL_H = 150; showLabels = true;  }
  else if (n <= 100)  { CELL = 12; LABEL_W = 190; LABEL_H = 130; showLabels = true;  }
  else if (n <= 250)  { CELL = 5;  LABEL_W = 40;  LABEL_H = 40;  showLabels = false; }
  else                { CELL = 3;  LABEL_W = 30;  LABEL_H = 30;  showLabels = false; }

  const W = LABEL_W + CELL * n + 20;
  const H = LABEL_H + CELL * n + 20;

  const svg = d3.select(holder)
    .append('svg')
    .attr('id', 'matrix-svg')
    .attr('width', W).attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);

  const byName = new Map(people.map(p => [p.name, p]));
  const idx = new Map(order.map((name, i) => [name, i]));
  const pairKey = (a, b) => a < b ? `${a}|||${b}` : `${b}|||${a}`;
  const matchMap = new Map(matches.map(m => [pairKey(m.a, m.b), m]));

  const tip = ensureTooltip();

  if (showLabels) {
    // --- top labels (names rotated -60deg) ---
    svg.append('g')
      .attr('transform', `translate(${LABEL_W}, ${LABEL_H})`)
      .selectAll('text.top')
      .data(order)
      .join('text')
        .attr('class', d => `name-label top faction-${byName.get(d).faction}`)
        .attr('x', (_, i) => i * CELL + CELL * 0.5)
        .attr('y', -6)
        .attr('transform', (_, i) => `rotate(-60 ${i * CELL + CELL * 0.5} -6)`)
        .attr('text-anchor', 'start')
        .text(d => d);

    // --- left labels ---
    svg.append('g')
      .attr('transform', `translate(${LABEL_W - 8}, ${LABEL_H})`)
      .selectAll('text.left')
      .data(order)
      .join('text')
        .attr('class', d => `name-label left faction-${byName.get(d).faction}`)
        .attr('x', 0)
        .attr('y', (_, i) => i * CELL + CELL * 0.62)
        .attr('text-anchor', 'end')
        .text(d => d);
  }

  // --- grid ---
  const grid = svg.append('g')
    .attr('transform', `translate(${LABEL_W}, ${LABEL_H})`);

  const cellsData = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = order[i], b = order[j];
      const score = i === j ? null : (matchMap.get(pairKey(a, b))?.total ?? null);
      cellsData.push({ i, j, a, b, score });
    }
  }

  const gap = CELL >= 10 ? 1 : 0;
  const cells = grid.selectAll('rect.cell')
    .data(cellsData)
    .join('rect')
      .attr('class', d => d.i === d.j ? 'diagonal-cell' : 'matrix-cell')
      .attr('x', d => d.j * CELL)
      .attr('y', d => d.i * CELL)
      .attr('width', CELL - gap)
      .attr('height', CELL - gap)
      .attr('fill', d => d.i === d.j ? null : scoreColor(d.score))
      .attr('data-score', d => d.i === d.j || d.score == null ? '' : d.score)
      .style('transform-box', 'fill-box')
      .style('transform-origin', 'center')
      .on('mouseenter', function (ev, d) {
        if (d.i === d.j) return;
        showTip(tip, ev, d);
        d3.select(this).classed('active', true);
      })
      .on('mousemove', (ev) => moveTip(tip, ev))
      .on('mouseleave', function (ev, d) {
        hideTip(tip);
        d3.select(this).classed('active', false);
      })
      .on('click', (ev, d) => {
        if (d.i === d.j) return;
        onCellClick(d.a, d.b);
      });

  // Faction dividers: insert dashed lines where faction changes (only
  // meaningful in faction sort, but harmless otherwise)
  if (window.__PK_pulseTimer) { clearInterval(window.__PK_pulseTimer); window.__PK_pulseTimer = null; }
  let prevFaction = null;
  order.forEach((name, i) => {
    const f = byName.get(name).faction;
    if (prevFaction !== null && prevFaction !== f) {
      grid.append('line')
        .attr('class', 'faction-divider')
        .attr('x1', 0).attr('x2', n * CELL)
        .attr('y1', i * CELL).attr('y2', i * CELL);
      grid.append('line')
        .attr('class', 'faction-divider')
        .attr('y1', 0).attr('y2', n * CELL)
        .attr('x1', i * CELL).attr('x2', i * CELL);
    }
    prevFaction = f;
  });
}

// --- tooltip helpers --------------------------------------------------------

function ensureTooltip() {
  let tip = document.querySelector('.m-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'm-tip';
    document.body.appendChild(tip);
  }
  return tip;
}

function showTip(tip, ev, d) {
  const s = d.score == null ? '-' : d.score.toFixed(0);
  tip.innerHTML = `
    <div><span class="score">${s}</span><span style="font-family:var(--body);font-size:11px;color:var(--ink-dim);letter-spacing:0.08em">/36</span></div>
    <div class="t-names">${d.a} <span class="x">×</span> ${d.b}</div>
    <div class="hint">click to open breakdown</div>
  `;
  tip.classList.add('visible');
  moveTip(tip, ev);
}

function moveTip(tip, ev) {
  const pad = 14;
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  const r = tip.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8)  x = ev.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideTip(tip) {
  tip.classList.remove('visible');
}

// Pick legible text color for a given score chip. The pass-8 scale has
// dark extremes (burgundy < 10, moss > 28) that need white ink; the
// mid-range stone/sage takes black.
function scoreTextColor(score) {
  if (score == null) return '#111114';
  if (score < 11) return '#ffffff';   // burgundy → terracotta: white ink
  if (score > 28) return '#ffffff';   // sage-to-moss upper end: white ink
  return '#111114';                    // stone/sage mid: black ink
}

window.PK_drawMatrix = drawMatrix;
window.PK_scoreColor = scoreColor;
window.PK_scoreTextColor = scoreTextColor;
