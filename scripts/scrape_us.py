"""Scrape current US Senate + House of Representatives from Wikipedia.

Each list article has a single big sortable wikitable with a "Born" column
containing the DOB as text (e.g. "April 15, 1970"). That's faster than
Wikidata. We fall back to Wikidata / infobox for any row that fails to
parse.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

from .scrape_lib import (
    fetch, expand_rowspans, find_link_title,
    extract_dob_from_html,
    enrich_with_wikidata, enrich_with_infobox,
)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "_raw"

SENATE_URL = "https://en.wikipedia.org/wiki/List_of_current_United_States_senators"
HOUSE_URL  = "https://en.wikipedia.org/wiki/List_of_current_members_of_the_United_States_House_of_Representatives"

SENATE_RAW = RAW / "us_senate.html"
HOUSE_RAW  = RAW / "us_house.html"

OUT = ROOT / "data" / "us_roster.json"


def ensure(url: str, path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size < 10_000:
        print(f"fetching {url}")
        path.write_text(fetch(url))
    return path.read_text()


def parse_wikitable(html: str, *, big_row_min: int = 90) -> list[dict]:
    """Parse the biggest wikitable with a 'Born' column."""
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table", class_="wikitable")
    chosen = None
    for t in tables:
        rows = list(expand_rowspans(t))
        if not rows:
            continue
        hdrs = [h.get_text(" ", strip=True).lower() for h in rows[0]]
        if len(rows) > big_row_min and any("born" in h for h in hdrs):
            chosen = (t, rows, hdrs)
            break
    if not chosen:
        return []
    t, rows, hdrs = chosen

    def idx_of(*keys):
        for key in keys:
            for i, h in enumerate(hdrs):
                if key in h:
                    return i
        return None

    idx_name = idx_of("senator", "member", "name")
    idx_state = idx_of("state")
    idx_dist = idx_of("district")
    idx_party = idx_of("party")
    idx_born = idx_of("born")

    out = []
    for cells in rows[1:]:
        if len(cells) < 4:
            continue
        name_cell = cells[idx_name] if idx_name is not None and idx_name < len(cells) else None
        if not name_cell:
            continue
        name = name_cell.get_text(" ", strip=True)
        if not name or len(name) < 3:
            continue
        wiki = find_link_title(name_cell)
        party_cell = cells[idx_party] if idx_party is not None and idx_party < len(cells) else None
        # US party column may also be "colour bar + text" doublet
        party = party_cell.get_text(" ", strip=True) if party_cell else ""
        if not party and idx_party is not None and idx_party + 1 < len(cells):
            party = cells[idx_party + 1].get_text(" ", strip=True)
        state = cells[idx_state].get_text(" ", strip=True) if idx_state is not None and idx_state < len(cells) else ""
        district = cells[idx_dist].get_text(" ", strip=True) if idx_dist is not None and idx_dist < len(cells) else ""
        born_html = str(cells[idx_born]) if idx_born is not None and idx_born < len(cells) else ""
        dob = extract_dob_from_html(born_html)

        row = {
            "name": name,
            "wiki_title": wiki,
            "state": state,
            "constituency": district or state,
            "party": party,
            "country": "US",
        }
        if dob:
            row["dob"] = dob
            row["dob_source"] = "wiki-table"
        out.append(row)
    # Dedupe by name+state
    seen = set()
    keep = []
    for r in out:
        k = (r["name"], r.get("state", ""))
        if k in seen:
            continue
        seen.add(k)
        keep.append(r)
    return keep


def main():
    senate_html = ensure(SENATE_URL, SENATE_RAW)
    house_html = ensure(HOUSE_URL, HOUSE_RAW)

    senators = parse_wikitable(senate_html, big_row_min=80)
    for s in senators:
        s["chamber"] = "Senate"
    print(f"senate: {len(senators)} rows, {sum(1 for r in senators if r.get('dob'))} with DOB")

    reps = parse_wikitable(house_html, big_row_min=300)
    for r in reps:
        r["chamber"] = "House"
    print(f"house:  {len(reps)} rows, {sum(1 for r in reps if r.get('dob'))} with DOB")

    roster = senators + reps

    # Fallback enrichment for any row missing DOB
    before = sum(1 for r in roster if r.get("dob"))
    print(f"\nfilling gaps via Wikidata (have {before} DOBs, need {len(roster) - before})")
    enrich_with_wikidata(roster)
    after = sum(1 for r in roster if r.get("dob"))
    print(f"  after wikidata: {after} DOBs (+{after - before})")

    before = after
    enrich_with_infobox(roster, RAW / "us_pages")
    after = sum(1 for r in roster if r.get("dob"))
    print(f"  after infobox:  {after} DOBs (+{after - before})")

    # Strip leading Q- for "Party" column that sometimes came as colour-bar
    for r in roster:
        r["party"] = re.sub(r'^\s*[A-Z][A-Z]?\s+', '', r.get("party", "")).strip() or r.get("party", "")

    OUT.write_text(json.dumps(roster, indent=2, ensure_ascii=False))
    print(f"\nwrote {OUT.relative_to(ROOT)} ({len(roster)} total, {after} with DOB)")


if __name__ == "__main__":
    main()
