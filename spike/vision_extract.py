"""
Vision fallback (tier 3) for the extraction spike: SCANNED / image-only rate
sheet -> canonical rows.

The planned pipeline is tiered:
    pdfplumber tables  ->  THIS vision pass  ->  always land in the review table.

This handles what the table parser cannot: scanned PDFs, photos, image-only
exports with no extractable text objects or ruled-line geometry.

Flow:
  1. Rasterize each PDF page to PNG (PyMuPDF). Image inputs are used as-is.
  2. Send the image to a Claude vision model with a strict JSON-schema prompt.
  3. Parse the model JSON into RateRow objects.
  4. Run the SAME validate_row() flagging as the table path, so the review table
     behaves identically regardless of which extractor produced the row.

Auth: needs ANTHROPIC_API_KEY (Anthropic Console key). Claude Code OAuth does
NOT drive an automated script. Without a key use --dry-run, which skips the
network call and feeds a recorded response through parse + validate.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python spike/vision_extract.py samples/sample_rate_sheet.pdf --pretty
    python spike/vision_extract.py samples/sample_scanned.png --pretty
    python spike/vision_extract.py samples/sample_scanned.png --dry-run --pretty
    python spike/vision_extract.py samples/sample_rate_sheet.pdf --save-png samples/
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from dataclasses import asdict
from typing import Optional

import fitz  # PyMuPDF

from extract import RateRow, validate_row, charge_type_for, KNOWN_CURRENCIES

# Vision model. Sonnet 4.6 balances vision accuracy and cost for high-volume
# extraction; override with --model. Opus 4.8 for the hardest scans.
DEFAULT_MODEL = "claude-sonnet-4-6"

PROMPT = """You are extracting a freight forwarder's rate sheet from an image.

Return ONLY a JSON object, no prose, with this exact shape:
{
  "validity": {"from": "YYYY-MM-DD or null", "to": "YYYY-MM-DD or null"},
  "rows": [
    {
      "charge_type": "Ocean Freight | Road Freight | Air Freight | Local Charge | <section as written>",
      "lane_origin": "string or null",
      "lane_destination": "string or null",
      "unit": "string or null (e.g. 'per 20ft', 'per truck', 'per shipment')",
      "rate": number or null,
      "currency": "USD | ZAR | EUR | GBP | ZWL | BWP | ZMW | MWK | null",
      "remark": "string or null"
    }
  ]
}

Rules:
- Derive charge_type from the section heading the row sits under.
- Local charges legitimately have no destination; leave it null.
- Parse messy rate formats ("USD 1,850.00", "$3,400", "4 050") into a plain number.
- If a value is genuinely illegible or absent, use null. Do NOT guess.
- The validity dates usually appear once as free text; apply them to every row.
"""

# A recorded model response that matches the synthetic sheet, so --dry-run can
# exercise parse + validate with no network call / no spend.
RECORDED_RESPONSE = json.dumps({
    "validity": {"from": "2026-06-01", "to": "2026-08-31"},
    "rows": [
        {"charge_type": "Ocean Freight", "lane_origin": "Durban", "lane_destination": "Harare", "unit": "per 20ft", "rate": 1850.0, "currency": "USD", "remark": "Door/Door"},
        {"charge_type": "Ocean Freight", "lane_origin": "Durban", "lane_destination": "Harare", "unit": "per 40ft", "rate": 3400.0, "currency": "USD", "remark": "Door/Door"},
        {"charge_type": "Ocean Freight", "lane_origin": "Durban", "lane_destination": "Lusaka", "unit": "per 20ft", "rate": 2100.0, "currency": "USD", "remark": None},
        {"charge_type": "Ocean Freight", "lane_origin": "Cape Town", "lane_destination": "Lilongwe", "unit": "per 40ft", "rate": 4050.0, "currency": "USD", "remark": "Transit 18-21d"},
        {"charge_type": "Road Freight", "lane_origin": "Johannesburg", "lane_destination": "Harare", "unit": "per truck", "rate": 28500.0, "currency": "ZAR", "remark": "Tri-axle"},
        {"charge_type": "Road Freight", "lane_origin": "Johannesburg", "lane_destination": "Gaborone", "unit": "per truck", "rate": 16750.0, "currency": "ZAR", "remark": None},
        {"charge_type": "Local Charge", "lane_origin": "Harare", "lane_destination": None, "unit": "per shipment", "rate": 145.0, "currency": "USD", "remark": "Clearing fee"},
        {"charge_type": "Local Charge", "lane_origin": "Harare", "lane_destination": None, "unit": "per BL", "rate": 65.0, "currency": "USD", "remark": "Documentation"},
        {"charge_type": "Local Charge", "lane_origin": "Lusaka", "lane_destination": None, "unit": "per shipment", "rate": 160.0, "currency": "USD", "remark": "Clearing fee"},
    ],
})


# --- rasterization -----------------------------------------------------------

def rasterize_pdf(path: str, dpi: int = 200) -> list[bytes]:
    """Render each PDF page to PNG bytes."""
    pages: list[bytes] = []
    with fitz.open(path) as doc:
        for page in doc:
            pix = page.get_pixmap(dpi=dpi)
            pages.append(pix.tobytes("png"))
    return pages


def load_images(path: str, dpi: int = 200) -> list[tuple[bytes, str]]:
    """Return [(image_bytes, media_type), ...] for a PDF or image file."""
    lower = path.lower()
    if lower.endswith(".pdf"):
        return [(b, "image/png") for b in rasterize_pdf(path, dpi)]
    if lower.endswith(".png"):
        return [(open(path, "rb").read(), "image/png")]
    if lower.endswith((".jpg", ".jpeg")):
        return [(open(path, "rb").read(), "image/jpeg")]
    raise SystemExit(f"unsupported file type for vision: {path}")


# --- model call --------------------------------------------------------------

def call_vision(image_bytes: bytes, media_type: str, model: str) -> str:
    """Send one image to the vision model; return the raw text response."""
    import anthropic  # imported lazily so --dry-run needs no key/network

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    msg = client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {
                    "type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": PROMPT},
            ],
        }],
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")


# --- parsing -----------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """Pull a JSON object out of the model output (handles ``` fences / prose)."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.DOTALL)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object in model output: {text[:200]!r}")
    return json.loads(text[start:end + 1])


def rows_from_model(text: str) -> list[RateRow]:
    data = _extract_json(text)
    validity = data.get("validity") or {}
    vfrom = validity.get("from")
    vto = validity.get("to")

    rows: list[RateRow] = []
    for item in data.get("rows", []):
        cur = item.get("currency")
        if cur and str(cur).upper() not in KNOWN_CURRENCIES:
            cur = None
        rate = item.get("rate")
        row = RateRow(
            charge_type=charge_type_for(item.get("charge_type")) if item.get("charge_type") else None,
            lane_origin=item.get("lane_origin"),
            lane_destination=item.get("lane_destination"),
            unit=item.get("unit"),
            rate=float(rate) if isinstance(rate, (int, float)) else None,
            currency=cur.upper() if cur else None,
            valid_from=vfrom or None,
            valid_to=vto or None,
            remark=item.get("remark"),
            source="vision",
        )
        validate_row(row)  # SAME flagging as the table path
        rows.append(row)
    return rows


# --- entrypoint --------------------------------------------------------------

def extract_vision(path: str, model: str, dry_run: bool, dpi: int = 200,
                   save_png_dir: Optional[str] = None) -> list[RateRow]:
    images = load_images(path, dpi)

    if save_png_dir:
        os.makedirs(save_png_dir, exist_ok=True)
        base = os.path.splitext(os.path.basename(path))[0]
        for i, (b, _mt) in enumerate(images):
            out = os.path.join(save_png_dir, f"{base}_p{i + 1}.png")
            with open(out, "wb") as fh:
                fh.write(b)
            print(f"saved {out}", file=sys.stderr)

    rows: list[RateRow] = []
    for image_bytes, media_type in images:
        raw = RECORDED_RESPONSE if dry_run else call_vision(image_bytes, media_type, model)
        page_rows = rows_from_model(raw)
        # validity, once found, carries to later pages that lack it
        if rows and page_rows:
            vf = next((r.valid_from for r in rows if r.valid_from), None)
            vt = next((r.valid_to for r in rows if r.valid_to), None)
            for r in page_rows:
                r.valid_from = r.valid_from or vf
                r.valid_to = r.valid_to or vt
        rows.extend(page_rows)
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Vision fallback: scanned sheet -> rows")
    ap.add_argument("path", help="PDF or image (.png/.jpg) rate sheet")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--dry-run", action="store_true",
                    help="skip the model call; use a recorded response")
    ap.add_argument("--save-png", metavar="DIR",
                    help="also write rasterized page PNG(s) to DIR for inspection")
    ap.add_argument("--pretty", action="store_true")
    args = ap.parse_args()

    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY not set. Set it, or pass --dry-run to test "
                 "the pipeline with a recorded response.")

    rows = extract_vision(args.path, args.model, args.dry_run, args.dpi, args.save_png)
    payload = {
        "source_file": args.path,
        "extractor": "vision/dry-run" if args.dry_run else f"vision/{args.model}",
        "row_count": len(rows),
        "needs_review_count": sum(1 for r in rows if r.needs_review),
        "rows": [asdict(r) for r in rows],
    }
    json.dump(payload, sys.stdout,
              indent=2 if args.pretty else None, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
