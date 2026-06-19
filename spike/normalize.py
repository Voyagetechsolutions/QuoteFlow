"""
Freight normalization — the freight-specific moat.

Extraction gets characters off the page (mostly solved). Normalization maps
heterogeneous freight terminology onto ONE canonical schema — and that
dictionary, not the extraction code, is the durable asset.

Runs as a deterministic post-pass after ANY extractor (table or vision), so the
exactness lives here rather than in a fuzzy model: currency and basis especially
must never be silently guessed (a wrong basis → a wrong quote).

Enriches each RateRow with:
  - charge_code   canonical code (THC, BAF, FREIGHT, ...) from the raw label
  - charge_label  the raw label as it appeared (preserved for the review UI)
  - basis         canonical basis enum (per_container_20, per_cbm, ...)
  - confidence    0..1, lowered for missing/ambiguous money-critical fields
and flags rate / currency / basis MORE aggressively than lane text.
"""
from __future__ import annotations

import re
from typing import Optional

# --- canonical charge codes -------------------------------------------------
# code -> (alias substrings, default basis when the sheet omits a unit)
CHARGE_CODES: dict[str, tuple[list[str], Optional[str]]] = {
    "FREIGHT": (["ocean freight", "sea freight", "basic freight", "freight",
                 "air freight", "road freight", "frt"], None),
    "THC": (["terminal handling", "thc"], "per_container_20"),
    "BAF": (["bunker adjustment", "bunker", "baf"], None),
    "CAF": (["currency adjustment", "caf"], None),
    "ISPS": (["isps", "security charge", "security"], "per_container_20"),
    "DOC": (["documentation", "doc fee", "documentation fee", "b/l fee",
             "bl fee", "doc"], "per_bl"),
    "CUSTOMS": (["customs clearance", "clearing fee", "clearance", "clearing"],
                "per_shipment"),
    "DELIVERY": (["delivery", "haulage", "trucking", "cartage"], None),
    "WHARFAGE": (["wharfage"], "per_container_20"),
    "EXAM": (["examination", "scanning", "exam"], "per_shipment"),
    "DEMURRAGE": (["demurrage", "detention"], None),
}

# --- canonical basis enum ---------------------------------------------------
# enum -> alias substrings (checked against the unit text, longest first)
BASIS_ALIASES: dict[str, list[str]] = {
    "per_container_40": ["40'gp", "40gp", "40'hc", "40hc", "40hq", "40'dc",
                         "40dc", "40 ft", "40ft", "40'", "per 40", "40'hq"],
    "per_container_20": ["20'gp", "20gp", "20'dc", "20dc", "20 ft", "20ft",
                         "20'", "per 20", "teu", "per container", "per box"],
    "per_truck": ["per truck", "per vehicle", "per load", "ftl", "per trip"],
    "per_cbm": ["per cbm", "cbm", "m3", "w/m", "per m3", "cubic"],
    "per_kg": ["per kg", "/kg", " kg", "per ton", "per tonne", "per mt"],
    "per_bl": ["per bl", "per b/l", "per bill", "/bl"],
    "per_shipment": ["per shipment", "per consignment", "per file",
                     "per entry"],
    "flat": ["lumpsum", "lump sum", "flat", "fixed"],
}

KNOWN_CURRENCIES = {"USD", "ZAR", "EUR", "GBP", "ZWL", "BWP", "ZMW", "MWK",
                    "NAD", "MZN", "TZS"}
_CURRENCY_SYMBOL = {"$": "USD", "R": "ZAR", "€": "EUR", "£": "GBP"}

# Charges levied per location, not per lane — a missing origin/destination on
# these is correct, not a defect, so don't flag it.
LOCAL_CHARGE_CODES = {"THC", "DOC", "ISPS", "BAF", "CAF", "CUSTOMS",
                      "WHARFAGE", "EXAM", "DEMURRAGE"}

# money-critical fields: flagged harder than lane text
_MONEY_ISSUES = ("rate", "currency", "basis")


def _match_charge_code(text: str) -> Optional[tuple[str, Optional[str]]]:
    low = text.lower()
    # longest alias wins to avoid 'freight' eating 'ocean freight' nuance
    best: Optional[tuple[str, Optional[str], int]] = None
    for code, (aliases, default_basis) in CHARGE_CODES.items():
        for alias in aliases:
            if alias in low and (best is None or len(alias) > best[2]):
                best = (code, default_basis, len(alias))
    return (best[0], best[1]) if best else None


def normalize_basis(unit: Optional[str]) -> Optional[str]:
    if not unit:
        return None
    low = unit.lower()
    for enum, aliases in BASIS_ALIASES.items():
        if any(a in low for a in aliases):
            return enum
    return None


def normalize_currency(value: Optional[str],
                       default: Optional[str] = None) -> Optional[str]:
    if not value:
        return default
    v = value.strip().upper()
    if v in KNOWN_CURRENCIES:
        return v
    for sym, cur in _CURRENCY_SYMBOL.items():
        if sym in value:
            return cur
    return default


def normalize_row(row, company_default_currency: Optional[str] = None) -> None:
    """Enrich + re-validate one RateRow in place (works on the dataclass from
    extract.py; only touches attributes, no imports back into extract)."""
    # Match the charge code against the charge label FIRST, then remark, then
    # the raw row — matching the whole row lets stray words ("% of freight" in a
    # basis cell) cause false matches (e.g. CAF -> FREIGHT).
    row.charge_label = getattr(row, "charge_type", None)
    match = None
    for candidate in (
        getattr(row, "charge_type", None),
        getattr(row, "remark", None),
        getattr(row, "source", None),
    ):
        if candidate:
            match = _match_charge_code(candidate)
            if match:
                break
    default_basis = None
    if match:
        row.charge_code, default_basis = match

    # basis: keep one the extractor already resolved (e.g. from a container
    # column), else derive from the unit text, else the charge code's default.
    preset_basis = getattr(row, "basis", None)
    row.basis = (
        preset_basis
        or normalize_basis(getattr(row, "unit", None))
        or default_basis
    )

    # currency: tighten + apply company default
    row.currency = normalize_currency(
        getattr(row, "currency", None), company_default_currency)

    # confidence + aggressive money-field flagging
    _score_and_flag(row)


def _score_and_flag(row) -> None:
    confidence = 1.0
    # money-critical: each missing field is a hard hit + explicit flag
    if getattr(row, "rate", None) is None:
        confidence -= 0.4
        _flag(row, "rate missing or unparseable")
    if getattr(row, "currency", None) is None:
        confidence -= 0.3
        _flag(row, "currency unknown")
    if row.basis is None:
        confidence -= 0.3
        _flag(row, "basis unknown")
    # lane text: softer (embarrassing, not financial). Local charges have no
    # lane by nature — only flag a missing origin on lane-based (freight) rows.
    is_local = (
        getattr(row, "charge_code", None) in LOCAL_CHARGE_CODES
        or getattr(row, "charge_type", None) == "Local Charge"
    )
    if not is_local and not getattr(row, "lane_origin", None):
        confidence -= 0.1
        _flag(row, "missing origin")
    if row.charge_code != "FREIGHT":
        pass
    if (getattr(row, "charge_code", None) in (None,)
            and getattr(row, "charge_type", None)):
        confidence -= 0.05  # recognised text but no canonical code
    if not getattr(row, "valid_from", None) or not getattr(row, "valid_to", None):
        confidence -= 0.05
    row.confidence = round(max(0.0, min(1.0, confidence)), 2)
    # any money-critical issue forces review regardless of prior state
    if any(any(k in i for k in _MONEY_ISSUES) for i in getattr(row, "issues", [])):
        row.needs_review = True


def _flag(row, msg: str) -> None:
    row.needs_review = True
    issues = getattr(row, "issues", None)
    if issues is None:
        return
    if msg not in issues:
        issues.append(msg)


def normalize_rows(rows, company_default_currency: Optional[str] = None):
    # reset issues so normalization is the single source of truth for flags
    for row in rows:
        if hasattr(row, "issues"):
            row.issues = []
        if hasattr(row, "needs_review"):
            row.needs_review = False
        normalize_row(row, company_default_currency)
    return rows
