"""Scrape the 18th Lok Sabha roster from Wikipedia + Wikidata.

Pipeline:
  1. Parse the Wikipedia list article (one entry per MP, grouped by state).
  2. Collect each MP's name + wiki article link + party + constituency + state.
  3. Batch-hit Wikidata's wbgetentities endpoint by enwiki page title to pull
     P569 (date of birth) and P21 (gender).
  4. Write data/parliament_mps.json and, for the subset with DOB, compute
     Kundlis + pairwise Ashtakoot (downstream: build_parliament.py).

Politeness: single-threaded, UA string, 500ms between Wikidata batches.
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW_HTML = ROOT / "data" / "_raw" / "ls18_wiki.html"
OUT_ROSTER = ROOT / "data" / "parliament_roster.json"

UA = "parliament-kundli/0.1 (research; rb12295@gmail.com)"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def ensure_html() -> str:
    RAW_HTML.parent.mkdir(parents=True, exist_ok=True)
    if not RAW_HTML.exists() or RAW_HTML.stat().st_size < 10_000:
        print("fetching Wikipedia list article...")
        html = fetch("https://en.wikipedia.org/wiki/List_of_members_of_the_18th_Lok_Sabha")
        RAW_HTML.write_text(html)
    return RAW_HTML.read_text()


# ------------- Parse wikitables --------------------------------------------

def expand_rowspans(table):
    """Yield each row as a list of cells, honouring rowspan/colspan."""
    pending: dict[int, list] = {}  # col_idx -> [cell, rows_left]
    for tr in table.find_all("tr"):
        row: list = []
        col = 0
        cells_iter = iter(tr.find_all(["td", "th"]))
        while True:
            # Any pending rowspan cells from earlier rows at this position?
            if col in pending:
                cell, left = pending[col]
                row.append(cell)
                left -= 1
                if left <= 0:
                    del pending[col]
                else:
                    pending[col] = [cell, left]
                col += 1
                continue
            try:
                c = next(cells_iter)
            except StopIteration:
                break
            rs = int(c.get("rowspan", 1) or 1)
            cs = int(c.get("colspan", 1) or 1)
            for _ in range(cs):
                row.append(c)
                if rs > 1:
                    pending[col] = [c, rs - 1]
                col += 1
        yield row


def parse_roster(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")

    # Find all h2/h3 state headings and the wikitables under them.
    # Each table's rows: # | Constituency | Name | Party | Alliance
    rows = []

    # Walk the main article body; track the most recent h2 (state) heading.
    body = soup.find("div", class_="mw-parser-output")
    current_state = None

    for el in body.find_all(["h2", "h3", "table"]):
        if el.name in {"h2", "h3"}:
            heading = el.get_text(" ", strip=True)
            # Strip trailing "[edit]" sometimes present
            heading = re.sub(r"\[edit\]\s*$", "", heading).strip()
            # Skip uninteresting headings (ToC / references / etc.)
            if heading and not any(h in heading.lower() for h in
                                   ["contents", "see also", "references",
                                    "external links", "notes", "background",
                                    "by party", "results"]):
                current_state = heading
            continue

        if "wikitable" not in (el.get("class") or []):
            continue
        if current_state is None:
            continue

        # Parse table with rowspan awareness.
        table_rows = list(expand_rowspans(el))
        if not table_rows:
            continue
        headers = [h.get_text(" ", strip=True).lower() for h in table_rows[0]]

        def col_idx(*targets):
            for t in targets:
                for i, h in enumerate(headers):
                    if t in h:
                        return i
            return None

        idx_const = col_idx("constituency")
        idx_name  = col_idx("mp", "member", "name", "elected")
        idx_party = col_idx("party", "political")
        idx_alli  = col_idx("alliance", "coalition")
        if idx_const is None or idx_name is None:
            continue

        for cells in table_rows[1:]:
            if len(cells) < 2:
                continue
            try:
                name_cell = cells[idx_name]
            except IndexError:
                continue
            # Grab the first internal link in the name cell -> MP wiki article
            a = name_cell.find("a")
            wiki_title = None
            if a and a.get("href", "").startswith("/wiki/"):
                href = a["href"]
                # Skip file / category links
                if not any(href.startswith(f"/wiki/{p}") for p in
                           ("File:", "Category:", "Help:", "Special:")):
                    wiki_title = urllib.parse.unquote(href[len("/wiki/"):])
            name = name_cell.get_text(" ", strip=True)

            # Skip rows that look like "Vacant" or section sub-heads
            if not name or name.lower().startswith("vacant"):
                continue
            # Skip cells that are purely a heading (colspan=all)
            if len(cells) < 3:
                continue

            def txt(i):
                if i is None or i >= len(cells):
                    return ""
                out = cells[i].get_text(" ", strip=True)
                # Wikipedia "Party" column is often TWO cells: a coloured 2px
                # bar, then the party name. If the cell is blank and the next
                # looks like a party name, use it.
                if not out and i + 1 < len(cells):
                    return cells[i + 1].get_text(" ", strip=True)
                return out

            rows.append({
                "name": name,
                "wiki_title": wiki_title,
                "state": current_state,
                "constituency": txt(idx_const),
                "party": txt(idx_party) if idx_party is not None else "",
                "alliance": txt(idx_alli) if idx_alli is not None else "",
            })

    # Dedupe by (name, constituency) -- some sub-tables repeat headers
    seen = set()
    dedup = []
    for r in rows:
        k = (r["name"], r["constituency"])
        if k in seen:
            continue
        seen.add(k)
        dedup.append(r)
    return dedup


# ------------- Hit Wikidata by wiki title ----------------------------------

def wikidata_batch(titles: list[str]) -> dict:
    """wbgetentities by enwiki page titles; returns {title: claim_json}."""
    url = "https://www.wikidata.org/w/api.php"
    q = {
        "action": "wbgetentities",
        "sites":  "enwiki",
        "titles": "|".join(titles),
        "props":  "claims|sitelinks",
        "format": "json",
        "languages": "en",
    }
    full = url + "?" + urllib.parse.urlencode(q)
    raw = fetch(full)
    data = json.loads(raw)
    out = {}
    for _, ent in (data.get("entities") or {}).items():
        # figure out which title this entity corresponds to
        sl = (ent.get("sitelinks") or {}).get("enwiki") or {}
        t = sl.get("title")
        if t:
            out[t] = ent
    return out


def extract_dob_gender(ent: dict) -> tuple[str | None, str | None]:
    claims = ent.get("claims") or {}

    dob = None
    for c in claims.get("P569", []):
        try:
            val = c["mainsnak"]["datavalue"]["value"]
            # "+1950-09-17T00:00:00Z"
            t = val["time"]
            precision = val.get("precision", 11)
            if precision < 11:  # anything below day-precision is useless
                continue
            dob = t.lstrip("+")[:10]
            break
        except (KeyError, TypeError):
            continue

    gender = None
    for c in claims.get("P21", []):
        try:
            qid = c["mainsnak"]["datavalue"]["value"]["id"]
            gender = {"Q6581097": "male", "Q6581072": "female",
                      "Q1052281": "other", "Q1097630": "other"}.get(qid, qid)
            break
        except (KeyError, TypeError):
            continue
    return dob, gender


# ------------- Main --------------------------------------------------------

def main():
    html = ensure_html()
    roster = parse_roster(html)
    with_wiki = [r for r in roster if r["wiki_title"]]
    print(f"parsed {len(roster)} MPs, {len(with_wiki)} linked to wiki articles")

    # batch query Wikidata, 50 titles at a time
    BATCH = 45
    titles = [r["wiki_title"].replace("_", " ") for r in with_wiki]
    title_to_row = {r["wiki_title"].replace("_", " "): r for r in with_wiki}
    matched = 0
    with_dob = 0
    for i in range(0, len(titles), BATCH):
        chunk = titles[i:i + BATCH]
        try:
            ents = wikidata_batch(chunk)
        except Exception as e:
            print(f"  batch {i} failed: {e}; retrying once")
            time.sleep(2.0)
            ents = wikidata_batch(chunk)

        for t, ent in ents.items():
            row = title_to_row.get(t)
            if not row:
                continue
            matched += 1
            dob, gender = extract_dob_gender(ent)
            if dob:
                row["dob"] = dob
                with_dob += 1
            if gender:
                row["gender"] = gender
            row["wikidata"] = ent.get("id")

        print(f"  wikidata batch {i//BATCH + 1}/{(len(titles)+BATCH-1)//BATCH}: "
              f"matched={matched} dob={with_dob}")
        time.sleep(0.4)  # politeness

    # Final counts by state (sanity)
    print("\ncoverage:")
    print(f"  total MPs parsed:      {len(roster)}")
    print(f"  wiki-linked MPs:       {len(with_wiki)}")
    print(f"  with DOB from Wikidata: {with_dob}")

    OUT_ROSTER.write_text(json.dumps(roster, indent=2, ensure_ascii=False))
    print(f"\nwrote {OUT_ROSTER.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
