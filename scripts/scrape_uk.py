"""Scrape UK Commons MPs elected in 2024 from Wikipedia.

The list article has one big sortable table (Constituency | 2019 affil. |
Member returned in 2024 | Notes). The "Member returned" cell contains the
member name with a wiki link AND the party (often as a coloured column).
DOBs come from Wikidata + infobox fallback.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

from .scrape_lib import (
    fetch, expand_rowspans, find_link_title,
    enrich_with_wikidata, enrich_with_infobox,
)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "_raw"
LIST_URL = "https://en.wikipedia.org/wiki/List_of_MPs_elected_in_the_2024_United_Kingdom_general_election"
LIST_RAW = RAW / "uk_commons.html"
OUT = ROOT / "data" / "uk_roster.json"


def ensure(url: str, path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.stat().st_size < 10_000:
        print(f"fetching {url}")
        path.write_text(fetch(url))
    return path.read_text()


def parse(html: str) -> list[dict]:
    """The 2024 UK list has a two-row merged header + seven data columns:
      col 0  Constituency
      col 2  Affiliation in 2019 (ignored)
      col 3  Member (name, with portrait link + name link)
      col 5  Affiliation (party, with link titled like 'Labour Party (UK)')
    We walk rows from index 2 onward.
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table", class_="wikitable")
    t = max(tables, key=lambda tt: len(list(expand_rowspans(tt))))
    rows = list(expand_rowspans(t))
    if len(rows) < 100:
        return []

    out = []
    for cells in rows[2:]:
        if len(cells) < 6:
            continue
        const_cell = cells[0]
        name_cell  = cells[3]
        party_cell = cells[5]

        # Name: prefer the *second* non-File link (first is the portrait image,
        # second is the name's article link).
        name_title = find_link_title(name_cell)
        name_text = name_cell.get_text(" ", strip=True)
        if not name_text or name_text.startswith("—"):
            continue

        # Party: pull the link in the affiliation cell
        party_title = find_link_title(party_cell) or ""
        party_text = party_cell.get_text(" ", strip=True)
        if party_title:
            party = party_title.replace("_", " ")
            # "Labour_Party_(UK)" -> "Labour" cleanup
            party = re.sub(r'\s*\(UK\)\s*$', '', party)
        else:
            party = party_text

        row = {
            "name": name_text,
            "wiki_title": name_title,
            "constituency": const_cell.get_text(" ", strip=True),
            "state": "",
            "party": party,
            "country": "UK",
            "chamber": "Commons",
        }
        out.append(row)

    # Dedupe by (name, constituency)
    seen = set()
    keep = []
    for r in out:
        k = (r["name"], r["constituency"])
        if k in seen:
            continue
        seen.add(k)
        keep.append(r)
    return keep


def main():
    html = ensure(LIST_URL, LIST_RAW)
    roster = parse(html)
    print(f"parsed {len(roster)} MPs")
    from collections import Counter
    print("parties (top 10):")
    for p, c in Counter(r["party"] for r in roster).most_common(10):
        print(f"  {c:>4}  {p[:60]!r}")

    print(f"\nenriching DOB (Wikidata)...")
    enrich_with_wikidata(roster)
    print(f"  with DOB: {sum(1 for r in roster if r.get('dob'))}")

    print(f"enriching DOB (Wikipedia infobox fallback)...")
    enrich_with_infobox(roster, RAW / "uk_pages")
    print(f"  with DOB: {sum(1 for r in roster if r.get('dob'))}")

    OUT.write_text(json.dumps(roster, indent=2, ensure_ascii=False))
    print(f"\nwrote {OUT.relative_to(ROOT)} ({len(roster)} MPs, "
          f"{sum(1 for r in roster if r.get('dob'))} with DOB)")


if __name__ == "__main__":
    main()
