"""Turn a scraped roster into a country kundli file.

Usage: python3 -m scripts.build_country IN|US|UK
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

from .kundli import compute_kundli

ROOT = Path(__file__).resolve().parent.parent


COUNTRY_CONFIG = {
    "IN": {
        "roster":   ROOT / "data" / "parliament_roster.json",
        "out":      ROOT / "data" / "country_IN.json",
        "label":    "18th Lok Sabha",
        "tz":       5.5,
        "blocs":    {
            # party substring -> bloc
            "Bharatiya Janata Party": "NDA",
            "Janata Dal (United)":    "NDA",
            "Telugu Desam":           "NDA",
            "Shiv Sena":              "NDA",     # Shinde faction
            "Nationalist Congress Party": "NDA", # Ajit Pawar
            "Lok Janshakti":          "NDA",
            "Apna Dal":               "NDA",
            "Asom Gana":              "NDA",
            "HAM":                    "NDA",
            "Rashtriya Lok Dal":      "NDA",
            "Jana Sena":              "NDA",
            "Indian National Congress": "INDIA",
            "Dravida Munnetra Kazhagam": "INDIA",
            "Samajwadi Party":        "INDIA",
            "Trinamool Congress":     "INDIA",
            "All India Trinamool":    "INDIA",
            "Communist Party of India": "INDIA",
            "Indian Union Muslim League": "INDIA",
            "Jharkhand Mukti Morcha": "INDIA",
            "Aam Aadmi Party":        "INDIA",
            "Rashtriya Janata Dal":   "INDIA",
            "Viduthalai Chiruthaigal": "INDIA",
            "Kerala Congress":        "INDIA",
            "Revolutionary Socialist Party": "INDIA",
            "Marumalarchi Dravida":   "INDIA",
            "National Conference":    "INDIA",
            "Jammu & Kashmir National Conference": "INDIA",
            "Jammu and Kashmir National Conference": "INDIA",
            "Nationalist Congress Party (Sharadchandra Pawar)": "INDIA",
            "Shiv Sena (Uddhav Balasaheb Thackeray)": "INDIA",
            "Bharat Adivasi Party":   "INDIA",
            "Zoram People's Movement": "INDIA",
        },
    },
    "US": {
        "roster":   ROOT / "data" / "us_roster.json",
        "out":      ROOT / "data" / "country_US.json",
        "label":    "119th US Congress",
        "tz":       -5.0,   # Eastern -- legislators are scattered but this is a default
        "blocs":    {
            "Republican":  "Republican",
            "Democratic":  "Democratic",
            "Independent": "Independent",
        },
    },
    "UK": {
        "roster":   ROOT / "data" / "uk_roster.json",
        "out":      ROOT / "data" / "country_UK.json",
        "label":    "UK House of Commons (2024)",
        "tz":       0.0,
        "blocs":    {
            "Labour": "Labour",
            "Labour Co-op": "Labour",
            "Conservative": "Conservative",
            "Liberal Democrats": "Lib Dem",
            "Scottish National Party": "SNP",
            "Reform UK": "Reform",
            "Sinn Féin": "Sinn Féin",
            "Democratic Unionist": "DUP",
            "Social Democratic and Labour Party": "SDLP",
            "Alliance Party": "Alliance",
            "Plaid Cymru": "Plaid",
            "Green Party": "Green",
            "Ulster Unionist": "UUP",
            "Independent": "Independent",
        },
    },
}


def classify_bloc(party: str, bloc_map: dict) -> str:
    p = party.strip()
    for key, bloc in bloc_map.items():
        if key.lower() in p.lower():
            return bloc
    return "Other"


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COUNTRY_CONFIG:
        print("Usage: python3 -m scripts.build_country IN|US|UK")
        sys.exit(1)

    code = sys.argv[1]
    cfg  = COUNTRY_CONFIG[code]

    roster = json.loads(cfg["roster"].read_text())
    roster.sort(key=lambda r: (r.get("state", "") or "", r.get("constituency", "") or ""))

    people = []
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
            tz_offset=float(cfg["tz"]),
            notes=f"{cfg['label']} · noon default · DOB from {r.get('dob_source', 'wikidata')}",
        )
        row = k.to_dict()
        row.update({
            "country":      code,
            "chamber":      r.get("chamber", ""),
            "state":        r.get("state", ""),
            "constituency": r.get("constituency", ""),
            "party":        r.get("party", ""),
            "bloc":         classify_bloc(r.get("party", ""), cfg["blocs"]),
            "wiki_title":   r.get("wiki_title", ""),
            "wikidata":     r.get("wikidata", ""),
            "gender":       r.get("gender", ""),
            "dob":          dob,
            "role":         cfg["label"],
        })
        people.append(row)

    payload = {
        "country":      code,
        "label":        cfg["label"],
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total":        len(roster),
        "with_dob":     len(people),
        "people":       people,
    }
    cfg["out"].write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"wrote {cfg['out'].relative_to(ROOT)}  ({len(people)}/{len(roster)} with DOB)")

    from collections import Counter
    print(f"  blocs: {dict(Counter(p['bloc'] for p in people))}")
    signs = Counter(p["moon_rashi_name"] for p in people).most_common()
    print(f"  moon signs (top): {signs[:5]}")


if __name__ == "__main__":
    main()
