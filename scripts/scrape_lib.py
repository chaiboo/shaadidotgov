"""Shared helpers for roster scraping + Wikidata DOB enrichment."""

from __future__ import annotations

import json
import re
import time
import urllib.parse
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

UA = "parliament-kundli/0.1 (research; rb12295@gmail.com)"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def expand_rowspans(table):
    """Yield each row as a list of cells, honouring rowspan/colspan."""
    pending: dict[int, list] = {}
    for tr in table.find_all("tr"):
        row: list = []
        col = 0
        cells_iter = iter(tr.find_all(["td", "th"]))
        while True:
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


def find_link_title(cell) -> str | None:
    """First internal article-space /wiki/ link in a cell."""
    for a in cell.find_all("a"):
        href = a.get("href", "")
        if not href.startswith("/wiki/"):
            continue
        if any(href.startswith(f"/wiki/{p}") for p in
               ("File:", "Category:", "Help:", "Special:", "Template:")):
            continue
        # Skip party pages (title ends with "Party" or similar)
        title = urllib.parse.unquote(href[len("/wiki/"):])
        # Drop anchor
        title = title.split("#")[0]
        if title:
            return title
    return None


# --- Wikidata -------------------------------------------------------------

def wikidata_batch_by_title(titles: list[str]) -> dict:
    url = "https://www.wikidata.org/w/api.php"
    q = {
        "action": "wbgetentities",
        "sites":  "enwiki",
        "titles": "|".join(titles),
        "props":  "claims|sitelinks",
        "format": "json",
    }
    raw = fetch(url + "?" + urllib.parse.urlencode(q))
    data = json.loads(raw)
    out = {}
    for _, ent in (data.get("entities") or {}).items():
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
            t = val["time"]
            precision = val.get("precision", 11)
            if precision < 11:
                continue
            dob = t.lstrip("+")[:10]
            break
        except (KeyError, TypeError):
            continue
    # Wikidata has many specific gender Q-ids; map them onto the binary filter
    # buckets and keep the specific Q-id for anything finer-grained.
    GENDER_MAP = {
        "Q6581097":  "male",    # male
        "Q15145778": "male",    # cisgender male
        "Q2449503":  "male",    # trans man
        "Q6581072":  "female",  # female
        "Q15145779": "female",  # cisgender female
        "Q1052281":  "female",  # trans woman
    }
    gender = None
    for c in claims.get("P21", []):
        try:
            qid = c["mainsnak"]["datavalue"]["value"]["id"]
            gender = GENDER_MAP.get(qid, "other")
            break
        except (KeyError, TypeError):
            continue
    return dob, gender


def enrich_with_wikidata(rows: list[dict], batch: int = 45) -> None:
    """In-place: add `dob`, `gender`, `wikidata` to rows that have `wiki_title`."""
    idx = {r["wiki_title"].replace("_", " "): r for r in rows if r.get("wiki_title")}
    titles = list(idx)
    for i in range(0, len(titles), batch):
        chunk = titles[i:i + batch]
        try:
            ents = wikidata_batch_by_title(chunk)
        except Exception as e:
            print(f"  batch {i} retry: {e}")
            time.sleep(2.0)
            ents = wikidata_batch_by_title(chunk)
        for t, ent in ents.items():
            row = idx.get(t)
            if not row:
                continue
            dob, gender = extract_dob_gender(ent)
            if dob and not row.get("dob"):
                row["dob"] = dob
            if gender and not row.get("gender"):
                row["gender"] = gender
            row["wikidata"] = ent.get("id")
        time.sleep(0.3)


# --- Wikipedia infobox DOB fallback --------------------------------------

BDAY_RE = re.compile(r'class="bday"[^>]*>(\d{4}-\d{2}-\d{2})</span>')
_MONTHS = {'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,
           'July':7,'August':8,'September':9,'October':10,'November':11,'December':12}


def extract_dob_from_html(html: str) -> str | None:
    m = BDAY_RE.search(html)
    if m:
        return m.group(1)
    m = re.search(
        r'born[^<]{0,40}?(\d{1,2})\s+(January|February|March|April|May|June|'
        r'July|August|September|October|November|December)\s+(\d{4})',
        html, re.I)
    if m:
        d, mon, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{_MONTHS[mon.capitalize()]:02d}-{int(d):02d}"
    # US "Born MMM DD, YYYY" format sometimes in the Senate/House table itself
    m = re.search(
        r'(January|February|March|April|May|June|July|August|September|'
        r'October|November|December)\s+(\d{1,2}),\s+(\d{4})', html)
    if m:
        mon, d, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{_MONTHS[mon]:02d}-{int(d):02d}"
    return None


def enrich_with_infobox(rows: list[dict], cache_dir: Path,
                        only_missing: bool = True, sleep_s: float = 0.12) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    need = [r for r in rows if r.get("wiki_title") and (not only_missing or not r.get("dob"))]
    for i, r in enumerate(need, 1):
        title = r["wiki_title"]
        safe = re.sub(r'[^\w\-_.]', '_', title)[:100]
        p = cache_dir / f"{safe}.html"
        html = None
        if p.exists() and p.stat().st_size > 500:
            html = p.read_text(errors="replace")
        else:
            try:
                html = fetch(f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}")
                p.write_text(html)
                time.sleep(sleep_s)
            except HTTPError:
                continue
            except Exception:
                continue
        dob = extract_dob_from_html(html or "")
        if dob and not r.get("dob"):
            r["dob"] = dob
            r["dob_source"] = "wiki-infobox"
        if i % 50 == 0:
            got = sum(1 for x in rows if x.get("dob"))
            print(f"    infobox {i}/{len(need)}, with-dob total {got}")
