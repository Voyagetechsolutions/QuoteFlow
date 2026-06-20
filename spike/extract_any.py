"""
Unified extraction entrypoint — the seam the API shells out to.

File in  ->  tiered extraction  ->  ExtractionResult JSON (camelCase, matching
packages/shared `ExtractionResult` / `ExtractedRateRow`).

Tiers:
  .xlsx/.xls  -> openpyxl table parse        (extractor "table/xlsx")
  .csv        -> csv table parse             (extractor "table/csv")
  .pdf        -> pdfplumber table parse       (extractor "table/pdf")
                 if that yields 0 rows AND ANTHROPIC_API_KEY is set,
                 fall back to the vision pass (extractor "vision/<model>")

Usage:
    python spike/extract_any.py <file> [--name ORIGINAL] [--model M] [--pretty]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict

from extract import extract_xlsx, extract_csv, extract_pdf, RateRow
from normalize import normalize_rows

# snake_case (Python dataclass) -> camelCase (shared TS contract)
_CAMEL = {
    "charge_type": "chargeType",
    "lane_origin": "laneOrigin",
    "lane_destination": "laneDestination",
    "valid_from": "validFrom",
    "valid_to": "validTo",
    "charge_code": "chargeCode",
    "charge_label": "chargeLabel",
    "needs_review": "needsReview",
}


def _to_camel(d: dict) -> dict:
    return {_CAMEL.get(k, k): v for k, v in d.items()}


def run(path: str, model: str | None = None,
        force_vision: bool = False) -> tuple[str, list[RateRow]]:
    lower = path.lower()
    if lower.endswith((".xlsx", ".xlsm", ".xls")):
        return "table/xlsx", extract_xlsx(path)
    if lower.endswith(".csv"):
        return "table/csv", extract_csv(path)
    if lower.endswith(".pdf"):
        # AI-first: when an OpenRouter key is configured, let the model SEE the
        # document and arrange it into rows. The deterministic table parser is
        # the fallback — used when the model is unavailable (no credits,
        # rate-limited, or it returns nothing), so uploads never hard-fail.
        if os.environ.get("OPENROUTER_API_KEY") or force_vision:
            from vision_extract import extract_vision, DEFAULT_MODEL

            chosen = model or DEFAULT_MODEL
            try:
                vision_rows = extract_vision(path, chosen, dry_run=False)
            except Exception as exc:
                sys.stderr.write(
                    f"vision unavailable, falling back to table parser: {exc}\n")
                vision_rows = []
            if vision_rows:
                return f"vision/{chosen}", vision_rows
            if force_vision:
                raise SystemExit(
                    "--force-vision: model returned nothing "
                    "(check OPENROUTER_API_KEY / account credits)")

        return "table/pdf", extract_pdf(path)
    raise SystemExit(f"unsupported file type: {path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="rate sheet -> ExtractionResult JSON")
    ap.add_argument("path")
    ap.add_argument("--name", help="original filename to report as sourceFile")
    ap.add_argument("--model", help="override vision model")
    ap.add_argument("--default-currency", help="company fallback currency")
    ap.add_argument("--force-vision", action="store_true",
                    help="skip table parsing; use the vision tier (needs a key)")
    ap.add_argument("--pretty", action="store_true")
    args = ap.parse_args()

    extractor, rows = run(args.path, args.model, args.force_vision)
    # Deterministic freight normalization post-pass (the moat) — applies to
    # every extractor's output and owns the money-critical flags.
    normalize_rows(rows, args.default_currency)
    payload = {
        "sourceFile": args.name or os.path.basename(args.path),
        "extractor": extractor,
        "rowCount": len(rows),
        "needsReviewCount": sum(1 for r in rows if r.needs_review),
        "rows": [_to_camel(asdict(r)) for r in rows],
    }
    json.dump(payload, sys.stdout,
              indent=2 if args.pretty else None, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
