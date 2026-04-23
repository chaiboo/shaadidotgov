"""Compute Kundlis for every 18th-Lok-Sabha MP with a known DOB.

Writes:
  data/parliament.json   -- per-MP kundli rows (includes featured 40 + rest)

Pair scores are NOT precomputed here: 543^2 / 2 ~ 150,000 matches with
full koot breakdowns would be ~25 MB of JSON, which is too much to load
on GH Pages. Instead we port the Ashtakoot scoring to JS (js/ashtakoot.js)
and compute pairs on demand in the browser.

Birth times for MPs are almost never public, so we default to 12:00 IST
across the board. The Moon travels ~13 deg / day, i.e. roughly one
nakshatra per day, so a noon chart puts the Moon in the right nakshatra
unless it crossed a boundary that day -- which we flag separately.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .kundli import compute_kundli

ROOT = Path(__file__).resolve().parent.parent
ROSTER = ROOT / "data" / "parliament_roster.json"
OUT = ROOT / "data" / "parliament.json"

FACTION_MAP = {
    # Faction classification used for colouring. Keys are substrings that can
    # appear in the party field.
    "Bharatiya Janata Party": "NDA",
    "BJP": "NDA",
    "Janata Dal (United)": "NDA",
    "Telugu Desam": "NDA",
    "Shiv Sena": "NDA",            # Eknath Shinde faction in LS18
    "Nationalist Congress Party": "NDA",  # Ajit Pawar faction in LS18
    "Lok Janshakti": "NDA",
    "Apna Dal": "NDA",
    "AGP": "NDA",
    "United People's Party Liberal": "NDA",
    "Rashtriya Lok Dal": "NDA",
    "Jana Sena": "NDA",
    "HAM": "NDA",
    "Indian National Congress": "INDIA",
    "INC": "INDIA",
    "Dravida Munnetra Kazhagam": "INDIA",
    "DMK": "INDIA",
    "Samajwadi Party": "INDIA",
    "All India Trinamool Congress": "INDIA",
    "TMC": "INDIA",
    "Communist Party of India": "INDIA",
    "CPI": "INDIA",
    "Indian Union Muslim League": "INDIA",
    "Jharkhand Mukti Morcha": "INDIA",
    "Aam Aadmi Party": "INDIA",
    "Rashtriya Janata Dal": "INDIA",
    "Viduthalai Chiruthaigal": "INDIA",
    "Kerala Congress": "INDIA",
    "Revolutionary Socialist Party": "INDIA",
    "Marumalarchi Dravida": "INDIA",
    "NC": "INDIA",
    "Jammu & Kashmir National Conference": "INDIA",
    "Jammu and Kashmir National Conference": "INDIA",
    "National Conference": "INDIA",
    "Nationalist Congress Party (Sharadchandra Pawar)": "INDIA",
    "NCP(SP)": "INDIA",
    "Shiv Sena (UBT)": "INDIA",
    "Shiv Sena (Uddhav Balasaheb Thackeray)": "INDIA",
    "UBT": "INDIA",
    "Bharat Adivasi Party": "INDIA",
    "Jharkhand Mukti Morcha": "INDIA",
    "Zoram People's Movement": "INDIA",
}


def classify_faction(party: str, alliance_hint: str = "") -> str:
    blob = (alliance_hint + " " + party).lower()
    if "nda" in blob or "national democratic alliance" in blob:
        return "NDA"
    if "india" in blob and "national" not in blob.replace("india", "x", 1):
        # crude but effective -- "INDIA" the alliance vs "National..."
        return "INDIA"
    for key, faction in FACTION_MAP.items():
        if key.lower() in party.lower():
            return faction
    return "Other"


def main():
    roster = json.loads(ROSTER.read_text())
    # Sort by (state, constituency) for stable ordering.
    roster.sort(key=lambda r: (r.get("state") or "", r.get("constituency") or ""))

    mps = []
    for r in roster:
        dob = r.get("dob")
        if not dob:
            continue
        try:
            d = datetime.fromisoformat(dob)
        except (ValueError, TypeError):
            continue
        k = compute_kundli(
            name=r["name"],
            year=d.year, month=d.month, day=d.day,
            hour=12, minute=0,
            tz_offset=5.5,
            notes="noon default; DOB from " + r.get("dob_source", "Wikidata"),
        )
        row = k.to_dict()
        row.update({
            "state":        r.get("state", ""),
            "constituency": r.get("constituency", ""),
            "party":        r.get("party", ""),
            "alliance":     r.get("alliance", ""),
            "faction":      classify_faction(r.get("party", ""), r.get("alliance", "")),
            "wiki_title":   r.get("wiki_title", ""),
            "wikidata":     r.get("wikidata", ""),
            "gender":       r.get("gender", ""),
            "dob":          r["dob"],
            "role":         "MP, 18th Lok Sabha",
        })
        mps.append(row)

    # Mark featured 40 so the UI can show them on top / highlight
    featured = set(json.loads((ROOT/"data"/"kundlis.json").read_text()).keys()) if False else set()
    # easier: pick featured by name from the curated yaml
    import yaml
    featured_names = set()
    for rec in yaml.safe_load((ROOT/"data"/"politicians.yaml").read_text()):
        featured_names.add(rec["name"])
    for m in mps:
        m["featured"] = m["name"] in featured_names

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "count": len(mps),
        "mps": mps,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"wrote {OUT.relative_to(ROOT)} ({len(mps)} MPs)")

    from collections import Counter
    fc = Counter(m["faction"] for m in mps)
    print(f"  factions: {dict(fc)}")
    rc = Counter(m["moon_rashi_name"] for m in mps).most_common()
    print(f"  moon signs: {rc}")
    featured_count = sum(1 for m in mps if m["featured"])
    print(f"  featured overlap: {featured_count}/{len(featured_names)}")


if __name__ == "__main__":
    main()
