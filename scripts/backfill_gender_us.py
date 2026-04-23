#!/usr/bin/env python3
from __future__ import annotations
"""Backfill US gender (and any missing DOB) from Wikidata.

The US scrape never resolved Wikipedia pages for most entries, so only
99/531 had wikidata/gender. This script tries, for each US person without
a gender:

  1. Direct title guess: "Firstname_Lastname"
  2. Disambiguated guess: "Firstname_Lastname_(politician)"
  3. Wikipedia search: first hit for `"{name}" congress`

Any of those three can resolve to a Wikidata entity; we then pull P21 and
P569 from the entity's claims and write them back to country_US.json.
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from scrape_lib import fetch, wikidata_batch_by_title, extract_dob_gender  # noqa: E402


DATA_PATH = ROOT / "data" / "country_US.json"


def wiki_search_first(name: str) -> str | None:
    """Return the first Wikipedia page title matching `"{name}" congress`."""
    q = {
        "action": "query",
        "list": "search",
        "srsearch": f'"{name}" congress',
        "srlimit": 1,
        "format": "json",
    }
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(q)
    try:
        data = json.loads(fetch(url))
    except Exception as e:
        print(f"    search error: {e}")
        return None
    hits = data.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def main():
    with open(DATA_PATH) as f:
        d = json.load(f)

    people = d["people"]
    need = [p for p in people if not p.get("gender")]
    print(f"US: {len(people)} total, {len(need)} missing gender")

    # Phase 1: build title guesses for everyone who has no wiki_title
    # (or has one but still no gender).
    for p in need:
        if p.get("wiki_title"):
            continue
        p["_guess_title"] = p["name"].replace(" ", "_")

    # Phase 2: batch-resolve the guesses via wbgetentities (50 at a time).
    def try_batch(titles: list[str]) -> dict:
        out = {}
        for i in range(0, len(titles), 45):
            chunk = titles[i:i + 45]
            try:
                ents = wikidata_batch_by_title(chunk)
                out.update(ents)
            except Exception as e:
                print(f"  batch {i} failed: {e}")
            time.sleep(0.3)
        return out

    # Round 1: direct name guess
    round1 = [p["_guess_title"] for p in need if p.get("_guess_title")]
    print(f"  round 1 (direct name): {len(round1)} titles")
    ents = try_batch(round1)
    print(f"  round 1: resolved {len(ents)} entities")

    for p in need:
        t = p.get("_guess_title")
        if not t:
            continue
        # wbgetentities returns keys with spaces, not underscores
        key = t.replace("_", " ")
        ent = ents.get(key)
        if ent:
            dob, gender = extract_dob_gender(ent)
            if gender:
                p["gender"] = gender
            if dob and not p.get("dob"):
                p["dob"] = dob
            p["wikidata"] = ent.get("id")
            p["wiki_title"] = key
            p.pop("_guess_title", None)

    # Round 2: "(politician)" disambiguation for those still missing
    still = [p for p in need if not p.get("gender")]
    for p in still:
        p["_guess_title"] = p["name"].replace(" ", "_") + "_(politician)"
    round2 = [p["_guess_title"] for p in still if p.get("_guess_title")]
    print(f"  round 2 (+politician): {len(round2)} titles")
    ents = try_batch(round2)
    print(f"  round 2: resolved {len(ents)} entities")
    for p in still:
        t = p.get("_guess_title")
        if not t:
            continue
        key = t.replace("_", " ")
        ent = ents.get(key)
        if ent:
            dob, gender = extract_dob_gender(ent)
            if gender:
                p["gender"] = gender
            if dob and not p.get("dob"):
                p["dob"] = dob
            p["wikidata"] = ent.get("id")
            p["wiki_title"] = key
            p.pop("_guess_title", None)

    # Round 3: Wikipedia search for the remaining holdouts.
    holdouts = [p for p in need if not p.get("gender")]
    print(f"  round 3 (search): {len(holdouts)} holdouts")
    search_results = {}
    for idx, p in enumerate(holdouts):
        t = wiki_search_first(p["name"])
        if t:
            search_results[p["name"]] = t
            p["_search_title"] = t
        if (idx + 1) % 20 == 0:
            print(f"    searched {idx + 1}/{len(holdouts)}")
        time.sleep(0.15)

    round3_titles = list(set(search_results.values()))
    print(f"  round 3: got {len(round3_titles)} unique titles, batching")
    ents = try_batch(round3_titles)
    print(f"  round 3: resolved {len(ents)} entities")

    for p in holdouts:
        key = p.get("_search_title")
        if not key:
            continue
        ent = ents.get(key)
        if ent:
            dob, gender = extract_dob_gender(ent)
            if gender:
                p["gender"] = gender
            if dob and not p.get("dob"):
                p["dob"] = dob
            p["wikidata"] = ent.get("id")
            p["wiki_title"] = key
        p.pop("_search_title", None)

    # Strip any leftover guess fields just in case
    for p in people:
        p.pop("_guess_title", None)

    # Report
    with_gender = sum(1 for p in people if p.get("gender"))
    print(f"\nfinal: {with_gender}/{len(people)} with gender "
          f"({with_gender / len(people) * 100:.1f}%)")
    from collections import Counter
    g = Counter(p.get("gender") for p in people)
    print("breakdown:", dict(g))

    with open(DATA_PATH, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(f"wrote {DATA_PATH}")


if __name__ == "__main__":
    main()
