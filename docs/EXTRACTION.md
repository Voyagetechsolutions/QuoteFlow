# Extraction & Normalization — design + roadmap

> Captured from the design discussion. **v1 builds one stage seriously
> (normalization); the tiered router is explicitly roadmap, not now.**

## The two stages

1. **Extraction** — get structured-ish data off the file. *Mostly solved.*
2. **Normalization** — map heterogeneous freight terminology into our fixed
   schema. *The actual work; freight-specific; reusable; the moat.*

The durable asset is the **normalization dictionary**, not the extraction code.
"Characters off a page" is close to solved; mapping `POL/POD`, `20'GP` vs
`20DC`, `THC/BAF/CAF`, `per CBM` vs `per container` vs `flat` into one schema is
freight-specific and has no library.

## v1 (the demo) — fixed paths, no confidence router

```
Upload
  ├── Excel (.xlsx/.xls/.csv) → SheetJS / table parse → normalization → review
  └── PDF (any)               → [table parse]  → normalization → review
                                 └ fallback → vision-LLM (schema-constrained) when tables fail / scanned
```

- **Excel never touches the LLM** — it's already structured; only normalization.
- **PDF**: original plan was "render to image → vision-LLM on every PDF". Build
  note (2026-06): we already have a working pdfplumber **table path that runs at
  $0 and needs no API key**, so v1 keeps it as the cheap default and adds the
  vision pass as the **fallback for scans / fuzzy layouts** — which is the only
  case that needs the key. This is still "one fixed path per situation," not a
  confidence-escalating router (that's the v2 thing we're deferring).
- Vision call carries three things: the **target JSON schema** (enforced via
  structured output / tool-use so it can't return malformed JSON), a **freight
  glossary**, and a hard rule: *"If unsure, leave blank and flag. Never guess a
  rate, currency, or basis."*

**Blocked-on-user for the vision path:** an `ANTHROPIC_API_KEY` (Console key in
`spike/.key`) and ideally one real scanned sheet to tune against. Until both
exist, the vision path cannot be built-and-validated; normalization can.

## Target schema (`RateLine`)

```ts
RateLine {
  laneOrigin:      string   // "Durban" / "ZADUR"
  laneDestination: string   // "Harare" / "ZWHRE"
  chargeCode:      string   // canonical: THC, BAF, FREIGHT, ISPS...
  chargeLabel:     string   // raw label as it appeared
  basis: 'per_container_20' | 'per_container_40' | 'per_cbm'
       | 'per_kg' | 'per_shipment' | 'per_bl' | 'flat'
  rate:        decimal
  currency:    string       // USD, ZAR, ZWL
  minCharge?:  decimal
  validFrom?:  date
  validTo?:    date
  carrier?:    string
  rawText:     string       // original cell/line — audit + review UI + eval data
  confidence:  number       // 0–1, per row
  needsReview: boolean
}
```

Keep `rawText` always: it powers the review UI ("here's the line I read this
from" → trust) and is the eval/training data later.

## Normalization layer (the freight-specific part, all reusable)

- **Charge-code dictionary** — THC, BAF, CAF, ISPS, DOC, FREIGHT… → canonical
  code + likely basis. **Editable per company** (their quirks; a retention hook).
- **Lane parser** — origin/destination from city names, UN/LOCODE, or POL/POD.
- **Unit/basis normalizer** — `20'GP`, `20DC`, `20ft`, `per TEU` → basis enum.
- **Currency detector** — symbol/code, with a per-company default fallback.
- **Validity window parser** — "valid until", date ranges.

A vision LLM can do most of this inline if the glossary is in the prompt — **but
keep a deterministic post-pass for the things that must be exact: currency and
basis.** Don't let a fuzzy model silently decide per-CBM vs per-container; that
error flows straight into a wrong quote.

## Review table — non-negotiable

- Every row lands editable; low-confidence cells highlighted.
- **Rate / currency / basis flag more aggressively** than the rest — a wrong
  lane name is embarrassing; a wrong number is a financial mistake.
- Correction is a ~10-second fix, not re-entry. Promise = "correcting is faster
  than typing," not "never corrects."
- Every logged correction becomes the eval set. After ~50–100 real sheets,
  **"% of rows needing manual edit" is the single product-quality metric**.
  Improve it by tuning prompt + glossary. No fine-tuning early.

## Tech decisions

- **PDF → image** (for vision): poppler `pdftoppm` / `pdf2image` (Python) — we
  already have PyMuPDF in the spike doing this. Note: the existing
  Playwright/Chromium pipeline is **HTML→PDF** (output quotes/invoices), the
  *reverse* direction — reused for a different stage, not this one.
- **Language split**: extraction is Python (pdfplumber/PyMuPDF). Today the API
  shells out to the spike via child_process. A small FastAPI microservice that
  NestJS calls over HTTP is cleaner *if/when* we go tiered; not needed for v1.
- **Async**: extraction takes seconds–~30s. Don't block the HTTP request at
  scale — a simple async job + frontend polling ("Processing…") suffices. No
  Redis/BullMQ until volume justifies a real queue (v2).

## v2 — the tiers (roadmap, NOT now)

```
Router (by file type + text-layer + table-lines)
 ├ Tier 0  Excel           → SheetJS, no LLM
 ├ Tier 1  clean table PDF → pdfplumber → deterministic normalize   (cheapest)
 ├ Tier 2  text PDF, fuzzy → cheap text LLM on extracted text        (mid)
 └ Tier 3  scanned/garbage → vision LLM                              (priciest, most robust)
```

Escalate only when the cheaper tier's confidence is low. Cuts cost ~70–90% at
scale. Buys nothing at demo stage and adds routing bugs → deferred until
measured accuracy + cost numbers justify it.
