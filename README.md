# Parliament Kundli

Ashtakoot Guna Milan compatibility scoring applied to three legislatures:
the Indian Lok Sabha, the US Congress, and the UK Commons. Single-page
interactive, served from GitHub Pages.

Currently ~1,400 legislators across the three houses.

## What's in the box

### Computation (Python)

- `scripts/moon.py` &mdash; from-scratch lunar longitude (truncated
  Chapront-Touz&eacute; series from Meeus, *Astronomical Algorithms*
  Ch. 47, plus a Lahiri ayanamsa linear fit). No third-party astronomy.
- `scripts/kundli.py` &mdash; birth chart: sidereal moon longitude ->
  rashi / nakshatra / pada / navamsa.
- `scripts/ashtakoot.py` &mdash; the eight koots (Varna, Vashya, Tara,
  Yoni, Graha Maitri, Gana, Bhakoot, Nadi), following standard pandit
  convention.

### Rosters (Python scrapers)

- `scripts/scrape_lib.py` &mdash; shared helpers: rowspan-aware table
  parser, Wikidata `wbgetentities` batch fetch, Wikipedia infobox
  `<span class="bday">` DOB extraction.
- `scripts/scrape_parliament.py` &mdash; 18th Lok Sabha (543 MPs).
- `scripts/scrape_us.py` &mdash; 119th Congress (Senate + House).
- `scripts/scrape_uk.py` &mdash; UK Commons post-2024.
- `scripts/enrich_dob.py` &mdash; run after a roster scrape to fill
  missing DOBs via Wikidata + Wikipedia infobox fallback.
- `scripts/build_country.py IN|US|UK` &mdash; take a roster JSON,
  compute kundlis, classify the party into a bloc, write
  `data/country_XX.json`.
- `scripts/build_data.py` &mdash; rebuild the curated India-cabinet
  dataset (`data/kundlis.json`) from `data/politicians.yaml`.

### Frontend

- `index.html` &mdash; sticky top bar, six tabs, country pills.
- `styles.css` &mdash; one theme file, ~600 lines.
- `js/ashtakoot.js` &mdash; direct port of `scripts/ashtakoot.py`.
  Cross-verified against the Python implementation.
- `js/matrix.js` &mdash; D3 compatibility heatmap.
- `js/pair.js` &mdash; the koot-breakdown drawer.
- `js/app.js` &mdash; tab routing, country filter, per-tab renderers.

## Coverage

| Country | Chamber | Total | With DOB |
|---|---|---:|---:|
| India  | 18th Lok Sabha     | 543  | 476 (88%) |
| India  | Curated cabinet    | 40   | 40 (100%) |
| US     | 119th Congress     | 533  | 531 (99%) |
| UK     | Commons (2024)     | 650  | 421 (65%) |

UK coverage trails because many first-term 2024 MPs don't yet have
structured birth dates on Wikidata or clean Wikipedia infoboxes.

## Rebuilding

```bash
# Install deps (only pyyaml + beautifulsoup4)
pip3 install pyyaml beautifulsoup4

# Curated India cabinet (reads data/politicians.yaml)
python3 -m scripts.build_data

# Full 18th Lok Sabha
python3 -m scripts.scrape_parliament
python3 -m scripts.enrich_dob
python3 -m scripts.build_country IN

# US Congress
python3 -m scripts.scrape_us
python3 -m scripts.build_country US

# UK Commons
python3 -m scripts.scrape_uk
python3 -m scripts.build_country UK
```

## Serving locally

```bash
python3 -m http.server 8000
```

## Deploy

Push to a GitHub repo, enable Pages on main branch root. The scrapers
only need to run once; output JSON is committed to the repo.

Or use the GitHub Actions workflow at `.github/workflows/deploy.yml`
which rebuilds the India cabinet on every push.

## Birth-time caveat

Dates are public; times almost never are. We default to 12:00 local
time across every legislator. The Moon moves ~13 degrees per day, one
nakshatra per day, so noon is faithful unless the Moon crossed a
boundary that day.

## References

- B.V. Raman, *Hindu Predictive Astrology* (Ashtakoot convention).
- Jean Meeus, *Astronomical Algorithms* 2e, Ch. 47 (lunar longitude).
- Wikidata + Wikipedia (rosters, DOBs).
