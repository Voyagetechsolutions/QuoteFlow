# PRD — QuoteFlow

> **Status:** Draft v1. Scope locked to freight/logistics. The "works for many
> industries" claim is a parked hypothesis, **not** a v1 requirement.
>
> **What this document is and isn't:** A PRD is a more organized way to build
> before someone has agreed to pay — it is not validation. The real test of this
> idea is whether one forwarder sends a real, messy rate sheet and says "if this
> spits out a clean quote, I'd use it." The spec's job is to get to a ~2-week
> demo to put in front of someone, not to feel like progress.

Confidence tags used below: **[Certain]**, **[Likely]**.

---

## 1. Problem

Small freight forwarders receive carrier/agent rate sheets in inconsistent
formats (PDF, Excel, scanned, pasted into email). To quote a customer, someone
manually reads the sheet, finds the right lane and charges, applies a markup,
and retypes everything into a quote. Then re-keys it again into an invoice.
It's slow, error-prone, and the margin math gets fudged.

## 2. The one job this does

**Messy rate sheet in → clean, branded quote out → one-click convert to
invoice.** Nothing else. If a feature isn't on that path, it's out of v1.

## 3. Target user

Small SADC freight forwarder (1–20 staff). The person using it is whoever
builds quotes — often an ops person or the owner. They are not technical.
Success = they get a sendable quote faster than their current copy-paste flow.

## 4. Non-goals (v1)

No shipment tracking, no customs, no GL/accounting, no multi-currency engine
beyond basic, no integrations, no other industries. These are roadmap, not v1.
Written down here precisely so they stop getting added.

## 5. Core flows

### Flow A — Rate sheet → structured rates
1. User uploads a rate sheet (PDF or Excel).
2. System extracts line items: lane (origin→destination), charge type, unit,
   rate, currency, validity dates.
3. User sees extracted rows in an editable table and corrects anything wrong.
   **[Likely]** This human-in-the-loop step is mandatory — extraction will never
   be 100%, and pretending it is will lose trust on day one. The review table is
   a **first-class product surface**, not a fallback for bad extraction.
4. Save as a reusable rate set.

### Flow B — Build a quote
1. Pick a customer (or type a name).
2. Select lanes/charges from a saved rate set, or add ad-hoc lines.
3. Apply markup (per-line % or flat, or a default margin).
4. System shows cost vs. sell vs. margin %.
5. Generate a branded PDF quote. Send via email or download.

### Flow C — Quote → invoice
1. From an accepted quote, one click creates an invoice (same lines, invoice
   number, due date).
2. Generate branded PDF invoice. Mark sent / paid / partial.

## 6. Must-have features (v1 scope, ranked)

1. Rate sheet upload + extraction + editable review table.
2. Quote builder with margin calculation.
3. Branded PDF quote generation.
4. Quote → invoice conversion + PDF.
5. Customer list (lightweight — name, email, contact).
6. Auth + single-company accounts (multi-tenant from the start, but no
   team/role complexity beyond owner + staff).

## 7. Explicitly deferred (v2+)

Saved rate-set versioning, payment status tracking dashboards, email open
tracking, multi-currency FX, templates per customer, API, "other industries."

## 8. Success metrics

- Time from rate sheet to sent quote (target: under 5 min vs. their current
  20–40).
- Extraction accuracy on real sheets (track % of rows needing manual edit).
- One paying or pilot user inside 6 weeks of a working demo.

---

## Tech stack

Use what's already known and has pipelines — the edge here is speed to demo,
not architectural novelty.

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite + Tailwind | Already build in this. No learning tax. |
| Backend | NestJS (TypeScript) | Same — reuse existing patterns. |
| DB | PostgreSQL + Prisma | Multi-tenant by `companyId` from day one. |
| PDF generation | Playwright/Chromium HTML→PDF | **[Certain]** Already built for the Zimbabwe Shipping delivery notes. Reuse directly — branded HTML templates → PDF. Biggest head start. |
| Excel parsing | SheetJS (xlsx) | Mature, handles the .xlsx/.xls cases. |
| PDF extraction | pdfplumber (Python microservice) or pdf-parse + table heuristics | The hard part. See note below. |
| Auth | JWT + bcrypt | Reuse existing setup. |
| Hosting | Single VPS + Docker, or Railway/Render | Cheap, fast to ship. Don't over-engineer infra for zero users. |

### The one genuinely hard, un-reused piece: PDF rate-sheet extraction

Excel is tractable with SheetJS. PDFs — especially scanned or oddly-laid-out
tables — are where this lives or dies. **[Likely]** Use a tiered approach:

1. Structured PDF tables via pdfplumber first.
2. Fall back to an LLM (vision) pass for messy/scanned sheets.
3. Always land in the editable review table, so a bad extraction is a
   30-second fix, not a dead end.

Don't try to make extraction perfect. Make correction fast.

---

## Platform decision

**Web app. [Certain] Not mobile, not yet.** The core job is uploading a
PDF/Excel rate sheet on a desktop and producing a quote/invoice document —
keyboard-and-file work done at a desk. Mobile-first would solve a problem the
user doesn't have and double the surface area. Make it responsive so it doesn't
break on a phone, but the deliverable is a web app.

---

## Open disagreement (recorded)

**Don't build the "works for many industries" abstraction into v1.** A generic
"messy document → quote" engine is a much harder, fuzzier product than "freight
rate sheet → freight quote," and the genericness adds no value until the
specific case is proven. Instead: build it hard-coded to freight concepts
(lanes, charge types, containers/weight), ship it, get a user. The risk in
generalizing early is building a flexible engine that's worse at the one thing
the first customer needs — and still having no customer.

---

## Recommended build sequence (de-risk before scaffold)

The hard, uncertain piece (PDF extraction) is testable in ~a day with a
throwaway script. Everything else is known-buildable. Sequence accordingly:

1. **Get 2–3 real rate sheets** from an actual forwarder. Doubles as the
   customer-contact test — a low-commitment ask that reveals whether anyone
   cares.
2. **Throwaway extraction spike** — pdfplumber + LLM-vision fallback, JSON to
   stdout. No app, no DB. If extraction is hopeless on real sheets, the product
   is hopeless and the cost was a day.
3. **Only then scaffold** the full stack, with the extraction approach already
   de-risked.
