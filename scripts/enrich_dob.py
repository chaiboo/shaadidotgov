"""Fill in missing DOBs by fetching each MP's Wikipedia article.

Wikipedia infoboxes include a hCard <span class="bday">YYYY-MM-DD</span>
microformat span for birth dates. Fast to extract and unambiguous.
"""

from __future__ import annotations

import json
import re
import time
import urllib.parse
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent.parent
ROSTER = ROOT / "data" / "parliament_roster.json"
CACHE = ROOT / "data" / "_raw" / "mp_pages"
UA = "parliament-kundli/0.1 (research; rb12295@gmail.com)"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


BDAY_RE    = re.compile(r'class="bday"[^>]*>(\d{4}-\d{2}-\d{2})</span>')
DEAD_RE    = re.compile(r'class="dday deathdate"', re.I)
INFOBOX_RE = re.compile(r'<table[^>]*class="[^"]*infobox[^"]*"', re.I)


def extract_dob(html: str) -> str | None:
    # Look for a bday inside an infobox preferentially, but plain bday works.
    m = BDAY_RE.search(html)
    if m:
        return m.group(1)
    # Fallback: "(born 17 September 1950)" in lead
    m = re.search(
        r'born[^<]{0,40}?(\d{1,2})\s+(January|February|March|April|May|June|'
        r'July|August|September|October|November|December)\s+(\d{4})',
        html, re.I)
    if m:
        day, mon, year = m.group(1), m.group(2), m.group(3)
        months = {'January':1,'February':2,'March':3,'April':4,'May':5,'June':6,
                  'July':7,'August':8,'September':9,'October':10,'November':11,'December':12}
        return f"{year}-{months[mon.capitalize()]:02d}-{int(day):02d}"
    return None


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    roster = json.loads(ROSTER.read_text())

    need = [r for r in roster if r.get("wiki_title") and "dob" not in r]
    print(f"need DOB for {len(need)} MPs (have {len(roster) - len(need)} already)")

    added = 0
    failed = 0
    skipped = 0
    for i, r in enumerate(need, 1):
        title = r["wiki_title"]
        safe = re.sub(r'[^\w\-_.]', '_', title)[:100]
        cache_path = CACHE / f"{safe}.html"

        html = None
        if cache_path.exists() and cache_path.stat().st_size > 500:
            html = cache_path.read_text(errors="replace")
        else:
            url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}"
            try:
                html = fetch(url)
                cache_path.write_text(html)
                time.sleep(0.15)
            except HTTPError as e:
                if e.code == 404:
                    skipped += 1
                else:
                    failed += 1
                continue
            except URLError:
                failed += 1
                continue

        dob = extract_dob(html or "")
        if dob:
            r["dob"] = dob
            r["dob_source"] = "wiki-infobox"
            added += 1

        if i % 25 == 0:
            print(f"  {i}/{len(need)}  added={added} failed={failed} 404={skipped}")

    print(f"\nfinal: +{added} DOBs (failed={failed}, 404={skipped})")
    print(f"total with DOB now: {sum(1 for r in roster if 'dob' in r)}")

    ROSTER.write_text(json.dumps(roster, indent=2, ensure_ascii=False))
    print(f"updated {ROSTER.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
