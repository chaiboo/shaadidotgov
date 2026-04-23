// --- Parliament Kundli :: shared astrology helpers --------------------------
//
// Devanagari labels, yoni glyphs, planetary rulers, navamsa helpers,
// North-Indian kundli drawer, nakshatra chakra drawer, zodiac wheel drawer.

(function (root) {

  // ----- Rashi (moon signs) ------------------------------------------------
  const RASHI_NAMES = [
    'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
  ];

  // ----- Classical elements per rashi (fire / earth / air / water) ---------
  //   Aries, Leo, Sagittarius           -> fire
  //   Taurus, Virgo, Capricorn          -> earth
  //   Gemini, Libra, Aquarius           -> air
  //   Cancer, Scorpio, Pisces           -> water
  const RASHI_ELEMENT = {
    Aries:'fire', Taurus:'earth', Gemini:'air', Cancer:'water',
    Leo:'fire', Virgo:'earth', Libra:'air', Scorpio:'water',
    Sagittarius:'fire', Capricorn:'earth', Aquarius:'air', Pisces:'water'
  };
  // Palette tuned to the pass-8 ink. Muted, desaturated.
  const ELEMENT_COLOR = {
    fire:  '#c06a3a',   // warm rust (matches NDA accent)
    earth: '#8fa78f',   // sage (matches score d-3)
    air:   '#3d5a80',   // the identity slate-blue
    water: '#3c5f52',   // deep moss (matches score d-4 / teal)
  };

  // ----- Constellation line-art per zodiac sign ---------------------------
  // Hand-built "joined-dots" point lists in a 0..100 × 0..100 box.
  // First point is the conventional alpha star; edges connect in order.
  // Drawn as a tiny monochrome line drawing — used next to people's names
  // and as a micro-watermark inside moon-sign wedges.
  const CONSTELLATION = {
    // Aries — two "horn" kinks from the head
    Aries:       { pts: [[18,38],[42,30],[62,42],[82,56]] },
    // Taurus — V for the Hyades + two horn tips
    Taurus:      { pts: [[14,70],[36,56],[54,40],[78,22]], extras: [[[36,56],[68,66]],[[54,40],[86,46]]] },
    // Gemini — the two castor/pollux lines (parallel)
    Gemini:      { pts: [[20,22],[30,48],[34,76]], extras: [[[58,18],[68,44],[72,72]],[[30,48],[68,44]]] },
    // Cancer — inverted Y
    Cancer:      { pts: [[50,18],[50,48],[24,72]], extras: [[[50,48],[76,72]]] },
    // Leo — the sickle + lion body
    Leo:         { pts: [[20,28],[32,22],[44,32],[48,48],[68,58],[80,72]], extras: [[[48,48],[44,66]]] },
    // Virgo — Y-shape
    Virgo:       { pts: [[16,28],[38,44],[58,38],[74,56],[68,78]], extras: [[[38,44],[46,72]]] },
    // Libra — kite
    Libra:       { pts: [[50,16],[22,48],[50,80],[78,48],[50,16]], extras: [[[22,48],[78,48]]] },
    // Scorpio — the curled tail
    Scorpio:     { pts: [[14,30],[26,40],[40,44],[56,40],[68,50],[78,66],[72,82],[56,84]] },
    // Sagittarius — the bow/teapot
    Sagittarius: { pts: [[18,70],[28,42],[46,28],[64,38],[78,62]], extras: [[[46,28],[58,58]],[[28,42],[64,38]]] },
    // Capricorn — sea-goat triangle
    Capricorn:   { pts: [[18,36],[38,26],[62,32],[80,50],[64,72],[38,68],[18,36]] },
    // Aquarius — Y and two ripples
    Aquarius:    { pts: [[24,32],[40,46],[56,34],[72,48],[86,36]], extras: [[[40,46],[40,72]],[[56,34],[56,66]]] },
    // Pisces — the two fish connected by the cord
    Pisces:      { pts: [[16,30],[28,36],[40,30],[52,40],[66,30],[78,38],[86,30]], extras: [[[52,40],[56,68]],[[56,68],[44,80]],[[56,68],[70,78]]] },
  };
  // U+FE0E (VS15) forces text presentation on platforms that otherwise draw
  // these codepoints as colour emoji.
  const RASHI_GLYPH = {
    Aries:'Mesha',Taurus:'Vrishabha',Gemini:'Mithuna',Cancer:'Karka',Leo:'Simha',Virgo:'Kanya',
    Libra:'Tula',Scorpio:'Vrishchika',Sagittarius:'Dhanu',Capricorn:'Makara',Aquarius:'Kumbha',Pisces:'Meena'
  };
  // Sanskrit names for the twelve rashis (North-Indian sidereal convention)
  const RASHI_DEV = {
    Aries:'मेष', Taurus:'वृषभ', Gemini:'मिथुन', Cancer:'कर्क',
    Leo:'सिंह', Virgo:'कन्या', Libra:'तुला', Scorpio:'वृश्चिक',
    Sagittarius:'धनु', Capricorn:'मकर', Aquarius:'कुम्भ', Pisces:'मीन'
  };
  // Planetary lord of each rashi (Graha Maitri key). Index = rashi 0..11
  //   Aries→Mars, Taurus→Venus, Gemini→Mercury, Cancer→Moon, Leo→Sun,
  //   Virgo→Mercury, Libra→Venus, Scorpio→Mars, Sagittarius→Jupiter,
  //   Capricorn→Saturn, Aquarius→Saturn, Pisces→Jupiter
  const RASHI_LORD = ['Mars','Venus','Mercury','Moon','Sun','Mercury',
                      'Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
  const PLANET_GLYPH = {
    Sun:'☉', Moon:'☾', Mars:'♂', Mercury:'☿',
    Jupiter:'♃', Venus:'♀', Saturn:'♄', Rahu:'☊', Ketu:'☋'
  };
  const PLANET_DEV = {
    Sun:'सूर्य', Moon:'चन्द्र', Mars:'मङ्गल', Mercury:'बुध',
    Jupiter:'गुरु', Venus:'शुक्र', Saturn:'शनि', Rahu:'राहु', Ketu:'केतु'
  };

  // ----- Nakshatras (27) ---------------------------------------------------
  const NAK_NAMES = [
    'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu',
    'Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta',
    'Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha',
    'Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada',
    'Uttara Bhadrapada','Revati'
  ];
  // Yoni animal + gender per nakshatra — mirrors js/ashtakoot.js
  const YONI_OF_NAK = [
    ['Horse','M'],['Elephant','M'],['Sheep','F'],['Serpent','M'],['Serpent','F'],
    ['Dog','F'],['Cat','F'],['Sheep','M'],['Cat','M'],['Rat','M'],['Rat','F'],
    ['Cow','F'],['Buffalo','M'],['Tiger','F'],['Buffalo','F'],['Tiger','M'],
    ['Deer','F'],['Deer','M'],['Dog','M'],['Monkey','M'],['Mongoose','M'],
    ['Monkey','F'],['Lion','F'],['Horse','F'],['Lion','M'],['Cow','M'],['Elephant','F']
  ];
  // Crude unicode yoni-animal glyphs (single codepoint; almanac style)
  const YONI_GLYPH = {
    Horse:'🐎', Elephant:'🐘', Sheep:'🐑', Serpent:'🐍',
    Dog:'🐕', Cat:'🐈', Rat:'🐀', Cow:'🐄',
    Buffalo:'🐃', Tiger:'🐅', Deer:'🦌', Monkey:'🐒',
    Mongoose:'🦡', Lion:'🦁'
  };
  // Gana (devata/manushya/rakshasa) per nakshatra — needed only for planetary lord label
  // For the Graha-Maitri-esque per-person lord display, we use the rashi lord.

  function elementOf(rashiName) { return RASHI_ELEMENT[rashiName] || 'air'; }
  function elementColor(rashiName) { return ELEMENT_COLOR[elementOf(rashiName)]; }

  // ----- Moon phase from a date -------------------------------------------
  //  Simple synodic-month approximation (Meeus 49.1, truncated). Returns
  //  phase in [0, 1): 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last.
  function moonPhaseFraction(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    // Julian date for the given UT midnight
    const Y = d.getUTCFullYear(), M = d.getUTCMonth() + 1, D = d.getUTCDate();
    let y = Y, m = M;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + D + B - 1524.5;
    // Reference new moon: 2000 Jan 6, 18:14 UT = JD 2451550.26
    const synodic = 29.530588853;
    let phase = ((JD - 2451550.26) / synodic) % 1;
    if (phase < 0) phase += 1;
    return phase;
  }

  // Build a little moon-phase SVG (14px) showing the current illumination.
  // Line-art, monochrome, matches Co-Star's visual register.
  function moonPhaseSvg(phase, size) {
    size = size || 14;
    const r = size / 2 - 1;
    const cx = size / 2, cy = size / 2;
    // Illuminated fraction (0 = new, 1 = full, 0 again at next new)
    const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    // Limb: right side illuminated in waxing half (phase < 0.5), left in waning
    const waxing = phase < 0.5;
    // Terminator is a half-ellipse inside the full disk. Width goes
    // |illum - 0.5| * 2 * r in ellipse minor axis.
    const k = Math.abs(illum - 0.5) * 2;  // 0..1
    const rx = r * k;
    const ry = r;
    // Two arcs make the illuminated shape:
    //  - half-circle on the lit side (large arc)
    //  - half-ellipse terminator (curving same way if gibbous, other if crescent)
    //   sweep flag controls which way the ellipse bulges.
    const litRight = waxing;  // waxing = lit on the right
    const bulgeOut = illum > 0.5; // gibbous: terminator bulges toward the unlit side
    // Start / end points on the limb
    const top = `${cx},${cy - r}`;
    const bot = `${cx},${cy + r}`;
    // Arc 1: half of the full moon circle from top to bot, through the lit side
    const sweepCircle = litRight ? 1 : 0;
    // Arc 2: terminator ellipse from bot to top
    const sweepEllipse = litRight
      ? (bulgeOut ? 1 : 0)
      : (bulgeOut ? 0 : 1);
    const d = `M ${top} A ${r} ${r} 0 0 ${sweepCircle} ${bot} A ${rx} ${ry} 0 0 ${sweepEllipse} ${top} Z`;
    return `
      <svg class="moon-phase-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-width="0.9"/>
        <path d="${d}" fill="currentColor" opacity="0.9"/>
      </svg>
    `;
  }

  // Human-readable tag for a phase fraction
  function moonPhaseLabel(phase) {
    if (phase == null) return '';
    if (phase < 0.03 || phase > 0.97) return 'new moon';
    if (phase < 0.22) return 'waxing crescent';
    if (phase < 0.28) return 'first quarter';
    if (phase < 0.47) return 'waxing gibbous';
    if (phase < 0.53) return 'full moon';
    if (phase < 0.72) return 'waning gibbous';
    if (phase < 0.78) return 'last quarter';
    return 'waning crescent';
  }

  // ----- Constellation SVG builder ----------------------------------------
  // Builds a self-contained inline SVG of a zodiac constellation. Used in
  // pair-drawer person blocks. Line + dot, monochrome slate-blue.
  function constellationSvg(rashiName, opts) {
    opts = opts || {};
    const c = CONSTELLATION[rashiName];
    if (!c) return '';
    const w = opts.w || 54;
    const h = opts.h || 34;
    // Scale 0..100 box into the w×h box with a small margin
    const pad = 4;
    const sx = (x) => pad + (x / 100) * (w - pad * 2);
    const sy = (y) => pad + (y / 100) * (h - pad * 2);
    const linePts = c.pts.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
    let extras = '';
    if (c.extras) {
      c.extras.forEach(seg => {
        const [a, b] = seg;
        extras += `<line x1="${sx(a[0]).toFixed(1)}" y1="${sy(a[1]).toFixed(1)}" x2="${sx(b[0]).toFixed(1)}" y2="${sy(b[1]).toFixed(1)}"/>`;
      });
    }
    // Dots at every star
    const allPts = [...c.pts];
    if (c.extras) c.extras.forEach(seg => { allPts.push(seg[0]); allPts.push(seg[1]); });
    // Dedup roughly
    const seen = new Set();
    const dots = allPts.filter(p => {
      const k = p[0] + ',' + p[1];
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).map(p => `<circle cx="${sx(p[0]).toFixed(1)}" cy="${sy(p[1]).toFixed(1)}" r="1.1"/>`).join('');
    return `
      <svg class="constellation-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round">
          <polyline points="${linePts}"/>
          ${extras}
        </g>
        <g fill="currentColor" stroke="none">${dots}</g>
      </svg>
    `;
  }

  function lordOf(rashiName) { return RASHI_LORD[RASHI_NAMES.indexOf(rashiName)] || null; }
  function lordGlyph(rashiName) { const p = lordOf(rashiName); return p ? PLANET_GLYPH[p] : '?'; }
  function lordDev(rashiName)   { const p = lordOf(rashiName); return p ? PLANET_DEV[p]   : ''; }
  function yoniAnimalOf(nakName) {
    const i = NAK_NAMES.indexOf(nakName);
    if (i < 0) return null;
    return YONI_OF_NAK[i][0];
  }
  function yoniGlyphOf(nakName) {
    const a = yoniAnimalOf(nakName);
    return a ? (YONI_GLYPH[a] || '') : '';
  }

  // ----- Nakshatra chakra (27-pointed lunar wheel) -------------------------
  // Draws a ring with 27 spokes, tick every spoke, a center label, and plots
  // both person's moon longitudes as colored arcs (pada width = 3°20').
  function drawNakshatraChakra(container, a, b) {
    const size = 280;
    const cx = size / 2, cy = size / 2;
    const rOuter = 120, rInner = 98, rTick = 125, rLabel = 134;
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${size + 30} ${size + 40}`)
      .attr('width', size + 30).attr('height', size + 40);
    const g = svg.append('g').attr('transform', `translate(15, 20)`);

    // Ring + inner ring
    g.append('circle').attr('class', 'nc-ring').attr('cx', cx).attr('cy', cy).attr('r', rOuter);
    g.append('circle').attr('class', 'nc-ring').attr('cx', cx).attr('cy', cy).attr('r', rInner);

    // 27 spokes + ticks + labels
    // 0° (Ashwini start) at top (12 o'clock). Going clockwise.
    for (let i = 0; i < 27; i++) {
      const theta = (i / 27) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + Math.cos(theta) * rInner;
      const y1 = cy + Math.sin(theta) * rInner;
      const x2 = cx + Math.cos(theta) * rOuter;
      const y2 = cy + Math.sin(theta) * rOuter;
      g.append('line').attr('class','nc-spoke')
        .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
      // Mid-tick (between spoke i and i+1) where we'll label & plot
      const tMid = theta + (Math.PI / 27);
      const tx1 = cx + Math.cos(tMid) * rOuter;
      const ty1 = cy + Math.sin(tMid) * rOuter;
      const tx2 = cx + Math.cos(tMid) * rTick;
      const ty2 = cy + Math.sin(tMid) * rTick;
      g.append('line').attr('class','nc-tick')
        .attr('x1', tx1).attr('y1', ty1).attr('x2', tx2).attr('y2', ty2);
      const lx = cx + Math.cos(tMid) * rLabel;
      const ly = cy + Math.sin(tMid) * rLabel;
      // Rotate so short labels stay readable; flip on bottom half
      const deg = (tMid * 180 / Math.PI);
      const flip = (deg > 90 && deg < 270);
      const rot = flip ? (deg + 180) : deg;
      g.append('text').attr('class','nc-nak-label')
        .attr('x', lx).attr('y', ly)
        .attr('text-anchor', flip ? 'end' : 'start')
        .attr('dominant-baseline','middle')
        .attr('transform', `rotate(${rot} ${lx} ${ly})`)
        .text((i+1) + '. ' + NAK_NAMES[i].split(' ')[0]);
    }

    // Plot each person's moon as a colored arc (pada = 3°20')
    // Moon longitude 0-360 maps to angle 0-2pi starting at top.
    function plotArc(p, cls) {
      const lon = p.moon_lon % 360;
      const t0 = (lon / 360) * 2 * Math.PI - Math.PI / 2;
      // 3°20' = 3.333° arc spanning the pada
      const span = (3.3333 / 360) * 2 * Math.PI;
      const arc = d3.arc()
        .innerRadius((rOuter + rInner) / 2 - 1)
        .outerRadius((rOuter + rInner) / 2 + 1)
        .startAngle(t0 + Math.PI / 2)  // d3 arc measures from 12 o'clock
        .endAngle(t0 + Math.PI / 2 + span);
      g.append('path').attr('class', cls)
        .attr('d', arc())
        .attr('transform', `translate(${cx},${cy})`)
        .attr('stroke-linecap','round');
      // Center dot
      const mid = t0 + span / 2;
      const dx = cx + Math.cos(mid) * ((rOuter + rInner) / 2);
      const dy = cy + Math.sin(mid) * ((rOuter + rInner) / 2);
      g.append('circle')
        .attr('cx', dx).attr('cy', dy).attr('r', 3.5)
        .attr('class', cls.replace('-arc-','-dot-'));
      return { dx, dy };
    }
    const A = plotArc(a, 'nc-arc-A');
    const B = plotArc(b, 'nc-arc-B');

    // Chord between the two moons — color by gana-ish agreement (use total for now)
    // Chord rendered as dashed line; color derived by caller via CSS on .nc-chord
    g.append('line')
      .attr('class','nc-chord')
      .attr('x1', A.dx).attr('y1', A.dy)
      .attr('x2', B.dx).attr('y2', B.dy)
      .attr('stroke', 'var(--ink)');

    // Center Devanagari label: नक्षत्र चक्र
    g.append('text').attr('class','nc-center-label')
      .attr('x', cx).attr('y', cy - 6)
      .text('नक्षत्र');
    g.append('text').attr('class','nc-center-label')
      .attr('x', cx).attr('y', cy + 6)
      .text('चक्र');
    // Tiny 27 number below
    g.append('text').attr('class','nc-center-label')
      .attr('x', cx).attr('y', cy + 18)
      .style('fill', 'var(--muted)').style('font-family','var(--mono)')
      .text('२७');
  }

  // ----- North-Indian kundli (diamond-in-square) ---------------------------
  // Houses are fixed positions in the frame. House 1 = Ascendant (top-center
  // diamond). Moon-only chart: we just place the Moon glyph in the house that
  // corresponds to the Moon's rashi, counting from the person's ascendant.
  //
  // We don't have a real lagna (we don't have birth time for most), so the
  // tradition this project already follows — assume noon chart — means we
  // instead draw a *rashi kundli* where the Moon's rashi is placed in its
  // own house (house = rashi number + 1). This is a Chandra Kundli, which
  // is entirely legitimate in Jyotish when the lagna is uncertain.
  //
  // House positions (in a unit square 0..100): each house is a triangle
  // pointing inward. We compute centroids for each of the 12 houses.
  //
  // North-Indian layout house ordering (anti-clockwise from top-center):
  //   1 = top diamond (up)
  //   2 = top-left (triangle pointing down-right from upper-left corner)
  //   3 = left diamond (left)  --> actually next along the top-left edge
  //
  // The canonical 12-house layout has these centroids:
  const HOUSE_CENTROIDS = [
    { x: 50, y: 23 },   // 1 — top diamond
    { x: 27, y: 12 },   // 2 — top-left triangle
    { x: 12, y: 27 },   // 3 — upper-left diamond corner
    { x: 27, y: 50 },   // 4 — left diamond (west)
    { x: 12, y: 73 },   // 5 — lower-left diamond corner
    { x: 27, y: 88 },   // 6 — bottom-left triangle
    { x: 50, y: 77 },   // 7 — bottom diamond
    { x: 73, y: 88 },   // 8 — bottom-right triangle
    { x: 88, y: 73 },   // 9 — lower-right diamond corner
    { x: 73, y: 50 },   // 10 — right diamond (east)
    { x: 88, y: 27 },   // 11 — upper-right diamond corner
    { x: 73, y: 12 },   // 12 — top-right triangle
  ];

  function drawKundli(container, person, opts = {}) {
    const side = opts.side || 'A';
    const size = opts.size || 150;
    const svg = d3.select(container).append('svg')
      .attr('class', `kundli-svg k-side-${side}`)
      .attr('viewBox', '0 0 100 100')
      .attr('width', size).attr('height', size);
    // Outer square (bold frame)
    svg.append('rect').attr('class','k-outer')
      .attr('x', 1.5).attr('y', 1.5).attr('width', 97).attr('height', 97);
    // Diamond (rotated square) — vertices at mid of each side
    svg.append('polygon').attr('class','k-frame')
      .attr('points', '50,1.5 98.5,50 50,98.5 1.5,50');
    // Two diagonals of the outer square
    svg.append('line').attr('class','k-frame')
      .attr('x1', 1.5).attr('y1', 1.5).attr('x2', 98.5).attr('y2', 98.5);
    svg.append('line').attr('class','k-frame')
      .attr('x1', 98.5).attr('y1', 1.5).attr('x2', 1.5).attr('y2', 98.5);

    // Rashi Kundli (Chandra chart): Aries-lagna convention — house i holds
    // rashi i. We plot the Moon in the house equal to moon_rashi+1, Sun in
    // sun_rashi+1.
    const moonHouse = person.moon_rashi + 1;
    const sunHouse  = person.sun_rashi + 1;

    HOUSE_CENTROIDS.forEach((c, i) => {
      const house = i + 1;
      const rashiNum = ((house - 1) % 12) + 1;
      // faint house-corner numeral (top-left of the cell)
      svg.append('text').attr('class','k-house-num')
        .attr('x', c.x - 10).attr('y', c.y - 8)
        .attr('text-anchor','start')
        .text(rashiNum);
      // Moon
      if (house === moonHouse) {
        svg.append('text').attr('class','k-planet moon')
          .attr('x', c.x).attr('y', c.y + (house === sunHouse ? -2 : 2))
          .attr('text-anchor','middle').attr('dominant-baseline','middle')
          .text('☾');
      }
      // Sun (same house: offset)
      if (house === sunHouse) {
        const dy = (house === moonHouse) ? 8 : 2;
        svg.append('text').attr('class','k-planet sun')
          .attr('x', c.x).attr('y', c.y + dy)
          .attr('text-anchor','middle').attr('dominant-baseline','middle')
          .text('☉');
      }
    });

    return svg;
  }

  // ----- Small compact kundli (MP card) ------------------------------------
  function drawKundliCompact(container, person) {
    return drawKundli(container, person, { size: 110, side: 'A' });
  }

  // ----- Zodiac wheel (moon-signs tab) -------------------------------------
  // 12-wedge rose: each wedge colored by over/under/mid relative to expected.
  function drawZodiacWheel(container, counts, total) {
    const RASHI_ORDER = RASHI_NAMES;
    const expected = total / 12;
    const size = 280;
    const cx = size / 2, cy = size / 2;
    const rOuter = 120, rInner = 44;
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${size} ${size}`)
      .attr('width', size).attr('height', size);

    const pie = d3.pie().value(1).sort(null);
    const data = RASHI_ORDER.map(r => ({ rashi: r, n: counts[r] || 0 }));
    // Start at top (Aries at 12 o'clock), going clockwise
    pie.startAngle(-Math.PI / 12).endAngle(2 * Math.PI - Math.PI / 12);
    const arcs = pie(data);

    // Wedge radius scales with count: expected = mid radius. Max n → rOuter.
    // So the wheel reads as a radial bar chart + proportional wedge.
    const nMax = Math.max(...data.map(d => d.n), 1);
    const arcMid = d3.arc().innerRadius((rOuter + rInner) / 2).outerRadius((rOuter + rInner) / 2);

    // Outer & inner rings + an expected ring to mark the 'fair share' line
    svg.append('circle').attr('class','sw-ring')
      .attr('cx', cx).attr('cy', cy).attr('r', rOuter);
    svg.append('circle').attr('class','sw-ring')
      .attr('cx', cx).attr('cy', cy).attr('r', rInner);
    const rExpected = rInner + (rOuter - rInner) * (expected / nMax);
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', rExpected)
      .attr('fill','none')
      .attr('stroke', 'var(--accent)')
      .attr('stroke-width', 0.8)
      .attr('stroke-dasharray','2 2')
      .attr('opacity', 0.7);

    arcs.forEach(a => {
      const d = a.data;
      const rThis = rInner + (rOuter - rInner) * (d.n / nMax);
      const over  = d.n > expected * 1.1;
      const under = d.n < expected * 0.9;
      const cls = over ? 'over' : under ? 'under' : 'mid';
      const arc = d3.arc().innerRadius(rInner).outerRadius(rThis);
      svg.append('path')
        .attr('class', `sw-wedge ${cls}`)
        .attr('d', arc.startAngle(a.startAngle).endAngle(a.endAngle)())
        .attr('transform', `translate(${cx}, ${cy})`);
      // Outer backdrop wedge (faint) so the "missing" portion is visible
      const arcBg = d3.arc().innerRadius(rThis).outerRadius(rOuter);
      svg.append('path')
        .attr('d', arcBg.startAngle(a.startAngle).endAngle(a.endAngle)())
        .attr('transform', `translate(${cx}, ${cy})`)
        .attr('fill','rgba(17,17,20,0.03)')
        .attr('stroke','rgba(17,17,20,0.14)')
        .attr('stroke-width', 0.5);

      // Glyph on the outer ring (outside the wedge)
      const arcOuter = d3.arc().innerRadius(rOuter + 10).outerRadius(rOuter + 10);
      const [gx, gy] = arcOuter.centroid({ ...a });
      svg.append('text').attr('class','sw-glyph')
        .attr('x', cx + gx).attr('y', cy + gy)
        .attr('fill', 'var(--ink)')
        .style('font-size','14px')
        .text(RASHI_GLYPH[d.rashi]);
      // Count at wedge midpoint (display serif)
      const arcCount = d3.arc().innerRadius((rInner + rThis) / 2).outerRadius((rInner + rThis) / 2);
      const [cxG, cyG] = arcCount.centroid({ ...a });
      svg.append('text').attr('class','sw-count')
        .attr('x', cx + cxG).attr('y', cy + cyG)
        .attr('fill', (cls === 'over' || cls === 'under') ? '#fff' : 'var(--ink-deep)')
        .style('font-size','14px')
        .style('font-family', "'Inter', system-ui, sans-serif")
        .style('font-weight', '500')
        .style('font-style', 'normal')
        .style('letter-spacing', '-0.02em')
        .text(d.n);
    });

    // Spokes (thin dividing lines between wedges — already via path stroke,
    // but add cleaner lines anyway)
    arcs.forEach(a => {
      const ang = a.startAngle - Math.PI / 2;
      svg.append('line').attr('class','sw-spoke')
        .attr('x1', cx + Math.cos(ang) * rInner)
        .attr('y1', cy + Math.sin(ang) * rInner)
        .attr('x2', cx + Math.cos(ang) * rOuter)
        .attr('y2', cy + Math.sin(ang) * rOuter);
    });

    // Center
    svg.append('circle').attr('class','sw-center')
      .attr('cx', cx).attr('cy', cy).attr('r', rInner - 4);
    svg.append('text').attr('class','sw-center-text')
      .attr('x', cx).attr('y', cy - 12)
      .text('Total');
    svg.append('text').attr('class','sw-center-num')
      .attr('x', cx).attr('y', cy + 4)
      .text(total);
    svg.append('text').attr('class','sw-center-text')
      .attr('x', cx).attr('y', cy + 20)
      .style('fill', 'var(--ink-3)')
      .style('font-size','8px')
      .text('Moons');
  }

  // ----- Masthead chakra spokes --------------------------------------------
  function mountMastheadChakra() {
    const el = document.getElementById('chakra-spokes');
    if (!el) return;
    // 27 spokes
    const r0 = 12, r1 = 34, r2 = 44;
    for (let i = 0; i < 27; i++) {
      const a = (i / 27) * 2 * Math.PI - Math.PI / 2;
      const x1 = Math.cos(a) * r0, y1 = Math.sin(a) * r0;
      const x2 = Math.cos(a) * r1, y2 = Math.sin(a) * r1;
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke','currentColor');
      line.setAttribute('stroke-width', i % 3 === 0 ? '1.2' : '0.6');
      line.setAttribute('opacity', i % 3 === 0 ? '1' : '0.6');
      el.appendChild(line);
      // Tiny outer tick every 3rd
      if (i % 3 === 0) {
        const tx1 = Math.cos(a) * r1, ty1 = Math.sin(a) * r1;
        const tx2 = Math.cos(a) * r2, ty2 = Math.sin(a) * r2;
        const t = document.createElementNS('http://www.w3.org/2000/svg','line');
        t.setAttribute('x1', tx1); t.setAttribute('y1', ty1);
        t.setAttribute('x2', tx2); t.setAttribute('y2', ty2);
        t.setAttribute('stroke','currentColor');
        t.setAttribute('stroke-width','1.4');
        el.appendChild(t);
      }
    }
  }

  root.PK_astro = {
    RASHI_NAMES, RASHI_GLYPH, RASHI_DEV, RASHI_LORD,
    PLANET_GLYPH, PLANET_DEV,
    NAK_NAMES, YONI_OF_NAK, YONI_GLYPH,
    lordOf, lordGlyph, lordDev, yoniAnimalOf, yoniGlyphOf,
    drawNakshatraChakra, drawKundli, drawKundliCompact,
    drawZodiacWheel, mountMastheadChakra,
  };

})(window);
