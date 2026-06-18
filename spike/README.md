# Extraction spike

**Throwaway code.** Its only job is to answer one question before any app is
built: *can we get usable structured rate rows out of a messy freight sheet,
with the bad cases landing as fast fixes rather than dead ends?*

Answer so far, against synthetic-but-messy sheets: **yes for Excel, yes for
ruled-table PDFs** — with the important caveat below about PDF structure.

## Run it

```sh
python -m venv spike/.venv
spike/.venv/Scripts/python -m pip install pdfplumber openpyxl reportlab
spike/.venv/Scripts/python spike/generate_samples.py          # writes samples/
spike/.venv/Scripts/python spike/extract.py samples/sample_rate_sheet.xlsx --pretty
spike/.venv/Scripts/python spike/extract.py samples/sample_rate_sheet.pdf  --pretty
spike/.venv/Scripts/python spike/extract.py samples/sample_rate_sheet_messy.xlsx --pretty
```

`samples/` is gitignored. The generator is committed, so samples are
reproducible; real customer rate sheets dropped in `samples/` stay out of git.

## What the spike covers

- **Excel** (`openpyxl`) and **PDF ruled tables** (`pdfplumber`).
- Messy-cell parsing that survives real formats: `USD 1,850.00`, `$3,400`,
  `4 050`, `ZAR 28,500`.
- **Context carried onto every row**: free-text validity line
  (`Rate Validity: 01 Jun 2026 - 31 Aug 2026`) and section headings
  (`SEA FREIGHT - FCL` → charge type `Ocean Freight`).
- **`needs_review` + `issues` on every row.** The review table is the product,
  not a fallback — so a bad extraction is a labeled 30-second fix, never a
  silent wrong number in a quote.

## What the spike DELIBERATELY does not do

- No LLM-vision fallback yet (that's for scanned / image-only PDFs, and needs an
  API key). Tiered design: pdfplumber first → vision pass → always land in the
  review table.
- No app, DB, or UI. JSON to stdout only.

## Findings worth carrying into the real build

1. **Excel is the easy, reliable path.** Cells sit in a linear grid; column
   mapping + value parsing is enough. 9/9 sample rows clean.
2. **PDF's hard part is *structure*, not values.** Rates/lanes/currencies parse
   fine. The fragile bit is binding each table to the section heading above it —
   in a PDF the heading and table are spatially separate objects. The first
   naive heuristic mislabelled every PDF row as "Ocean Freight". The fix is
   **geometric**: match each table to the nearest heading *above* it by
   y-coordinate (`_sections_with_positions` / `_section_above`). After that,
   9/9 rows correct.
3. **The review-flag path works.** `sample_rate_sheet_messy.xlsx` (a `POA`
   rate, a blank origin, a missing currency, and no validity line) yields 3/3
   rows flagged with specific, actionable issues — proving bad input degrades
   to a fix, not a crash or a lie.
4. **Implication for the real build:** the editable review table needs to
   surface `issues` per cell and make the flagged cells the first thing the user
   sees. Confidence/looks-clean rows can collapse; flagged rows expand.

## Canonical row schema (informs the Prisma model later)

```jsonc
{
  "charge_type": "Ocean Freight",       // derived from section heading
  "lane_origin": "Durban",
  "lane_destination": "Harare",         // null is valid for Local Charge
  "unit": "per 20ft",
  "rate": 1850.0,
  "currency": "USD",
  "valid_from": "2026-06-01",           // ISO, carried from validity line
  "valid_to": "2026-08-31",
  "remark": "Door/Door",
  "needs_review": false,
  "issues": [],                         // e.g. ["currency unknown"]
  "source": "Durban | Harare | per 20ft | USD 1,850.00 | USD | Door/Door"
}
```

## Honest limits / next probes

- Synthetic sheets are kinder than reality. **The real test is 2–3 actual
  carrier/agent sheets** — especially scanned ones, which will exercise the
  not-yet-built vision fallback.
- Multi-table-per-page and multi-page PDFs are only lightly exercised.
- No merged-cell PDFs (pdfplumber can split/duplicate those oddly).
