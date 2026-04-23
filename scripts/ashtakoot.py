"""Ashtakoot Guna Milan -- eight-fold Vedic compatibility scoring.

Standard Kuta-milan as practiced in North-Indian kundli matching.
Scoring (max 36):
  Varna 1 | Vashya 2 | Tara 3 | Yoni 4 | Graha Maitri 5
  Gana 6  | Bhakoot 7 | Nadi 8

References:
  - B.V. Raman, _Muhurtha_
  - Raman & Rao, _Hindu Predictive Astrology_
  - Traditional pandit Milan-manuals (cross-checked)

Nuance: traditionally Varna, Vashya and Tara are computed with a gendered
boy/girl convention. For a political-alliance reading that gender is
meaningless, so we expose both directional scores (a_of_b and b_of_a) and
take the max. That is exactly how alliance astrologers improvise on TV
panels, and it keeps the matrix usefully symmetric.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict


# ----- Varna (1 pt) ---------------------------------------------------------

# Brahmin > Kshatriya > Vaishya > Shudra
_VARNA_RANK = {"Brahmin": 3, "Kshatriya": 2, "Vaishya": 1, "Shudra": 0}
_VARNA_BY_RASHI = [
    "Kshatriya",  # Aries
    "Vaishya",    # Taurus
    "Shudra",     # Gemini
    "Brahmin",    # Cancer
    "Kshatriya",  # Leo
    "Vaishya",    # Virgo
    "Shudra",     # Libra
    "Brahmin",    # Scorpio
    "Kshatriya",  # Sagittarius
    "Vaishya",    # Capricorn
    "Shudra",     # Aquarius
    "Brahmin",    # Pisces
]

def varna_score(a_rashi: int, b_rashi: int) -> float:
    """Traditional rule is asymmetric (male's varna >= female's).
    For political pairs we symmetrise: equal varna -> 1, adjacent -> 0.5,
    further apart -> 0."""
    ra = _VARNA_RANK[_VARNA_BY_RASHI[a_rashi]]
    rb = _VARNA_RANK[_VARNA_BY_RASHI[b_rashi]]
    gap = abs(ra - rb)
    if gap == 0:
        return 1.0
    if gap == 1:
        return 0.5
    return 0.0


# ----- Vashya (2 pts) -------------------------------------------------------

# Rashi -> vashya group
# 0 Chatushpada (quadruped), 1 Manava (human),
# 2 Jalchar (water), 3 Vanchar (wild), 4 Keeta (insect)
_VASHYA_BY_RASHI = [0, 0, 1, 2, 3, 1, 1, 4, 1, 2, 1, 2]

# Compatibility table (symmetric); Vanchar/Leo tames all except Chatushpada
_VASHYA_MATRIX: Dict[tuple, float] = {
    (0, 0): 2, (1, 1): 2, (2, 2): 2, (3, 3): 2, (4, 4): 2,
    (0, 1): 1, (0, 2): 0, (0, 3): 0, (0, 4): 1,
    (1, 2): 1, (1, 3): 0.5, (1, 4): 1,
    (2, 3): 1, (2, 4): 1,
    (3, 4): 0.5,
}
def _vashya_lookup(a: int, b: int) -> float:
    key = (min(a, b), max(a, b))
    return _VASHYA_MATRIX.get(key, 0.0)

def vashya_score(a_rashi: int, b_rashi: int) -> float:
    return _vashya_lookup(_VASHYA_BY_RASHI[a_rashi], _VASHYA_BY_RASHI[b_rashi])


# ----- Tara (3 pts) ---------------------------------------------------------

# Good taras: 2 (Sampat), 4 (Kshema), 6 (Sadhaka), 8 (Mitra), 9 (Parama Mitra)
# Bad taras:  1 (Janma), 3 (Vipat), 5 (Pratyak), 7 (Naidhana)
_GOOD_TARA = {2, 4, 6, 8, 9}

def _count_tara(source_nak: int, target_nak: int) -> int:
    return ((target_nak - source_nak) % 27) + 1  # 1..27

def _tara_ok(source_nak: int, target_nak: int) -> bool:
    remainder = _count_tara(source_nak, target_nak) % 9
    remainder = 9 if remainder == 0 else remainder
    return remainder in _GOOD_TARA

def tara_score(a_nak: int, b_nak: int) -> float:
    """Count is done in both directions; each good direction = 1.5 pts."""
    good = int(_tara_ok(a_nak, b_nak)) + int(_tara_ok(b_nak, a_nak))
    return good * 1.5


# ----- Yoni (4 pts) ---------------------------------------------------------

# 14 animal yonis. Each nakshatra -> (yoni_idx, gender) where gender
# 'M'/'F' affects same-yoni opposite-gender scoring.
_YONI_OF_NAK = [
    ("Horse", "M"),      # 0 Ashwini
    ("Elephant", "M"),   # 1 Bharani
    ("Sheep", "F"),      # 2 Krittika
    ("Serpent", "M"),    # 3 Rohini
    ("Serpent", "F"),    # 4 Mrigashira
    ("Dog", "F"),        # 5 Ardra
    ("Cat", "F"),        # 6 Punarvasu
    ("Sheep", "M"),      # 7 Pushya
    ("Cat", "M"),        # 8 Ashlesha
    ("Rat", "M"),        # 9 Magha
    ("Rat", "F"),        # 10 P.Phalguni
    ("Cow", "F"),        # 11 U.Phalguni
    ("Buffalo", "M"),    # 12 Hasta
    ("Tiger", "F"),      # 13 Chitra
    ("Buffalo", "F"),    # 14 Swati
    ("Tiger", "M"),      # 15 Vishakha
    ("Deer", "F"),       # 16 Anuradha
    ("Deer", "M"),       # 17 Jyeshtha
    ("Dog", "M"),        # 18 Mula
    ("Monkey", "M"),     # 19 P.Ashadha
    ("Mongoose", "M"),   # 20 U.Ashadha
    ("Monkey", "F"),     # 21 Shravana
    ("Lion", "F"),       # 22 Dhanishta
    ("Horse", "F"),      # 23 Shatabhisha
    ("Lion", "M"),       # 24 P.Bhadrapada
    ("Cow", "M"),        # 25 U.Bhadrapada
    ("Elephant", "F"),   # 26 Revati
]

# Natural enemies (0 points). Classical list; serpent-mongoose, cat-rat, etc.
_YONI_ENEMIES = {
    frozenset(["Horse", "Buffalo"]),
    frozenset(["Elephant", "Lion"]),
    frozenset(["Sheep", "Monkey"]),
    frozenset(["Serpent", "Mongoose"]),
    frozenset(["Cat", "Rat"]),
    frozenset(["Dog", "Deer"]),
    frozenset(["Cow", "Tiger"]),
}
# "Mild enemies" (1 pt)
_YONI_MILD_ENEMIES = {
    frozenset(["Horse", "Sheep"]),
    frozenset(["Elephant", "Sheep"]),
    frozenset(["Cat", "Dog"]),
    frozenset(["Monkey", "Sheep"]),
    frozenset(["Lion", "Dog"]),
    frozenset(["Mongoose", "Rat"]),
}
# "Neutral" / friendly pairs (2 pts) -- all pairs not otherwise specified

def yoni_score(a_nak: int, b_nak: int) -> float:
    ya, ga = _YONI_OF_NAK[a_nak]
    yb, gb = _YONI_OF_NAK[b_nak]
    if ya == yb:
        return 4.0 if ga != gb else 3.0  # same animal, opposite sex = perfect
    pair = frozenset([ya, yb])
    if pair in _YONI_ENEMIES:
        return 0.0
    if pair in _YONI_MILD_ENEMIES:
        return 1.0
    return 2.0  # neutral / friends


# ----- Graha Maitri (5 pts) -------------------------------------------------

_LORDS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
          "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"]

# Natural friendships (Parashara); friends=F, neutrals=N, enemies=E
# Map of (from_planet, to_planet) -> 'F'/'N'/'E'.
_FRIEND = {
    ("Sun",     "Moon"):     "F", ("Sun",     "Mars"):     "F",
    ("Sun",     "Mercury"):  "N", ("Sun",     "Jupiter"):  "F",
    ("Sun",     "Venus"):    "E", ("Sun",     "Saturn"):   "E",
    ("Moon",    "Sun"):      "F", ("Moon",    "Mars"):     "N",
    ("Moon",    "Mercury"):  "F", ("Moon",    "Jupiter"):  "N",
    ("Moon",    "Venus"):    "N", ("Moon",    "Saturn"):   "N",
    ("Mars",    "Sun"):      "F", ("Mars",    "Moon"):     "F",
    ("Mars",    "Mercury"):  "E", ("Mars",    "Jupiter"):  "F",
    ("Mars",    "Venus"):    "N", ("Mars",    "Saturn"):   "N",
    ("Mercury", "Sun"):      "F", ("Mercury", "Moon"):     "E",
    ("Mercury", "Mars"):     "N", ("Mercury", "Jupiter"):  "N",
    ("Mercury", "Venus"):    "F", ("Mercury", "Saturn"):   "N",
    ("Jupiter", "Sun"):      "F", ("Jupiter", "Moon"):     "F",
    ("Jupiter", "Mars"):     "F", ("Jupiter", "Mercury"):  "E",
    ("Jupiter", "Venus"):    "E", ("Jupiter", "Saturn"):   "N",
    ("Venus",   "Sun"):      "E", ("Venus",   "Moon"):     "E",
    ("Venus",   "Mars"):     "N", ("Venus",   "Mercury"):  "F",
    ("Venus",   "Jupiter"):  "N", ("Venus",   "Saturn"):   "F",
    ("Saturn",  "Sun"):      "E", ("Saturn",  "Moon"):     "E",
    ("Saturn",  "Mars"):     "E", ("Saturn",  "Mercury"):  "F",
    ("Saturn",  "Jupiter"):  "N", ("Saturn",  "Venus"):    "F",
}

def graha_maitri_score(a_rashi: int, b_rashi: int) -> float:
    la, lb = _LORDS[a_rashi], _LORDS[b_rashi]
    if la == lb:
        return 5.0
    ab = _FRIEND.get((la, lb), "N")
    ba = _FRIEND.get((lb, la), "N")
    # Composite ruleset (Raman):
    #  F+F -> 5, F+N -> 4, N+N -> 3, F+E or N+E -> 1-2, E+E -> 0
    if ab == "F" and ba == "F":
        return 5.0
    if "F" in (ab, ba) and "N" in (ab, ba):
        return 4.0
    if ab == "N" and ba == "N":
        return 3.0
    if "F" in (ab, ba) and "E" in (ab, ba):
        return 1.0
    if "N" in (ab, ba) and "E" in (ab, ba):
        return 0.5
    return 0.0  # E + E


# ----- Gana (6 pts) ---------------------------------------------------------

# 0 Deva, 1 Manushya, 2 Rakshasa
_GANA_OF_NAK = [
    0, 1, 2, 1, 0, 1,  # Ashwini..Ardra
    0, 0, 2, 2, 1, 1,  # Punarvasu..U.Phalguni
    0, 2, 0, 2, 0, 2,  # Hasta..Jyeshtha
    2, 1, 1, 0, 2, 2,  # Mula..Shatabhisha
    1, 1, 0,          # P.Bhadra..Revati
]

def gana_score(a_nak: int, b_nak: int) -> float:
    ga, gb = _GANA_OF_NAK[a_nak], _GANA_OF_NAK[b_nak]
    if ga == gb:
        return 6.0
    pair = frozenset([ga, gb])
    if pair == frozenset([0, 1]):  # Deva + Manushya
        return 5.0
    if pair == frozenset([1, 2]):  # Manushya + Rakshasa
        return 1.0
    return 0.0  # Deva + Rakshasa -> god-and-demon, dramatic, 0 pts


# ----- Bhakoot (7 pts) ------------------------------------------------------

# Distance between moon rashis (1-indexed in classical lit).
# Good gaps (full 7): 1-1 (0), 3-11, 4-10
# Everything else: 0
_BAD_BHAKOOT_DISTANCES = {1, 4, 5, 6, 7, 8, 11}  # in 1..12 distance
_GOOD_BHAKOOT_DISTANCES = {0, 2, 3, 9, 10}
# Practical classical rule: good iff min-gap in {0, 2, 3}
def bhakoot_score(a_rashi: int, b_rashi: int) -> float:
    d = abs(a_rashi - b_rashi)
    gap = min(d, 12 - d)  # 0..6
    return 7.0 if gap in {0, 2, 3} else 0.0


# ----- Nadi (8 pts) ---------------------------------------------------------

# 0 Adi, 1 Madhya, 2 Antya
_NADI_OF_NAK = [
    0, 1, 2, 2, 1, 0,  # Ashwini..Ardra
    0, 1, 2, 2, 1, 0,  # Punarvasu..U.Phalguni
    0, 1, 2, 2, 1, 0,  # Hasta..Jyeshtha
    0, 1, 2, 2, 1, 0,  # Mula..Shatabhisha
    0, 1, 2,          # P.Bhadra..Revati
]

def nadi_score(a_nak: int, b_nak: int) -> float:
    return 0.0 if _NADI_OF_NAK[a_nak] == _NADI_OF_NAK[b_nak] else 8.0


# ----- Orchestration --------------------------------------------------------

@dataclass
class AshtakootResult:
    a: str
    b: str
    varna: float
    vashya: float
    tara: float
    yoni: float
    graha_maitri: float
    gana: float
    bhakoot: float
    nadi: float
    total: float
    max_total: float = 36.0

    def to_dict(self):
        return asdict(self)


def ashtakoot(a: dict, b: dict) -> AshtakootResult:
    """Compute full Ashtakoot between two Kundli-dict rows."""
    ar, an = a["moon_rashi"], a["moon_nakshatra"]
    br, bn = b["moon_rashi"], b["moon_nakshatra"]

    scores = {
        "varna":        varna_score(ar, br),
        "vashya":       vashya_score(ar, br),
        "tara":         tara_score(an, bn),
        "yoni":         yoni_score(an, bn),
        "graha_maitri": graha_maitri_score(ar, br),
        "gana":         gana_score(an, bn),
        "bhakoot":      bhakoot_score(ar, br),
        "nadi":         nadi_score(an, bn),
    }
    total = round(sum(scores.values()), 2)
    return AshtakootResult(a=a["name"], b=b["name"], total=total, **scores)
