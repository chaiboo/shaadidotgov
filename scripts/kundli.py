"""Birth-chart skeleton (enough for Ashtakoot matching).

Given a date/time (with local UTC offset), returns the Moon's sidereal
longitude and derived rashi / nakshatra / pada. Also includes the Sun's
sidereal position for color and a navamsa rashi (D9) since some matchers
cross-check Navamsa Moon.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone

from .moon import (
    julian_day,
    moon_sidereal_longitude,
    sun_sidereal_longitude,
)


RASHIS = [
    "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
    "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena",
]
RASHIS_EN = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]
NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

NAKSHATRA_DEG = 360.0 / 27.0       # 13 deg 20'
PADA_DEG = NAKSHATRA_DEG / 4.0     # 3 deg 20'


@dataclass
class Kundli:
    name: str
    birth_local: str       # ISO local
    birth_utc: str         # ISO UTC
    tz_offset: float       # hours east of UTC
    moon_lon: float
    moon_rashi: int        # 0..11
    moon_rashi_name: str
    moon_nakshatra: int    # 0..26
    moon_nakshatra_name: str
    moon_pada: int         # 1..4
    moon_navamsa_rashi: int
    sun_lon: float
    sun_rashi: int
    sun_rashi_name: str
    notes: str = ""

    def to_dict(self):
        return asdict(self)


def _navamsa_rashi(sidereal_lon: float) -> int:
    """Navamsa (D9) rashi index.

    Each rashi is divided into 9 parts of 3°20'. The navamsa sequence
    starts from different signs depending on the element of the natal rashi:
      Fire (Ar, Le, Sg) -> starts Ar
      Earth (Ta, Vi, Cp) -> starts Cp
      Air (Ge, Li, Aq) -> starts Li
      Water (Ca, Sc, Pi) -> starts Ca
    """
    rashi_idx = int(sidereal_lon // 30)
    deg_in_rashi = sidereal_lon - rashi_idx * 30
    nav_idx_within = int(deg_in_rashi // (30.0 / 9.0))  # 0..8
    element = rashi_idx % 4  # 0=fire,1=earth,2=air,3=water
    start = {0: 0, 1: 9, 2: 6, 3: 3}[element]
    return (start + nav_idx_within) % 12


def compute_kundli(
    name: str,
    year: int, month: int, day: int,
    hour: int = 12, minute: int = 0,
    tz_offset: float = 5.5,  # IST default
    notes: str = "",
) -> Kundli:
    """Compute Kundli from local birth data."""
    local_dt = datetime(year, month, day, hour, minute,
                        tzinfo=timezone(timedelta(hours=tz_offset)))
    utc_dt = local_dt.astimezone(timezone.utc)
    jd = julian_day(utc_dt.year, utc_dt.month, utc_dt.day,
                    utc_dt.hour + utc_dt.minute/60.0 + utc_dt.second/3600.0)

    moon_lon = moon_sidereal_longitude(jd)
    moon_rashi = int(moon_lon // 30)
    moon_nak = int(moon_lon // NAKSHATRA_DEG)
    moon_pada = int((moon_lon % NAKSHATRA_DEG) // PADA_DEG) + 1

    sun_lon = sun_sidereal_longitude(jd)
    sun_rashi = int(sun_lon // 30)

    return Kundli(
        name=name,
        birth_local=local_dt.isoformat(),
        birth_utc=utc_dt.isoformat(),
        tz_offset=tz_offset,
        moon_lon=round(moon_lon, 4),
        moon_rashi=moon_rashi,
        moon_rashi_name=RASHIS_EN[moon_rashi],
        moon_nakshatra=moon_nak,
        moon_nakshatra_name=NAKSHATRAS[moon_nak],
        moon_pada=moon_pada,
        moon_navamsa_rashi=_navamsa_rashi(moon_lon),
        sun_lon=round(sun_lon, 4),
        sun_rashi=sun_rashi,
        sun_rashi_name=RASHIS_EN[sun_rashi],
        notes=notes,
    )
