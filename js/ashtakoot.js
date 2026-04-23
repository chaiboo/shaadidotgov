// --- Parliament Kundli :: Ashtakoot scoring (client-side) -------------------
//
// JS port of scripts/ashtakoot.py. Input: two kundli rows with integer
// moon_rashi (0-11) and moon_nakshatra (0-26). Output: 8 koot scores + total.

(function (root) {

  // Varna hierarchy: Brahmin 3 > Kshatriya 2 > Vaishya 1 > Shudra 0
  const VARNA_BY_RASHI = [2,1,0,3,2,1,0,3,2,1,0,3];

  function varna(ar, br) {
    const gap = Math.abs(VARNA_BY_RASHI[ar] - VARNA_BY_RASHI[br]);
    return gap === 0 ? 1.0 : gap === 1 ? 0.5 : 0.0;
  }

  // Vashya groups: 0 quad, 1 human, 2 water, 3 wild, 4 insect
  const VASHYA_BY_RASHI = [0,0,1,2,3,1,1,4,1,2,1,2];
  const VASHYA = {
    '0,0':2, '1,1':2, '2,2':2, '3,3':2, '4,4':2,
    '0,1':1, '0,2':0, '0,3':0, '0,4':1,
    '1,2':1, '1,3':0.5, '1,4':1,
    '2,3':1, '2,4':1,
    '3,4':0.5,
  };
  function vashya(ar, br) {
    const a = VASHYA_BY_RASHI[ar], b = VASHYA_BY_RASHI[br];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    return VASHYA[key] ?? 0;
  }

  // Tara
  const GOOD_TARA = new Set([2,4,6,8,9]);
  function taraOk(src, tgt) {
    const count = ((tgt - src + 27) % 27) + 1;
    const rem = count % 9 === 0 ? 9 : count % 9;
    return GOOD_TARA.has(rem);
  }
  function tara(an, bn) {
    return ((taraOk(an, bn) ? 1 : 0) + (taraOk(bn, an) ? 1 : 0)) * 1.5;
  }

  // Yoni: [yoni_name, gender] per nakshatra
  const YONI_OF_NAK = [
    ['Horse','M'],['Elephant','M'],['Sheep','F'],['Serpent','M'],['Serpent','F'],
    ['Dog','F'],['Cat','F'],['Sheep','M'],['Cat','M'],['Rat','M'],['Rat','F'],
    ['Cow','F'],['Buffalo','M'],['Tiger','F'],['Buffalo','F'],['Tiger','M'],
    ['Deer','F'],['Deer','M'],['Dog','M'],['Monkey','M'],['Mongoose','M'],
    ['Monkey','F'],['Lion','F'],['Horse','F'],['Lion','M'],['Cow','M'],['Elephant','F']
  ];
  const YONI_ENEMIES = new Set([
    'Horse|Buffalo','Buffalo|Horse',
    'Elephant|Lion','Lion|Elephant',
    'Sheep|Monkey','Monkey|Sheep',
    'Serpent|Mongoose','Mongoose|Serpent',
    'Cat|Rat','Rat|Cat',
    'Dog|Deer','Deer|Dog',
    'Cow|Tiger','Tiger|Cow',
  ]);
  const YONI_MILD = new Set([
    'Horse|Sheep','Sheep|Horse',
    'Elephant|Sheep','Sheep|Elephant',
    'Cat|Dog','Dog|Cat',
    'Monkey|Sheep','Sheep|Monkey',
    'Lion|Dog','Dog|Lion',
    'Mongoose|Rat','Rat|Mongoose',
  ]);
  function yoni(an, bn) {
    const [ya, ga] = YONI_OF_NAK[an], [yb, gb] = YONI_OF_NAK[bn];
    if (ya === yb) return ga !== gb ? 4 : 3;
    const k = `${ya}|${yb}`;
    if (YONI_ENEMIES.has(k)) return 0;
    if (YONI_MILD.has(k))    return 1;
    return 2;
  }

  // Graha Maitri
  const LORDS = ['Mars','Venus','Mercury','Moon','Sun','Mercury',
                 'Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
  const FRIEND = {
    'Sun|Moon':'F','Sun|Mars':'F','Sun|Mercury':'N','Sun|Jupiter':'F','Sun|Venus':'E','Sun|Saturn':'E',
    'Moon|Sun':'F','Moon|Mars':'N','Moon|Mercury':'F','Moon|Jupiter':'N','Moon|Venus':'N','Moon|Saturn':'N',
    'Mars|Sun':'F','Mars|Moon':'F','Mars|Mercury':'E','Mars|Jupiter':'F','Mars|Venus':'N','Mars|Saturn':'N',
    'Mercury|Sun':'F','Mercury|Moon':'E','Mercury|Mars':'N','Mercury|Jupiter':'N','Mercury|Venus':'F','Mercury|Saturn':'N',
    'Jupiter|Sun':'F','Jupiter|Moon':'F','Jupiter|Mars':'F','Jupiter|Mercury':'E','Jupiter|Venus':'E','Jupiter|Saturn':'N',
    'Venus|Sun':'E','Venus|Moon':'E','Venus|Mars':'N','Venus|Mercury':'F','Venus|Jupiter':'N','Venus|Saturn':'F',
    'Saturn|Sun':'E','Saturn|Moon':'E','Saturn|Mars':'E','Saturn|Mercury':'F','Saturn|Jupiter':'N','Saturn|Venus':'F',
  };
  function grahaMaitri(ar, br) {
    const la = LORDS[ar], lb = LORDS[br];
    if (la === lb) return 5;
    const ab = FRIEND[`${la}|${lb}`] || 'N';
    const ba = FRIEND[`${lb}|${la}`] || 'N';
    if (ab === 'F' && ba === 'F') return 5;
    if ((ab === 'F' || ba === 'F') && (ab === 'N' || ba === 'N')) return 4;
    if (ab === 'N' && ba === 'N') return 3;
    if ((ab === 'F' || ba === 'F') && (ab === 'E' || ba === 'E')) return 1;
    if ((ab === 'N' || ba === 'N') && (ab === 'E' || ba === 'E')) return 0.5;
    return 0;
  }

  // Gana: 0 Deva, 1 Manushya, 2 Rakshasa
  const GANA_OF_NAK = [
    0,1,2,1,0,1, 0,0,2,2,1,1, 0,2,0,2,0,2,
    2,1,1,0,2,2, 1,1,0
  ];
  function gana(an, bn) {
    const ga = GANA_OF_NAK[an], gb = GANA_OF_NAK[bn];
    if (ga === gb) return 6;
    const k = [ga, gb].sort().join(',');
    if (k === '0,1') return 5;   // Deva + Manushya
    if (k === '1,2') return 1;   // Manushya + Rakshasa
    return 0;                    // Deva + Rakshasa
  }

  // Bhakoot
  function bhakoot(ar, br) {
    const d = Math.abs(ar - br);
    const gap = Math.min(d, 12 - d);
    return (gap === 0 || gap === 2 || gap === 3) ? 7 : 0;
  }

  // Nadi: 0 Adi, 1 Madhya, 2 Antya
  const NADI_OF_NAK = [
    0,1,2,2,1,0, 0,1,2,2,1,0, 0,1,2,2,1,0,
    0,1,2,2,1,0, 0,1,2
  ];
  function nadi(an, bn) {
    return NADI_OF_NAK[an] === NADI_OF_NAK[bn] ? 0 : 8;
  }

  function score(a, b) {
    const ar = a.moon_rashi, an = a.moon_nakshatra;
    const br = b.moon_rashi, bn = b.moon_nakshatra;
    const scores = {
      varna:        varna(ar, br),
      vashya:       vashya(ar, br),
      tara:         tara(an, bn),
      yoni:         yoni(an, bn),
      graha_maitri: grahaMaitri(ar, br),
      gana:         gana(an, bn),
      bhakoot:      bhakoot(ar, br),
      nadi:         nadi(an, bn),
    };
    const total = Object.values(scores).reduce((s, x) => s + x, 0);
    return { a: a.name, b: b.name, ...scores, total: Math.round(total * 10) / 10, max_total: 36 };
  }

  root.PK_ashtakoot = { score };
})(window);
