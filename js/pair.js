// --- Parliament Kundli :: pair detail drawer --------------------------------

// U+FE0E (variation selector 15) forces monochrome text rendering on
// platforms that would otherwise upgrade these to colour emoji.
const RASHI_GLYPH = {
  Aries: 'Mesha', Taurus: 'Vrishabha', Gemini: 'Mithuna', Cancer: 'Karka',
  Leo: 'Simha', Virgo: 'Kanya', Libra: 'Tula', Scorpio: 'Vrishchika',
  Sagittarius: 'Dhanu', Capricorn: 'Makara', Aquarius: 'Kumbha', Pisces: 'Meena',
};

// Planet / glyph per koot — astrological rather than generic bar.
const KOOT_META = [
  { key: 'varna',        label: 'Varna',        max: 1, planet: '☉', blurb: 'caste ladder by moon sign; the groom is not meant to rank below' },
  { key: 'vashya',       label: 'Vashya',       max: 2, planet: '♂', blurb: 'who can tame whom — human, quadruped, water, wild, insect' },
  { key: 'tara',         label: 'Tara',         max: 3, planet: '☆', blurb: 'nakshatra counts in both directions; nine auspicious, nine not' },
  { key: 'yoni',         label: 'Yoni',         max: 4, planet: '♀', blurb: 'each nakshatra has an animal; would they eat each other' },
  { key: 'graha_maitri', label: 'Graha Maitri', max: 5, planet: '♃', blurb: 'friendship between the planets that rule the two moon signs' },
  { key: 'gana',         label: 'Gana',         max: 6, planet: '☿', blurb: 'god, human, or demon — and whether those three ever agree' },
  { key: 'bhakoot',      label: 'Bhakoot',      max: 7, planet: '♄', blurb: 'angular distance between moon signs; 2-12, 6-8, opposite are bad news' },
  { key: 'nadi',         label: 'Nadi',         max: 8, planet: '☾', blurb: 'constitutional channel — same channel is the famous dealbreaker' },
];

function verdict(total) {
  if (total >= 32) return { label: 'book the mandap',       kind: 'ordained' };
  if (total >= 26) return { label: 'parents would approve', kind: 'strong' };
  if (total >= 18) return { label: 'technically a match',   kind: 'threshold' };
  if (total >= 12) return { label: 'the pandit hesitates',  kind: 'dealbreaker' };
  return               { label: 'do not proceed',           kind: 'cursed' };
}

function kootEssay(match, a, b) {
  const { gana, bhakoot, nadi } = match;
  if (nadi === 0)   return `They share <em>Nadi</em>. This is the classical dealbreaker &mdash; <em>Nadi dosha</em> &mdash; and no other koot can rescue it. A North Indian family at this point would thank everyone for their time and move on.`;
  if (bhakoot === 0 && gana === 0)
    return `<em>Bhakoot</em> and <em>Gana</em> both at zero: the moon signs are already in a bad angle, and one of them is a god while the other is a demon. This is the kind of chart a pandit reads once and hands back.`;
  if (gana === 0)   return `One is a <em>Deva</em>, the other a <em>Rakshasa</em>. The tradition has a lot to say about gods and demons sharing a household, and none of it is encouraging.`;
  if (bhakoot === 0) return `<em>Bhakoot</em> fails. The two moon signs sit in one of the three angles the tradition warns about &mdash; 2-12, 6-8, or directly opposite. Classical manuals expect trouble with money, trouble with health, or both.`;
  if (match.total >= 32) return `Nearly every koot pays out. This is the kind of chart that gets photocopied and circulated among aunties.`;
  if (match.total >= 26) return `A solid match. The koots that miss are the minor ones; the heavyweights &mdash; Bhakoot and Nadi &mdash; land cleanly.`;
  if (match.total >= 18) return `Above eighteen, which is the line a pandit draws before agreeing to set a date. Not a glowing chart, but not one anyone would refuse.`;
  return `Below eighteen. In a real kundli match, this is the point at which the astrologer puts the paperwork down and gently suggests looking elsewhere.`;
}

function personBlock(p, side) {
  const A = window.PK_astro;
  const lordP = A ? A.lordOf(p.moon_rashi_name) : null;
  const lordG = (A && lordP) ? A.PLANET_GLYPH[lordP] : '';
  const yoniA = A ? (A.yoniAnimalOf(p.moon_nakshatra_name) || '') : '';
  const yoniG = A ? (A.yoniGlyphOf(p.moon_nakshatra_name) || '') : '';
  return `
    <div class="pair-person p-${side}">
      <div class="pp-name">${p.name}</div>
      <div class="pp-meta">${p.role || p.party || ''}${(p.role && p.party) ? ' &middot; ' + p.party : ''}</div>
      <div class="pp-moon">
        <span class="glyph">${RASHI_GLYPH[p.moon_rashi_name] || ''}</span>
        <span>
          <span class="rashi-word">${p.moon_rashi_name} moon</span>
          <span class="nak">${p.moon_nakshatra_name} &middot; pada ${p.moon_pada}</span>
        </span>
      </div>
      <div class="pp-yoni">
        <span class="yoni-glyph" aria-hidden="true">${yoniG}</span>
        <span>${yoniA.toLowerCase()} yoni</span>
        <span class="yoni-lord" title="${lordP || ''}: rashi-lord">${lordG}</span>
      </div>
    </div>
  `;
}

function renderPair(a, b, match) {
  const panel = document.getElementById('pair-panel');
  const c     = document.getElementById('pair-content');
  const v     = verdict(match.total);

  const row = (k) => {
    const m = KOOT_META.find(x => x.key === k.key);
    const pct = (k.score / k.max) * 100;
    const isMax = k.score === k.max;
    const isZero = k.score === 0;
    const cls = isZero ? 'zero' : (isMax ? 'full' : '');
    const rowCls = isMax ? 'max' : isZero ? 'zero' : '';
    return `
      <div class="koot-row ${rowCls}">
        <div class="koot-planet" aria-hidden="true">${m.planet}</div>
        <div>
          <div class="koot-name">${m.label}</div>
          <span class="koot-sub">${m.blurb}</span>
        </div>
        <div class="koot-bar-wrap">
          <div class="koot-bar ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="koot-score">${k.score}/${k.max}</div>
      </div>
    `;
  };

  c.innerHTML = `
    <div class="pair-header">
      <div class="pair-eyebrow">the ruling</div>
      <div class="pair-score-row">
        <div class="pair-score">
          ${match.total.toFixed(0)}<span class="denom">/36</span>
        </div>
        <div>
          <div class="pair-verdict v-${v.kind}">${v.label}</div>
        </div>
      </div>
      <div class="pair-names">
        ${personBlock(a, 'A')}
        <div class="vs">×</div>
        ${personBlock(b, 'B')}
      </div>
    </div>

    <div class="koots">
      ${KOOT_META.map(meta => row({ key: meta.key, score: match[meta.key], max: meta.max })).join('')}
    </div>

    <p class="koot-essay">${kootEssay(match, a, b)}</p>
  `;

  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function closePair() {
  const panel = document.getElementById('pair-panel');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

window.PK_renderPair = renderPair;
window.PK_closePair  = closePair;
window.PK_verdict    = verdict;
