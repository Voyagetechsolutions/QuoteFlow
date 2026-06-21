# Deploying QuoteFlow

QuoteFlow is **three pieces**, because the API can't run on Vercel (it needs
Python for extraction, Chromium for PDFs, and a long-running server):

| Piece | Host | How |
|---|---|---|
| **Database** | **Neon** (managed Postgres) | already set up |
| **API** (`apps/api`) | **Railway** or **Render** | the `Dockerfile` at repo root |
| **Web app** (`apps/web`) | **Vercel** / Netlify (static) | build `apps/web`, set `VITE_API_BASE_URL` |
| **Landing** (`landing/`) | Vercel / Netlify (static) | separate project, root = `landing` |

> ❌ Don't deploy the whole repo to Vercel — the API will crash
> (`FUNCTION_INVOCATION_FAILED`). Vercel only serves the static frontend/landing.

## 1. Database (Neon) — done

Use the **pooled** connection string with `?sslmode=require&pgbouncer=true`
(Prisma's runtime needs `pgbouncer=true` with Neon's pooler).

## 2. API → Railway or Render

Point the service at this repo; it auto-detects the `Dockerfile`. Set env vars:

```
DATABASE_URL      = <Neon pooled URL ...&pgbouncer=true>
JWT_SECRET        = <long random string>        # required in production
OPENROUTER_API_KEY= <your OpenRouter key>       # add credits for gpt-4o
OPENROUTER_MODEL  = openai/gpt-4o
WEB_ORIGIN        = https://<your-web-app>.vercel.app   # CORS allow-list
EMAIL_ENABLED     = false
NODE_ENV          = production
PORT              = 3000
```

One-time, after first deploy (from your machine, against the Neon URL):

```sh
npm --prefix apps/api exec -- prisma db push --schema apps/api/prisma/schema.prisma
npm --prefix apps/api run prisma:seed     # creates demo@quoteflow.com / demopass1
```

## 3. Web app → Vercel

New Vercel project, **Root Directory = `apps/web`**, framework **Vite**:
- Build command: `npm install && npm run build` (build output `dist`)
- Env var: `VITE_API_BASE_URL = https://<your-api>.up.railway.app`

The web client reads `VITE_API_BASE_URL`; empty in dev (Vite proxy), the API
origin in production. Make sure the API's `WEB_ORIGIN` matches the web domain.

## 4. Landing → Vercel

Separate project, **Root Directory = `landing`** (static, no build). Or keep the
existing one — the repo-root `vercel.json` already serves `landing/`.
