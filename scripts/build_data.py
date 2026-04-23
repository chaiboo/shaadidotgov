"""Build script: YAML source -> Kundlis -> Ashtakoot scores -> data/*.json.

Run from project root:
    python3 -m scripts.build_data
"""

from __future__ import annotations

import json
from datetime import datetime
from itertools import combinations
from pathlib import Path

import yaml

from .ashtakoot import ashtakoot
from .kundli import compute_kundli

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "politicians.yaml"
OUT = ROOT / "data" / "kundlis.json"


def parse_time_str(t: str) -> tuple[int, int]:
    h, m = t.split(":")
    return int(h), int(m)


def main() -> None:
    people = yaml.safe_load(SRC.read_text())
    print(f"loaded {len(people)} politicians from {SRC.name}")

    kundlis = []
    for p in people:
        d = datetime.fromisoformat(str(p["date"]))
        hour, minute = parse_time_str(p.get("time", "12:00"))
        k = compute_kundli(
            name=p["name"],
            year=d.year, month=d.month, day=d.day,
            hour=hour, minute=minute,
            tz_offset=float(p.get("tz_offset", 5.5)),
            notes=p.get("notes", ""),
        )
        # merge in the roster metadata so the frontend can colour by faction
        row = k.to_dict()
        for key in ("role", "party", "faction", "place",
                    "time_confidence", "tz_offset"):
            if key in p:
                row[key] = p[key]
        row["date"] = str(p["date"])
        row["time"] = p.get("time", "12:00")
        kundlis.append(row)

    # Pairwise Ashtakoot matches
    matches = []
    for a, b in combinations(kundlis, 2):
        r = ashtakoot(a, b).to_dict()
        matches.append(r)

    # Also produce a dense matrix for the heatmap
    idx = {k["name"]: i for i, k in enumerate(kundlis)}
    n = len(kundlis)
    matrix = [[None] * n for _ in range(n)]
    for m in matches:
        i, j = idx[m["a"]], idx[m["b"]]
        matrix[i][j] = m["total"]
        matrix[j][i] = m["total"]
    for i in range(n):
        matrix[i][i] = 36.0  # self-pair trivially perfect

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "count": n,
        "people": kundlis,
        "matrix": matrix,
        "matches": matches,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"wrote {OUT.relative_to(ROOT)} with {n} people, "
          f"{len(matches)} pairwise matches")

    # Quick leaderboard sanity
    sorted_matches = sorted(matches, key=lambda m: m["total"], reverse=True)
    print("\ntop 5 cosmic alliances:")
    for m in sorted_matches[:5]:
        print(f"  {m['total']:>5.1f}  {m['a']}  <->  {m['b']}")
    print("\nbottom 5 (cosmically cursed):")
    for m in sorted_matches[-5:]:
        print(f"  {m['total']:>5.1f}  {m['a']}  <->  {m['b']}")


if __name__ == "__main__":
    main()
