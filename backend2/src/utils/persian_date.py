"""Numeric Persian display, matching modern ICU/JavaScript Intl calendar rules.

Arithmetic and leap corrections follow ICU PersianCalendar (Unicode-3.0):
https://github.com/unicode-org/icu/blob/main/icu4c/source/i18n/persncal.cpp
Copyright (C) 2003-2013 IBM and others; (C) 2016-2026 Unicode, Inc. and others.
See docs/licenses/UNICODE.txt. Stored/API dates remain Gregorian.
"""

from datetime import date

_LEAP_CORRECTIONS = frozenset((
    1502, 1601, 1634, 1667, 1700, 1733, 1766, 1799, 1832, 1865, 1898, 1931, 1964, 1997, 2030, 2059,
    2063, 2096, 2129, 2158, 2162, 2191, 2195, 2224, 2228, 2257, 2261, 2290, 2294, 2323, 2327, 2356,
    2360, 2389, 2393, 2422, 2426, 2455, 2459, 2488, 2492, 2521, 2525, 2554, 2558, 2587, 2591, 2620,
    2624, 2653, 2657, 2686, 2690, 2719, 2723, 2748, 2752, 2756, 2781, 2785, 2789, 2818, 2822, 2847,
    2851, 2855, 2880, 2884, 2888, 2913, 2917, 2921, 2946, 2950, 2954, 2979, 2983, 2987,
))
_EPOCH_ORDINAL = 1948320 - 1721425  # ICU Julian day to Python's Gregorian ordinal.


def _year_offset(year):
    return 365 * (year - 1) + (8 * year + 21) // 33 - int(year - 1 in _LEAP_CORRECTIONS)


def format_persian_date(value):
    value = date.fromisoformat(str(value))
    elapsed = value.toordinal() - _EPOCH_ORDINAL
    year = (33 * elapsed + 3) // 12053 + 1
    elapsed -= _year_offset(year)
    if elapsed == 365 and year in _LEAP_CORRECTIONS:
        year += 1
        elapsed = 0
    month, day = divmod(elapsed, 31) if elapsed < 186 else divmod(elapsed - 186, 30)
    month += 1 if elapsed < 186 else 7
    return f"{year:04d}/{month:02d}/{day + 1:02d}".translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
