# QuoteFlow

Messy freight rate sheet in → clean, branded quote out → one-click convert to
invoice. Scoped to small SADC freight forwarders.

- **Product spec:** [docs/PRD.md](docs/PRD.md)
- **Extraction spike (Python):** [spike/README.md](spike/README.md)

## Layout

```
apps/api      NestJS + Prisma (Postgres). Multi-tenant by companyId.
apps/web      React + Vite + Tailwind. Sidebar app: Rate Sets, Quotes, Invoices, Customers.
packages/shared   Domain types shared by api + web (the canonical ExtractedRateRow).
spike/        Throwaway Python extractor (pdfplumber tables + vision fallback).
scripts/dev-db.cjs   Local Postgres via embedded-postgres (no Docker).
```

The rate-sheet extractor is the Python spike; the API shells out to it
(`POST /api/rate-sets/extract`). Excel/CSV/digital-PDF need no API key; scanned
PDFs use the vision tier, which reads `ANTHROPIC_API_KEY` (or `spike/.key`).

## Run it locally

Prereqs: Node ≥ 20, and the Python venv for extraction
(`python -m venv spike/.venv && spike/.venv/Scripts/python -m pip install pdfplumber openpyxl reportlab pymupdf anthropic`).

```sh
npm install
npx playwright install chromium              # for branded quote/invoice PDFs
npm --prefix packages/shared run build      # build shared types once
npm --prefix apps/api run prisma:generate    # generate Prisma client

# 1) Local Postgres (leave running in its own terminal) — no Docker needed
node scripts/dev-db.cjs
#    prints: READY postgresql://postgres:postgres@localhost:5433/quoteflow?schema=public

# 2) One-time: create schema + seed demo data (uses apps/api/.env DATABASE_URL,
#    which already points at localhost:5433)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quoteflow?schema=public"
npm --prefix apps/api exec -- prisma db push --schema apps/api/prisma/schema.prisma
npm --prefix apps/api run prisma:seed

# 3) API and web (each in its own terminal)
npm run dev:api     # http://localhost:3000/api  (loads apps/api/.env)
npm run dev:web     # http://localhost:5173
```

Open http://localhost:5173 → Upload a rate sheet (try `spike/` to generate a
sample: `spike/.venv/Scripts/python spike/generate_samples.py`), review the
extracted rows, save, build a quote, convert to an invoice.

> The embedded dev DB is ephemeral (wiped on stop) and initialised as UTF-8.
> For a persistent DB, point `apps/api/.env`'s `DATABASE_URL` at any Postgres.
