// --- Parliament Kundli :: tabbed app orchestrator ---------------------------
//
// Loads four datasets:
//   data/kundlis.json      -- the curated India cabinet (40, pre-computed)
//   data/country_IN.json   -- 476 Lok Sabha MPs
//   data/country_US.json   -- 531 US congresspeople
//   data/country_UK.json   -- 421 UK Commons MPs
// Plus keeps everyone in a flat list keyed by "country|name" for cross-search.
//
// The Ashtakoot scorer is ported to JS (js/ashtakoot.js) so pair details
// are computed on demand -- no precomputed match lookup required.

(async function () {
  // ----- Load + unify dataset -------------------------------------------
  const [cab, IN, US, UK] = await Promise.all([
    fetch('data/kundlis.json').then(r => r.json()),
    fetch('data/country_IN.json').then(r => r.json()),
    fetch('data/country_US.json').then(r => r.json()),
    fetch('data/country_UK.json').then(r => r.json()),
  ]);

  // Cabinet: promote `faction` -> `bloc` so the matrix code shares colouring
  cab.people.forEach(p => { p.bloc = p.faction; p.country = 'IN'; p.notable = true; });

  const all = {
    IN: IN.people,
    US: US.people,
    UK: UK.people,
    ALL: [...IN.people, ...US.people, ...UK.people],
  };
  const countryLabel = {
    IN: '18th Lok Sabha',
    US: '119th US Congress',
    UK: 'UK Commons (2024)',
    ALL: 'All three houses',
  };

  // Put the curated cabinet on top of IN (deduplicated), so when you're in
  // the India roster you find Sitharaman / Jaishankar etc even though they
  // aren't elected MPs.
  const inByName = new Set(all.IN.map(p => p.name));
  cab.people.forEach(p => { if (!inByName.has(p.name)) all.IN.push(p); });
  all.ALL = [...all.IN, ...all.US, ...all.UK];

  // Quick index
  const byKey = new Map();
  const keyOf = p => `${p.country}|${p.name}`;
  for (const p of all.ALL) byKey.set(keyOf(p), p);

  const scoreFn = window.PK_ashtakoot.score;

  // ----- State ----------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const startTab = ['matches','grid','parties','find','extremes','signs','about'].includes(params.get('tab'))
    ? params.get('tab') : 'matches';
  const startCountry = ['IN','US','UK','ALL'].includes(params.get('country'))
    ? params.get('country') : 'IN';
  const state = {
    tab: startTab,
    country: startCountry,
    matchMode: 'random',
    pickedA: null,
    pickedB: null,
  };
  // Apply initial tab/country visually
  if (startTab !== 'matches') {
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === startTab));
    document.querySelectorAll('.tab-panel').forEach(sec => sec.classList.toggle('active', sec.id === `tab-${startTab}`));
  }
  if (startCountry !== 'IN') {
    document.querySelectorAll('.cp').forEach(b => b.classList.toggle('active', b.dataset.country === startCountry));
  }

  // ----- Country theme apply (data-country on <html>) ------------------
  function applyCountryTheme() {
    document.documentElement.setAttribute('data-country', state.country);
  }

  function syncPillsDisabled() {
    const pills = document.getElementById('country-pills');
    const disable = state.tab === 'about';
    pills.classList.toggle('disabled', disable);
  }

  // ----- Tab bar --------------------------------------------------------
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach(sec => {
        sec.classList.toggle('active', sec.id === `tab-${state.tab}`);
      });
      renderActive();
      syncPillsDisabled();
    });
  });

  document.querySelectorAll('.cp').forEach(btn => {
    btn.addEventListener('click', () => {
      state.country = btn.dataset.country;
      document.querySelectorAll('.cp').forEach(b => b.classList.toggle('active', b === btn));
      applyCountryTheme();
      renderCpNote();
      renderTicker();
      renderActive();
    });
  });

  function renderCpNote() {
    const el = document.getElementById('cp-note');
    if (!el) return;
    const d = state.country === 'IN' ? all.IN.length
            : state.country === 'US' ? all.US.length
            : state.country === 'UK' ? all.UK.length
            : all.ALL.length;
    el.textContent = `— ${d.toLocaleString()} souls currently on file`;
  }

  function renderActive() {
    if      (state.tab === 'matches')  renderMatches();
    else if (state.tab === 'grid')     renderGrid();
    else if (state.tab === 'parties')  renderParties();
    else if (state.tab === 'find')     renderFind();
    else if (state.tab === 'extremes') renderExtremes();
    else if (state.tab === 'signs')    renderSigns();
    else if (state.tab === 'about')    renderAbout();
  }

  // ----- Pair drawer wiring --------------------------------------------
  document.getElementById('close-pair').addEventListener('click', window.PK_closePair);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.PK_closePair(); });

  function openPair(a, b) {
    const s = scoreFn(a, b);
    window.PK_renderPair(a, b, s);
  }
  window.PK_openPair = openPair;

  // ----- Logo click: random cosmically-ordained pair surprise ----------
  const logoGroup = document.getElementById('logo-group');
  if (logoGroup) {
    logoGroup.addEventListener('click', (ev) => {
      ev.preventDefault();
      const ordained = cab.matches.filter(m => m.total >= 30);
      let a, b;
      if (ordained.length) {
        const pick = ordained[Math.floor(Math.random() * ordained.length)];
        a = cab.people.find(p => p.name === pick.a);
        b = cab.people.find(p => p.name === pick.b);
      } else {
        const pool = all[state.country];
        a = pool[Math.floor(Math.random() * pool.length)];
        b = pool[Math.floor(Math.random() * pool.length)];
        if (a === b) b = pool[(pool.indexOf(b) + 1) % pool.length];
      }
      if (a && b) openPair(a, b);
    });
  }

  // ======================================================================
  // TAB: The grid (roster-wide matrix, country-aware)
  // ======================================================================
  const FACTION_ORDER_IN = { 'NDA': 0, 'Other': 1, 'INDIA': 2 };
  const RASHI_ORDER = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
    'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  const TODAY = new Date();
  function ageOf(p) {
    if (!p.dob) return null;
    const d = new Date(p.dob);
    if (isNaN(d)) return null;
    let a = TODAY.getFullYear() - d.getFullYear();
    const m = TODAY.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && TODAY.getDate() < d.getDate())) a--;
    return a;
  }
  const AGE_BUCKETS = [
    { key: 'u40', label: 'under 40',  test: a => a < 40 },
    { key: '40s', label: '40s',       test: a => a >= 40 && a < 50 },
    { key: '50s', label: '50s',       test: a => a >= 50 && a < 60 },
    { key: '60s', label: '60s',       test: a => a >= 60 && a < 70 },
    { key: '70s', label: '70s',       test: a => a >= 70 && a < 80 },
    { key: '80p', label: '80 and up', test: a => a >= 80 },
  ];

  function renderGrid() {
    const sortSel = document.getElementById('grid-sort');
    const f = {
      notable: document.getElementById('filter-notable'),
      bloc:    document.getElementById('filter-bloc'),
      party:   document.getElementById('filter-party'),
      state:   document.getElementById('filter-state'),
      gender:  document.getElementById('filter-gender'),
      age:     document.getElementById('filter-age'),
      sign:    document.getElementById('filter-sign'),
    };

    // Base pool: dedupe the active country's roster.
    const basePool = dedupe(all[state.country]);

    // Tally bloc / party / state / moon-sign / gender / age counts.
    const blocCounts = {}, partyCounts = {}, stateCounts = {}, signCounts = {};
    const genderCounts = { male: 0, female: 0, other: 0 };
    let genderKnown = 0;
    const ageCounts = Object.fromEntries(AGE_BUCKETS.map(b => [b.key, 0]));
    let ageKnown = 0;
    basePool.forEach(p => {
      const b = p.bloc || 'Other';
      blocCounts[b] = (blocCounts[b] || 0) + 1;
      if (p.party) partyCounts[p.party] = (partyCounts[p.party] || 0) + 1;
      if (p.state) stateCounts[p.state] = (stateCounts[p.state] || 0) + 1;
      if (p.moon_rashi_name) signCounts[p.moon_rashi_name] = (signCounts[p.moon_rashi_name] || 0) + 1;
      if (p.gender === 'male' || p.gender === 'female') { genderCounts[p.gender]++; genderKnown++; }
      else if (p.gender) { genderCounts.other++; genderKnown++; }
      const a = ageOf(p);
      if (a != null) {
        ageKnown++;
        const bucket = AGE_BUCKETS.find(b => b.test(a));
        if (bucket) ageCounts[bucket.key]++;
      }
    });
    const blocs = Object.entries(blocCounts).sort((a,b) => b[1]-a[1]).map(([b]) => b);

    // Populate each filter select. Save/restore previous user selections.
    const prev = Object.fromEntries(Object.entries(f).map(([k, sel]) => [k, sel.value]));

    function showOrHide(kind, show) {
      const label = document.querySelector(`[data-filter="${kind}"]`);
      if (label) label.style.display = show ? '' : 'none';
    }

    function mount(kind, optionsHtml, available) {
      f[kind].innerHTML = `<option value="all">all</option>` + optionsHtml;
      const hasPrev = [...f[kind].options].some(o => o.value === prev[kind]);
      f[kind].value = hasPrev ? prev[kind] : 'all';
      showOrHide(kind, available);
    }

    // list (cabinet toggle — IN only)
    const notableN = basePool.filter(p => p.notable).length;
    mount('notable',
      notableN ? `<option value="cabinet">cabinet only (${notableN})</option>` : '',
      state.country === 'IN' && notableN > 0);

    // bloc
    const blocOpts = Object.entries(blocCounts).sort((a,b) => b[1]-a[1])
      .map(([b, n]) => `<option value="${b}">${b} (${n})</option>`).join('');
    mount('bloc', blocOpts, Object.keys(blocCounts).length > 1);

    // party — hide if party set just duplicates bloc set (US, UK)
    const blocSet = new Set(Object.keys(blocCounts));
    const partyEntries = Object.entries(partyCounts).sort((a,b) => b[1]-a[1]).slice(0, 14);
    const partyAddsInfo = partyEntries.some(([p]) => !blocSet.has(p));
    const partyOpts = partyEntries
      .map(([p, n]) => `<option value="${p}">${lbl(p)} (${n})</option>`).join('');
    mount('party', partyOpts, partyAddsInfo);

    // state
    const stateEntries = Object.entries(stateCounts).sort((a,b) => b[1]-a[1]).slice(0, 60);
    const stateOpts = stateEntries
      .map(([s, n]) => `<option value="${s}">${s} (${n})</option>`).join('');
    mount('state', stateOpts, stateEntries.length > 1);

    // gender
    const genderParts = [];
    if (genderCounts.male)   genderParts.push(`<option value="male">men (${genderCounts.male})</option>`);
    if (genderCounts.female) genderParts.push(`<option value="female">women (${genderCounts.female})</option>`);
    if (genderCounts.other)  genderParts.push(`<option value="other">other (${genderCounts.other})</option>`);
    mount('gender', genderParts.join(''), genderKnown / basePool.length > 0.5);

    // age
    const ageOpts = AGE_BUCKETS.filter(b => ageCounts[b.key] > 0)
      .map(b => `<option value="${b.key}">${b.label} (${ageCounts[b.key]})</option>`).join('');
    mount('age', ageOpts, ageKnown / basePool.length > 0.4);

    // moon sign
    const signOpts = RASHI_ORDER.filter(s => signCounts[s])
      .map(s => `<option value="${s}">${s} (${signCounts[s]})</option>`).join('');
    mount('sign', signOpts, Object.keys(signCounts).length > 1);

    function order() {
      let pool = basePool;
      if (f.notable.value === 'cabinet') pool = pool.filter(p => p.notable);
      if (f.bloc.value !== 'all')  pool = pool.filter(p => (p.bloc || 'Other') === f.bloc.value);
      if (f.party.value !== 'all') pool = pool.filter(p => p.party === f.party.value);
      if (f.state.value !== 'all') pool = pool.filter(p => p.state === f.state.value);
      if (f.gender.value !== 'all') {
        const v = f.gender.value;
        pool = pool.filter(p => v === 'other'
          ? (p.gender && p.gender !== 'male' && p.gender !== 'female')
          : p.gender === v);
      }
      if (f.age.value !== 'all') {
        const b = AGE_BUCKETS.find(x => x.key === f.age.value);
        if (b) pool = pool.filter(p => { const a = ageOf(p); return a != null && b.test(a); });
      }
      if (f.sign.value !== 'all') pool = pool.filter(p => p.moon_rashi_name === f.sign.value);

      const copy = [...pool];
      const factionOrder = state.country === 'IN' ? FACTION_ORDER_IN : null;

      if (sortSel.value === 'faction') {
        copy.sort((a, b) => {
          // Bubble notable (curated cabinet) to the top of their bloc.
          const nd = (b.notable ? 1 : 0) - (a.notable ? 1 : 0);
          if (nd) return nd;
          if (factionOrder) {
            const d = (factionOrder[a.bloc] ?? 9) - (factionOrder[b.bloc] ?? 9);
            if (d) return d;
          } else {
            const d = (blocs.indexOf(a.bloc || 'Other')) - (blocs.indexOf(b.bloc || 'Other'));
            if (d) return d;
          }
          return a.name.localeCompare(b.name);
        });
      } else if (sortSel.value === 'alpha') {
        copy.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortSel.value === 'compat') {
        // Quick proxy: average against a random 24-sample of the pool.
        const sample = [];
        const step = Math.max(1, Math.floor(copy.length / 24));
        for (let i = 0; i < copy.length; i += step) sample.push(copy[i]);
        const avg = new Map();
        for (const p of copy) {
          let s = 0, n = 0;
          for (const q of sample) {
            if (q === p) continue;
            s += scoreFn(p, q).total; n++;
          }
          avg.set(p, n ? s / n : 0);
        }
        copy.sort((a, b) => (avg.get(b) || 0) - (avg.get(a) || 0));
      } else if (sortSel.value === 'rashi') {
        copy.sort((a, b) =>
          RASHI_ORDER.indexOf(a.moon_rashi_name) - RASHI_ORDER.indexOf(b.moon_rashi_name)
          || a.name.localeCompare(b.name));
      }

      return copy;
    }

    function draw() {
      const selected = order();
      // Build matches inline; the matrix reads from this list by name.
      // Shape each person so matrix.js finds a `.faction` for the divider logic.
      const people = selected.map(p => ({ ...p, faction: p.bloc || 'Other' }));
      const matches = [];
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          matches.push({ a: people[i].name, b: people[j].name,
                         total: scoreFn(people[i], people[j]).total });
        }
      }
      const byName = new Map(people.map(p => [p.name, p]));
      window.PK_drawMatrix({
        people,
        matches,
        order: people.map(p => p.name),
        onCellClick: (an, bn) => {
          const a = byName.get(an);
          const b = byName.get(bn);
          openPair(a, b);
        },
      });
    }

    sortSel.onchange = draw;
    Object.values(f).forEach(sel => { sel.onchange = draw; });
    const resetBtn = document.getElementById('filter-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        Object.values(f).forEach(sel => { sel.value = 'all'; });
        draw();
      };
    }
    draw();
  }

  // ======================================================================
  // TAB: Matches — hero pair + mode chips + ribbon
  // ======================================================================
  const RASHI_SANSKRIT = {
    Aries:'Mesha', Taurus:'Vrishabha', Gemini:'Mithuna', Cancer:'Karka',
    Leo:'Simha', Virgo:'Kanya', Libra:'Tula', Scorpio:'Vrishchika',
    Sagittarius:'Dhanu', Capricorn:'Makara', Aquarius:'Kumbha', Pisces:'Meena'
  };
  // Backward-compat: a few spots still call this RASHI_GLYPH_MAP
  const RASHI_GLYPH_MAP = RASHI_SANSKRIT;

  // Vedic rashi icons — inline SVG line drawings of the actual Indian symbols.
  // Not Western zodiac glyphs; Makara is a sea-creature (not a goat), Kumbha
  // is a pot (not a human pouring water), Mithuna is a couple (not twins).
  const VEDIC_PATHS = {
    // Mesha — ram (curled horns + face)
    Aries:       '<path d="M12 8 Q7 3 4 7 Q3 11 7 12"/><path d="M12 8 Q17 3 20 7 Q21 11 17 12"/><ellipse cx="12" cy="14" rx="3.5" ry="3"/><circle cx="10.5" cy="13.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="13.5" cy="13.5" r="0.6" fill="currentColor" stroke="none"/><path d="M10.5 16 Q12 17 13.5 16"/>',
    // Vrishabha — bull (head + up-curled horns + nose ring)
    Taurus:      '<path d="M7 12 L7 16 Q7 19 12 19 Q17 19 17 16 L17 12 Z"/><path d="M7 12 Q3 9 3 6 Q5 7 7 11"/><path d="M17 12 Q21 9 21 6 Q19 7 17 11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/><circle cx="14" cy="14" r="0.6" fill="currentColor" stroke="none"/><circle cx="12" cy="17" r="0.9"/>',
    // Mithuna — couple (two figures holding hands)
    Gemini:      '<circle cx="8" cy="7" r="2.3"/><circle cx="16" cy="7" r="2.3"/><path d="M8 9.3 V18 M16 9.3 V18"/><path d="M8 13 L16 13"/><path d="M5 13 L8 12 M19 13 L16 12"/><path d="M6 20 L8 18 L10 20 M14 20 L16 18 L18 20"/>',
    // Karka — crab (body + claws + legs)
    Cancer:      '<ellipse cx="12" cy="13" rx="5" ry="3.2"/><path d="M8 10 Q4 6 2 9 Q3 10 6 11"/><path d="M16 10 Q20 6 22 9 Q21 10 18 11"/><circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none"/><circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none"/><path d="M8 16 L6 19 M10.5 16 L9.5 19 M13.5 16 L14.5 19 M16 16 L18 19"/>',
    // Simha — lion (face with mane rays)
    Leo:         '<circle cx="12" cy="12" r="4"/><path d="M12 4 L12 2 M18 6 L20 4 M20 12 L22 12 M18 18 L20 20 M12 20 L12 22 M6 18 L4 20 M4 12 L2 12 M6 6 L4 4"/><circle cx="10.5" cy="11.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="13.5" cy="11.5" r="0.6" fill="currentColor" stroke="none"/><path d="M10 14 Q12 15.5 14 14"/>',
    // Kanya — maiden with wheat sheaf
    Virgo:       '<circle cx="9" cy="6" r="2.2"/><path d="M7 8.5 Q5 14 7 19 L12 19 Q14 14 11 8.5 Z"/><path d="M17 3 L17 19"/><path d="M17 6 L20 4 M17 6 L14 4 M17 9 L20 7 M17 9 L14 7 M17 12 L20 10 M17 12 L14 10 M17 15 L20 13 M17 15 L14 13"/><path d="M12 13 L14 12"/>',
    // Tula — scales (crossbeam with hanging pans)
    Libra:       '<path d="M12 20 L12 5"/><path d="M6 7 L18 7"/><path d="M4 12 L9 12 L7 7 Z"/><path d="M15 12 L20 12 L18 7 Z"/><circle cx="12" cy="4" r="0.9"/>',
    // Vrishchika — scorpion (body + claws + curved stinger tail)
    Scorpio:     '<ellipse cx="9" cy="13" rx="3.5" ry="2.3"/><path d="M6 13 L3 11 L4 9 M6 13 L3 15 L4 17"/><path d="M12.5 13 Q18 13 19 9 Q19 5 16 5 Q14 5.5 15 8"/><circle cx="15" cy="8" r="0.6" fill="currentColor" stroke="none"/><circle cx="8.5" cy="13" r="0.5" fill="currentColor" stroke="none"/>',
    // Dhanu — bow with arrow (archer weapon, not centaur)
    Sagittarius: '<path d="M5 4 Q19 12 5 20"/><path d="M5 4 L5 20"/><path d="M4 12 L22 12"/><path d="M22 12 L19 9 M22 12 L19 15"/><path d="M4 12 L6 10 M4 12 L6 14"/>',
    // Makara — sea-creature (crocodile head + fish tail, NOT a goat)
    Capricorn:   '<path d="M3 13 Q3 9 8 9 L14 9 Q18 9 19 7 Q20 9 18 12 L20 13 L18 15 Q16 14 13 14 L8 14 Q5 15 3 13 Z"/><path d="M19 11 L22 9 L22 15 L19 13"/><circle cx="6" cy="12" r="0.6" fill="currentColor" stroke="none"/><path d="M8 13 L9 13.5 M11 13 L11.5 13.5"/>',
    // Kumbha — water pot (the pot itself, not a human figure)
    Aquarius:    '<path d="M8 4 L16 4 L16 6 L14 7 Q20 8 20 14 Q20 19 12 19 Q4 19 4 14 Q4 8 10 7 L8 6 Z"/><path d="M10 10 Q12 9 14 10"/><path d="M12 20 Q11 21 12 22 Q13 21 12 20"/><path d="M9 20 Q8.5 21 9 22"/><path d="M15 20 Q15.5 21 15 22"/>',
    // Meena — two fish, head-to-tail (sarvatomukh)
    Pisces:      '<path d="M3 8 Q8 5 13 8 Q8 11 3 8 Z"/><path d="M3 8 L1 6 M3 8 L1 10"/><circle cx="10" cy="8" r="0.5" fill="currentColor" stroke="none"/><path d="M21 16 Q16 13 11 16 Q16 19 21 16 Z"/><path d="M21 16 L23 14 M21 16 L23 18"/><circle cx="14" cy="16" r="0.5" fill="currentColor" stroke="none"/>',
  };
  function vedicIcon(rashiName, size = 20) {
    const paths = VEDIC_PATHS[rashiName];
    if (!paths) return '';
    return `<svg class="vi" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }
  window.PK_vedicIcon = vedicIcon;
  function verdictShort(total) {
    if (total >= 32) return 'book the mandap';
    if (total >= 26) return 'parents approve';
    if (total >= 18) return 'technically a match';
    if (total >= 12) return 'the pandit hesitates';
    return 'do not proceed';
  }
  const KOOT_KEYS = ['varna','vashya','tara','yoni','graha_maitri','gana','bhakoot','nadi'];
  const KOOT_MAX  = { varna:1, vashya:2, tara:3, yoni:4, graha_maitri:5, gana:6, bhakoot:7, nadi:8 };
  const KOOT_LABEL = { varna:'Varna', vashya:'Vashya', tara:'Tara', yoni:'Yoni', graha_maitri:'Graha', gana:'Gana', bhakoot:'Bhakoot', nadi:'Nadi' };

  function pickPairByMode(mode) {
    const poolAll = dedupe(all[state.country]);
    const poolFallback = dedupe(all.ALL);
    let attempts = 0;
    while (attempts++ < 60) {
      let a, b, pool = poolAll;
      if (mode === 'global') pool = poolFallback;
      if (pool.length < 2) pool = poolFallback;
      a = pool[Math.floor(Math.random() * pool.length)];
      b = pool[Math.floor(Math.random() * pool.length)];
      if (!a || !b || a === b) continue;
      const t = scoreFn(a, b).total;
      if (mode === 'random')   return [a, b, scoreFn(a, b)];
      if (mode === 'ordained' && t >= 28) return [a, b, scoreFn(a, b)];
      if (mode === 'cursed'   && t <= 10) return [a, b, scoreFn(a, b)];
      if (mode === 'across') {
        const sameBloc = (a.bloc || '?') === (b.bloc || '?');
        if (!sameBloc) return [a, b, scoreFn(a, b)];
      }
      if (mode === 'global') {
        if (a.country !== b.country) return [a, b, scoreFn(a, b)];
      }
    }
    // fallback: any pair
    const pool = poolAll.length >= 2 ? poolAll : poolFallback;
    const i = Math.floor(Math.random() * pool.length);
    let j = Math.floor(Math.random() * pool.length);
    if (j === i) j = (j + 1) % pool.length;
    return [pool[i], pool[j], scoreFn(pool[i], pool[j])];
  }

  function yoniOf(p) {
    if (window.PK_astro && window.PK_astro.yoniAnimalOf) {
      return window.PK_astro.yoniAnimalOf(p.moon_nakshatra_name) || '';
    }
    return '';
  }

  function personBlockHtml(p, side) {
    const rashiSk = RASHI_SANSKRIT[p.moon_rashi_name] || p.moon_rashi_name || '';
    const yoniAn = (yoniOf(p) || '').toLowerCase();
    const icon = vedicIcon(p.moon_rashi_name, 28);
    return `
      <div class="mh-person mh-${side}" data-slot="${side}">
        <span class="mh-eyebrow">${(p.party || '').slice(0, 24)}</span>
        <span class="mh-name" role="button" tabindex="0" title="click to swap">${p.name} <span class="mh-edit">✎</span></span>
        <span class="mh-moon"><span class="mh-vicon">${icon}</span><span class="mh-moon-text"><strong>${rashiSk}</strong> moon · ${p.moon_nakshatra_name} nakshatra</span></span>
        ${yoniAn ? `<span class="mh-yoni">${yoniAn} yoni</span>` : ''}
        <div class="mh-search" hidden>
          <input type="search" class="mh-search-input" placeholder="Search any legislator&hellip;" autocomplete="off" />
          <ul class="mh-search-results"></ul>
        </div>
      </div>
    `;
  }

  function renderHeroCard(container, pair) {
    const [a, b, s] = pair;
    const band = s.total >= 32 ? 'ordained' : s.total >= 26 ? 'strong' : s.total >= 18 ? 'threshold' : s.total >= 12 ? 'dealbreaker' : 'cursed';
    const dots = KOOT_KEYS.map(k => {
      const got = s[k] ?? 0;
      const max = KOOT_MAX[k];
      const cls = got === max ? 'full' : got === 0 ? 'zero' : 'partial';
      const pct = Math.round((got / max) * 100);
      return `<span class="mh-dot mh-dot-${cls}" title="${KOOT_LABEL[k]} ${got}/${max}"><span class="mh-dot-inner" style="--pct:${pct}%"></span></span>`;
    }).join('');
    container.innerHTML = `
      <div class="mh-card mh-${band}" data-key-a="${keyOf(a)}" data-key-b="${keyOf(b)}">
        ${personBlockHtml(a, 'a')}
        <div class="mh-center">
          <span class="mh-x">×</span>
          <span class="mh-score" style="background:${window.PK_scoreColor(s.total)}">${s.total.toFixed(0)}<span class="mh-denom">/36</span></span>
          <span class="mh-verdict">${verdictShort(s.total)}</span>
          <span class="mh-dots">${dots}</span>
          <button type="button" class="mh-open">open full breakdown →</button>
        </div>
        ${personBlockHtml(b, 'b')}
      </div>
    `;

    const card = container.querySelector('.mh-card');
    card.querySelector('.mh-open').onclick = () => openPair(a, b);

    // Click-to-search on each person slot
    card.querySelectorAll('.mh-person').forEach(slot => {
      const side = slot.dataset.slot;
      const name = slot.querySelector('.mh-name');
      const search = slot.querySelector('.mh-search');
      const input = slot.querySelector('.mh-search-input');
      const results = slot.querySelector('.mh-search-results');
      const openSearch = () => {
        search.hidden = false;
        input.value = '';
        results.innerHTML = '';
        input.focus();
      };
      const closeSearch = () => {
        search.hidden = true;
        results.innerHTML = '';
      };
      name.addEventListener('click', openSearch);
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSearch(); } });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeSearch(); }
      });
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { results.innerHTML = ''; return; }
        const pool = dedupe(all.ALL);
        const hits = pool.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.party || '').toLowerCase().includes(q) ||
          (p.state || '').toLowerCase().includes(q) ||
          (p.constituency || '').toLowerCase().includes(q)
        ).slice(0, 8);
        results.innerHTML = hits.map(p => `
          <li data-key="${keyOf(p)}">
            <span class="mhr-name">${p.name}</span>
            <span class="mhr-meta">${p.party || ''} · ${flagOf(p.country)}</span>
          </li>
        `).join('') || '<li class="mhr-empty" data-empty="1">no hits</li>';
      });
      results.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li || li.dataset.empty) return;
        const picked = byKey.get(li.dataset.key);
        if (!picked) return;
        if (side === 'a') state.pickedA = picked;
        else state.pickedB = picked;
        closeSearch();
        renderMatches();
      });
      // Close on outside click
      document.addEventListener('click', function hClose(e) {
        if (!slot.contains(e.target)) { closeSearch(); document.removeEventListener('click', hClose); }
      });
    });
  }

  function renderRibbon(container, count) {
    const cards = [];
    const seen = new Set();
    for (let i = 0; i < count * 3 && cards.length < count; i++) {
      const mode = ['ordained','cursed','random','across'][i % 4];
      const p = pickPairByMode(mode);
      if (!p) continue;
      const key = [p[0].name, p[1].name].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(p);
    }
    container.innerHTML = cards.map(([a, b, s]) => {
      const t = s.total;
      const band = t >= 32 ? 'ordained' : t >= 26 ? 'strong' : t >= 18 ? 'threshold' : t >= 12 ? 'dealbreaker' : 'cursed';
      return `
        <button class="fp-card fp-${band}" data-key-a="${keyOf(a)}" data-key-b="${keyOf(b)}">
          <span class="fp-score" style="background:${window.PK_scoreColor(t)}">${t.toFixed(0)}<span class="fp-denom">/36</span></span>
          <span class="fp-names">
            <span class="fp-name">${a.name}</span>
            <span class="fp-x">×</span>
            <span class="fp-name">${b.name}</span>
          </span>
          <span class="fp-verdict">${verdictShort(t)}</span>
        </button>
      `;
    }).join('');
    container.querySelectorAll('.fp-card').forEach(el => {
      el.onclick = () => {
        const a = byKey.get(el.dataset.keyA);
        const b = byKey.get(el.dataset.keyB);
        if (a && b) openPair(a, b);
      };
    });
  }

  let matchesWired = false;
  function renderMatches() {
    const hero = document.getElementById('match-hero');
    const ribbon = document.getElementById('match-ribbon');
    if (!hero || !ribbon) return;
    // If user has manually picked either side, honor those. Fill missing
    // side with a random pick respecting mode.
    let a = state.pickedA;
    let b = state.pickedB;
    if (a && b) {
      // Both picked — just render them
    } else {
      const p = pickPairByMode(state.matchMode);
      if (!a) a = p[0];
      if (!b) b = p[1];
      if (a && b && keyOf(a) === keyOf(b)) {
        // avoid identical — pick a different random for b
        const pool = dedupe(all.ALL);
        b = pool.find(x => keyOf(x) !== keyOf(a));
      }
    }
    const s = scoreFn(a, b);
    renderHeroCard(hero, [a, b, s]);
    renderRibbon(ribbon, 4);

    if (!matchesWired) {
      document.querySelectorAll('.match-mode').forEach(btn => {
        btn.onclick = () => {
          state.matchMode = btn.dataset.mode;
          state.pickedA = null; state.pickedB = null; // mode overrides manual picks
          document.querySelectorAll('.match-mode').forEach(b => b.classList.toggle('active', b === btn));
          renderMatches();
        };
      });
      const rr = document.getElementById('match-reroll');
      if (rr) {
        rr.onclick = () => {
          rr.classList.add('spinning');
          setTimeout(() => rr.classList.remove('spinning'), 500);
          state.pickedA = null; state.pickedB = null;
          renderMatches();
        };
      }
      matchesWired = true;
    }
  }

  // ======================================================================
  // TAB: Parties × parties heatmap
  // ======================================================================
  const PARTY_SHORT = {
    'Bharatiya Janata Party': 'BJP',
    'Indian National Congress': 'INC',
    'Samajwadi Party': 'SP',
    'Trinamool Congress': 'TMC',
    'All India Trinamool Congress': 'TMC',
    'Dravida Munnetra Kazhagam': 'DMK',
    'Telugu Desam Party': 'TDP',
    'Janata Dal (United)': 'JD(U)',
    'Shiv Sena (Uddhav Balasaheb Thackeray)': 'SHS(UBT)',
    'Nationalist Congress Party (Sharadchandra Pawar)': 'NCP(SP)',
    'Shiv Sena': 'SHS',
    'Lok Janshakti Party (Ram Vilas)': 'LJP(RV)',
    'Rashtriya Janata Dal': 'RJD',
    'Aam Aadmi Party': 'AAP',
    'YSR Congress Party': 'YSRCP',
    'Communist Party of India (Marxist)': 'CPI(M)',
    'Indian Union Muslim League': 'IUML',
    'Republican': 'GOP',
    'Democratic': 'Dem',
    'Independent': 'Ind',
    'Labour Party': 'Labour',
    'Labour Co-op': 'Lab Co-op',
    'Conservative Party': 'Tory',
    'Liberal Democrats': 'Lib Dem',
    'Scottish National Party': 'SNP',
    'Reform UK': 'Reform',
    'Sinn Féin': 'SF',
    'Democratic Unionist Party': 'DUP',
    'Green Party of England and Wales': 'Green',
    'Plaid Cymru': 'Plaid',
  };
  const lbl = p => PARTY_SHORT[p] || (p || 'Unknown').slice(0, 10);

  function renderParties() {
    const people = all[state.country];
    const holder = document.getElementById('parties-holder');
    holder.innerHTML = '';

    // Top N parties by headcount
    const count = {};
    people.forEach(p => { if (p.party) count[p.party] = (count[p.party] || 0) + 1; });
    const topN = Math.min(12, Object.keys(count).length);
    const parties = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([p]) => p);
    if (parties.length < 2) {
      holder.innerHTML = '<p class="panel-empty">Not enough party diversity in this slice.</p>';
      document.getElementById('parties-note').textContent = '';
      return;
    }

    // Sample N MPs per party for heatmap speed
    const cap = 40;
    const pools = new Map(parties.map(p => [p, people.filter(x => x.party === p).slice(0, cap)]));

    const rows = [];
    for (let i = 0; i < parties.length; i++) {
      for (let j = 0; j < parties.length; j++) {
        const A = pools.get(parties[i]);
        const B = pools.get(parties[j]);
        let sum = 0, n = 0;
        for (const a of A) for (const b of B) {
          if (a === b) continue;
          sum += scoreFn(a, b).total;
          n++;
        }
        rows.push({ i, j, pa: parties[i], pb: parties[j], avg: n ? sum / n : null, n });
      }
    }

    // Draw
    const CELL = 50, LH = 140, LW = 140;
    const W = LW + parties.length * CELL + 20;
    const H = LH + parties.length * CELL + 20;
    const svg = d3.select(holder).append('svg')
      .attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .style('font-family', "'Inter', system-ui, sans-serif");

    svg.append('g').attr('transform', `translate(${LW}, ${LH})`)
      .selectAll('text.top').data(parties).join('text')
        .attr('x', (_, i) => i * CELL + CELL * 0.5)
        .attr('y', -8)
        .attr('transform', (_, i) => `rotate(-40 ${i * CELL + CELL * 0.5} -8)`)
        .style('fill', 'var(--ink-2)')
        .style('font-family', "'Inter', system-ui, sans-serif")
        .style('font-size', '11.5px')
        .style('font-weight', 500)
        .style('letter-spacing', '-0.005em')
        .text(d => lbl(d));

    svg.append('g').attr('transform', `translate(${LW - 8}, ${LH})`)
      .selectAll('text.left').data(parties).join('text')
        .attr('x', 0).attr('y', (_, i) => i * CELL + CELL * 0.62)
        .attr('text-anchor', 'end').style('fill', 'var(--ink-2)')
        .style('font-family', "'Inter', system-ui, sans-serif")
        .style('font-size', '11.5px')
        .style('font-weight', 500)
        .style('letter-spacing', '-0.005em')
        .text(d => lbl(d));

    const grid = svg.append('g').attr('transform', `translate(${LW}, ${LH})`);
    grid.selectAll('rect').data(rows).join('rect')
      .attr('x', d => d.j * CELL).attr('y', d => d.i * CELL)
      .attr('width', CELL - 2).attr('height', CELL - 2)
      .attr('rx', 3).attr('ry', 3)
      .attr('fill', d => d.avg == null ? 'var(--card-2)' : window.PK_scoreColor(d.avg))
      .style('stroke', 'rgba(17,17,20,0.08)').attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        const A = pools.get(d.pa), B = pools.get(d.pb);
        // Show a sample pair (best from sample)
        let best = null, bestTotal = -1;
        for (const a of A) for (const b of B) {
          if (a === b) continue;
          const t = scoreFn(a, b).total;
          if (t > bestTotal) { bestTotal = t; best = [a, b]; }
        }
        if (best) openPair(best[0], best[1]);
      });

    grid.selectAll('text.v').data(rows).join('text')
      .attr('x', d => d.j * CELL + (CELL - 2) / 2)
      .attr('y', d => d.i * CELL + (CELL - 2) / 2 + 5)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.avg == null ? 'var(--ink-3)' : window.PK_scoreTextColor(d.avg))
      .attr('pointer-events', 'none').style('font-weight', 500)
      .style('font-family', "'Inter', system-ui, sans-serif")
      .style('font-style', 'normal')
      .style('font-size', '13px')
      .style('letter-spacing', '-0.015em')
      .style('font-variant-numeric', 'tabular-nums')
      .text(d => d.avg == null ? '—' : d.avg.toFixed(1));

    // Note under the heatmap
    const upper = rows.filter(r => r.i < r.j && r.avg != null).sort((a, b) => a.avg - b.avg);
    if (upper.length) {
      const best  = upper[upper.length - 1];
      const worst = upper[0];
      document.getElementById('parties-note').innerHTML = `
        In <strong>${countryLabel[state.country]}</strong>, the two parties
        the stars would most like to introduce:
        <strong>${lbl(best.pa)} &times; ${lbl(best.pb)}</strong> (avg ${best.avg.toFixed(1)}).
        The two the pandit would keep in separate rooms:
        <strong>${lbl(worst.pa)} &times; ${lbl(worst.pb)}</strong> (avg ${worst.avg.toFixed(1)}).
      `;
    }
  }

  // ======================================================================
  // TAB: Find someone
  // ======================================================================
  // Vedic rashi names (replacing Western zodiac glyphs)
  const RASHI_GLYPH = RASHI_SANSKRIT;

  function renderFind() {
    const people = dedupe(all[state.country]);
    const searchInput = document.getElementById('mp-search');
    const searchResults = document.getElementById('mp-results');
    const mpPanel = document.getElementById('mp-panel');

    searchInput.value = '';
    searchResults.innerHTML = '';
    mpPanel.innerHTML = '';
    searchInput.placeholder = `Name, state, or party — ${people.length.toLocaleString()} candidates in ${countryLabel[state.country]}…`;

    searchInput.oninput = () => {
      const q = searchInput.value.trim().toLowerCase();
      if (q.length < 2) { searchResults.innerHTML = ''; return; }
      const hits = people.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.constituency || '').toLowerCase().includes(q) ||
        (p.state || '').toLowerCase().includes(q) ||
        (p.party || '').toLowerCase().includes(q)
      ).slice(0, 10);
      if (!hits.length) {
        searchResults.innerHTML = `<li class="mr-empty" style="cursor:default">
          <div class="mr-name" style="color:var(--muted)">no one here called &ldquo;${q}&rdquo;</div>
          <div class="mr-meta">the stars decline to comment; try a name, state, or party</div>
        </li>`;
        return;
      }
      searchResults.innerHTML = hits.map(p => `
        <li data-key="${keyOf(p)}">
          <div class="mr-name">${p.name}
            <span class="mr-flag">${flagOf(p.country)}</span>
          </div>
          <div class="mr-meta">${p.constituency || '-'} &middot; ${lbl(p.party)}</div>
        </li>
      `).join('');
    };

    searchResults.onclick = (ev) => {
      const li = ev.target.closest('li');
      if (!li || !li.dataset.key) return;
      const mp = byKey.get(li.dataset.key);
      if (!mp) return;
      selectMP(mp, people);
      searchResults.innerHTML = '';
      searchInput.value = mp.name;
    };
  }

  function selectMP(mp, pool) {
    const scored = pool
      .filter(p => keyOf(p) !== keyOf(mp))
      .map(p => ({ p, s: scoreFn(mp, p) }))
      .sort((a, b) => b.s.total - a.s.total);

    const top = scored.slice(0, 10);
    const bot = scored.slice(-10).reverse();

    // Bloc averages (only over blocs that exist in this pool)
    const blocs = {};
    scored.forEach(x => {
      const b = x.p.bloc || 'Other';
      (blocs[b] ||= []).push(x.s.total);
    });
    const blocRows = Object.entries(blocs)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6);

    document.getElementById('mp-panel').innerHTML = `
      <div class="mp-card">
        <div>
          <div class="mp-eyebrow">${mp.constituency || '-'} &middot; ${mp.state || countryLabel[mp.country]}</div>
          <div class="mp-name">${mp.name} <span class="mp-flag">${flagOf(mp.country)}</span></div>
          <div class="mp-meta">${mp.party || ''} &middot; <span class="bloc-tag bloc-${slug(mp.bloc)}">${mp.bloc || 'Other'}</span></div>
          <div class="mp-moon">
            <strong>${RASHI_SANSKRIT[mp.moon_rashi_name] || mp.moon_rashi_name}</strong> moon &middot; ${mp.moon_nakshatra_name} nakshatra (pada ${mp.moon_pada})
            <span class="mp-moon-sun">&mdash; ${RASHI_SANSKRIT[mp.sun_rashi_name] || mp.sun_rashi_name} sun</span>
          </div>
          <div class="mp-dob">Born ${mp.dob} &middot; chart: noon default</div>
        </div>
      </div>

      <div class="mp-faction-avg">
        <strong>Average compatibility across the aisle&hellip;</strong>
        <div class="fa-rows">
          ${blocRows.map(([name, arr]) => {
            const avg = arr.reduce((s, x) => s + x, 0) / arr.length;
            return `
              <div class="fa-row">
                <span class="bloc-tag bloc-${slug(name)}">${name}</span>
                <div class="fa-bar-wrap"><div class="fa-bar" style="width:${avg/36*100}%; background:${window.PK_scoreColor(avg)}"></div></div>
                <span class="fa-num">${avg.toFixed(1)} <span style="color:var(--muted);font-size:10px">(${arr.length})</span></span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="mp-lists">
        <div class="mp-list top">
          <h4>Ten the stars would arrange</h4>
          ${top.map(x => rankRow(mp, x.p, x.s)).join('')}
        </div>
        <div class="mp-list bot">
          <h4>Ten the stars would not</h4>
          ${bot.map(x => rankRow(mp, x.p, x.s)).join('')}
        </div>
      </div>
    `;

    document.querySelectorAll('#mp-panel [data-pair-a][data-pair-b]').forEach(el => {
      el.onclick = () => {
        const a = byKey.get(el.dataset.pairA);
        const b = byKey.get(el.dataset.pairB);
        openPair(a, b);
      };
    });
  }

  function rankRow(me, them, s) {
    return `
      <div class="rank-row" data-pair-a="${keyOf(me)}" data-pair-b="${keyOf(them)}">
        <div class="rank-score" style="background:${window.PK_scoreColor(s.total)};color:${window.PK_scoreTextColor(s.total)};border-color:transparent">${s.total.toFixed(0)}</div>
        <div class="rank-body">
          <div class="rank-name">${them.name} <span style="font-size:0.75em">${flagOf(them.country)}</span></div>
          <div class="rank-meta">${lbl(them.party)} &middot; ${them.state || them.constituency || ''}</div>
        </div>
      </div>
    `;
  }

  // ======================================================================
  // TAB: Extremes
  // ======================================================================
  function renderExtremes() {
    const people = dedupe(all[state.country]);
    const n = people.length;
    const pairs = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        pairs.push({ i, j, total: scoreFn(people[i], people[j]).total });
    pairs.sort((a, b) => b.total - a.total);
    document.getElementById('pair-total').textContent = pairs.length.toLocaleString();

    // Diversify: no person appears more than once per column.
    // (Ashtakoot scores are driven by moon nakshatra, so a single person with
    // an extreme nakshatra otherwise monopolises both the top and the bottom.)
    function pickDistinct(source, count) {
      const picked = [];
      const seen = new Set();
      for (const p of source) {
        if (picked.length >= count) break;
        if (seen.has(p.i) || seen.has(p.j)) continue;
        picked.push(p);
        seen.add(p.i);
        seen.add(p.j);
      }
      return picked;
    }
    const top = pickDistinct(pairs, 10);
    const bot = pickDistinct([...pairs].reverse(), 10);
    const render = (bucket) => bucket.map(p => {
      const a = people[p.i], b = people[p.j];
      // Pick a moon-sign glyph from one of the two (rotate so both are seen)
      const pickA = (p.total % 2 === 0);
      const src = pickA ? a : b;
      const glyph = RASHI_GLYPH[src.moon_rashi_name] || '';
      return `
        <div class="pp-card" data-pair-a="${keyOf(a)}" data-pair-b="${keyOf(b)}">
          <div class="pp-score" style="background:${window.PK_scoreColor(p.total)};color:${window.PK_scoreTextColor(p.total)};border-color:transparent">${p.total.toFixed(0)}</div>
          <div>
            <div class="pp-name">${a.name} ${flagOf(a.country)}<span class="x">×</span>${b.name} ${flagOf(b.country)}</div>
            <div class="pp-meta">${lbl(a.party)} &middot; ${lbl(b.party)}</div>
          </div>
        </div>
      `;
    }).join('');
    document.getElementById('extremes-top').innerHTML = render(top);
    document.getElementById('extremes-bot').innerHTML = render(bot);
    document.querySelectorAll('#extremes-top .pp-card, #extremes-bot .pp-card').forEach(el => {
      el.onclick = () => {
        const a = byKey.get(el.dataset.pairA);
        const b = byKey.get(el.dataset.pairB);
        openPair(a, b);
      };
    });
  }

  // ======================================================================
  // TAB: Moon signs distribution
  // ======================================================================
  function renderSigns() {
    const people = dedupe(all[state.country]);
    const RASHI_ORDER = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
      'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
    const count = Object.fromEntries(RASHI_ORDER.map(s => [s, 0]));
    people.forEach(p => { count[p.moon_rashi_name] = (count[p.moon_rashi_name] || 0) + 1; });
    const total = people.length;
    const expected = total / 12;
    const maxCount = Math.max(...Object.values(count));

    document.getElementById('signs-chart').innerHTML = RASHI_ORDER.map(s => {
      const n = count[s];
      const h = Math.round((n / maxCount) * 100);
      const over = n > expected * 1.2, under = n < expected * 0.8;
      const cls = over ? 'over' : under ? 'under' : '';
      return `
        <div class="sign-col">
          <div class="sign-bar-wrap">
            <div class="sign-bar ${cls}" style="height:${h}%"></div>
            <div class="sign-count">${n}</div>
          </div>
          <div class="sign-glyph vedic-sign-glyph">${vedicIcon(s, 32)}</div>
          <div class="sign-name"><strong>${RASHI_SANSKRIT[s] || s}</strong><br><span class="sign-name-en">${s}</span></div>
        </div>
      `;
    }).join('');

    // Draw the zodiac wheel
    const wheel = document.getElementById('signs-wheel');
    if (wheel && window.PK_astro) {
      wheel.innerHTML = '';
      window.PK_astro.drawZodiacWheel(wheel, count, total);
    }

    // Surface most over- and under-represented
    const sorted = RASHI_ORDER.map(s => ({ s, n: count[s] })).sort((a, b) => b.n - a.n);
    const over = sorted[0], under = sorted[sorted.length - 1];
    document.getElementById('signs-caption').innerHTML = `
      In ${countryLabel[state.country]} (N = ${total.toLocaleString()}, expected per sign ≈ ${expected.toFixed(0)}),
      <strong>${RASHI_SANSKRIT[over.s] || over.s}</strong> is the most-represented moon sign (${over.n}),
      <strong>${RASHI_SANSKRIT[under.s] || under.s}</strong> the least (${under.n}).
    `;
  }

  // ======================================================================
  // TAB: About
  // ======================================================================
  function renderAbout() {
    const total = all.IN.length + all.US.length + all.UK.length;
    document.getElementById('about-coverage').innerHTML = `
      India &middot; 18th Lok Sabha: <strong>${IN.with_dob}/${IN.total}</strong> with DOB (${Math.round(IN.with_dob/IN.total*100)}%), plus 40 curated cabinet/CMs/opposition figures.<br/>
      US &middot; 119th Congress: <strong>${US.with_dob}/${US.total}</strong> with DOB (${Math.round(US.with_dob/US.total*100)}%).<br/>
      UK &middot; Commons: <strong>${UK.with_dob}/${UK.total}</strong> with DOB (${Math.round(UK.with_dob/UK.total*100)}%).<br/>
      Total legislators computed: <strong>${total.toLocaleString()}</strong>.
    `;
  }

  // ======================================================================
  // Scatter Vedic rashi icons as page decoration — added once, positioned
  // around panel heads and the main body.
  // ======================================================================
  function scatterRashis() {
    const RASHI_KEYS = Object.keys(VEDIC_PATHS);
    const COLORS = ['var(--plum)', 'var(--terracotta)', 'var(--brass-deep)', 'var(--moss)', 'var(--rust)', 'var(--sunset)'];
    const POSITIONS = [
      // per-panel scatter slots (top-right, mid-right, bottom-left, etc.)
      { top: '0.2rem',  right: '0.8rem', size: 52, rot: -8  },
      { top: '3.5rem',  right: '4.5rem', size: 32, rot: 14  },
      { top: '1.2rem',  right: '6.5rem', size: 26, rot: -22 },
      { top: '5.8rem',  right: '1.2rem', size: 40, rot: 6   },
      { top: '7.5rem',  right: '7rem',   size: 22, rot: -18 },
    ];
    document.querySelectorAll('.panel-head').forEach((head, idx) => {
      if (head.querySelector('.rashi-scatter')) return; // already scattered
      head.style.position = head.style.position || 'relative';
      const scatter = document.createElement('div');
      scatter.className = 'rashi-scatter';
      scatter.setAttribute('aria-hidden', 'true');
      // Pick 5 distinct rashi icons per panel, seeded by panel index so each
      // tab has a stable (but different) constellation of ornaments.
      const shuffled = [...RASHI_KEYS].sort(() =>
        Math.sin(idx * 9.1 + RASHI_KEYS.indexOf(RASHI_KEYS[0])) - 0.5
      );
      // Better: deterministic shuffle per panel
      const seed = idx * 2654435761 >>> 0;
      const picks = [];
      for (let i = 0; i < POSITIONS.length; i++) {
        const k = (seed + i * 12) % RASHI_KEYS.length;
        picks.push(RASHI_KEYS[(k + i * 2) % RASHI_KEYS.length]);
      }
      picks.forEach((name, i) => {
        const pos = POSITIONS[i];
        const color = COLORS[(i + idx) % COLORS.length];
        const el = document.createElement('span');
        el.className = 'rashi-scatter-item';
        el.style.top = pos.top;
        el.style.right = pos.right;
        el.style.color = color;
        el.style.transform = `rotate(${pos.rot}deg)`;
        el.innerHTML = vedicIcon(name, pos.size);
        el.title = RASHI_SANSKRIT[name];
        scatter.appendChild(el);
      });
      head.appendChild(scatter);
    });

    // Also scatter a few into the corners of main — floating ambient ornaments
    const main = document.querySelector('main');
    if (main && !main.querySelector('.ambient-rashi')) {
      const ambient = document.createElement('div');
      ambient.className = 'ambient-rashi';
      ambient.setAttribute('aria-hidden', 'true');
      const ambientPositions = [
        { top: '12vh',  left: '1.5vw',  size: 44, rot: -12, name: 'Sagittarius' },
        { top: '62vh',  left: '0.8vw',  size: 38, rot: 14,  name: 'Capricorn' },
        { top: '34vh',  right: '1.2vw', size: 42, rot: 8,   name: 'Pisces' },
        { top: '85vh',  right: '3.5vw', size: 36, rot: -20, name: 'Taurus' },
      ];
      ambientPositions.forEach((p, i) => {
        const el = document.createElement('span');
        el.className = 'ambient-rashi-item';
        if (p.top) el.style.top = p.top;
        if (p.left) el.style.left = p.left;
        if (p.right) el.style.right = p.right;
        el.style.color = ['var(--plum)','var(--brass-deep)','var(--terracotta)','var(--moss)'][i % 4];
        el.style.transform = `rotate(${p.rot}deg)`;
        el.innerHTML = vedicIcon(p.name, p.size);
        ambient.appendChild(el);
      });
      main.appendChild(ambient);
    }
  }

  // ----- Utility helpers ------------------------------------------------
  function dedupe(list) {
    // If "ALL" is selected, a single person could appear twice (e.g. India
    // cabinet and Lok Sabha). Keep the first occurrence.
    const seen = new Set();
    const out = [];
    for (const p of list) {
      const k = keyOf(p);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  }
  function flagOf(c) {
    return c === 'IN' ? '🇮🇳' : c === 'US' ? '🇺🇸' : c === 'UK' ? '🇬🇧' : '';
  }
  function slug(s) {
    return (s || 'other').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // ======================================================================
  // Top-bar ticker: rotating compatibility news banner
  // ======================================================================
  function renderTicker() {
    const el = document.getElementById('ticker');
    if (!el) return;
    const pool = dedupe(all[state.country]);
    // Get a handful of high and low pairs from the active country quickly.
    // Sample to keep it fast on big rosters.
    const n = Math.min(pool.length, 160);
    const sampled = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
    const pairs = [];
    for (let i = 0; i < sampled.length; i++) {
      for (let j = i + 1; j < sampled.length; j++) {
        pairs.push([sampled[i], sampled[j], scoreFn(sampled[i], sampled[j]).total]);
      }
    }
    pairs.sort((a, b) => b[2] - a[2]);
    const top = pairs.slice(0, 4);
    const bot = pairs.slice(-3).reverse();
    const sep = '<span class="sep">·</span>';
    const segs = [];
    top.forEach(([a, b, t]) => {
      segs.push(`${a.name} &times; ${b.name} <b>${t.toFixed(0)}/36</b> — parents would approve`);
    });
    bot.forEach(([a, b, t]) => {
      segs.push(`${a.name} &times; ${b.name} <b>${t.toFixed(0)}/36</b> — do not proceed`);
    });
    segs.push(`the moon moves about one nakshatra a day`);
    segs.push(`noon chart, noon chart, noon chart`);
    segs.push(`same Nadi is the classical dealbreaker; no amount of Graha Maitri can save you`);
    segs.push(`click the masthead for a pair the stars endorse →`);

    const run = segs.join(`  ${sep}  `);
    // Duplicate for seamless -50% loop
    el.innerHTML = `<div class="ticker-track">${run}  ${sep}  ${run}  ${sep}  </div>`;
  }

  // Initial: apply theme + paint
  applyCountryTheme();
  syncPillsDisabled();
  renderCpNote();
  renderTicker();
  renderActive();
  renderAbout();
  scatterRashis();
})();
