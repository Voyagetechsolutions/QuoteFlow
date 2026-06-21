# QuoteFlow API image — Node + Python (extraction) + Chromium (branded PDFs).
# Deploy to Railway/Render (NOT Vercel — that's serverless and can't run these).
FROM node:20-bookworm-slim

# System deps: Python for the extraction scripts.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Python extraction venv (the API expects spike/.venv) ---
COPY spike/requirements.txt ./spike/requirements.txt
RUN python3 -m venv spike/.venv \
    && spike/.venv/bin/pip install --no-cache-dir -r spike/requirements.txt

# --- Node workspace deps (cached on package.json changes) ---
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm install --no-audit --no-fund

# Chromium + its OS libraries for Playwright (PDF rendering).
RUN npx playwright install --with-deps chromium

# --- Source + build ---
COPY . .
RUN npm --prefix packages/shared run build \
    && npm --prefix apps/api run prisma:generate \
    && npm --prefix apps/api run build

ENV NODE_ENV=production
# Point the extraction service at the Linux venv/script paths.
ENV EXTRACTION_PYTHON=/app/spike/.venv/bin/python3
ENV EXTRACTION_SCRIPT=/app/spike/extract_any.py
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
