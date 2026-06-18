/**
 * Dev-only local Postgres via embedded-postgres — no Docker, no system install.
 * Downloads a portable Postgres on first run, serves on localhost:5433, and
 * keeps running until killed. Data is ephemeral (wiped on stop).
 *
 *   node scripts/dev-db.cjs
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/quoteflow?schema=public"
 */
const path = require('node:path');
const fs = require('node:fs');
const mod = require('embedded-postgres');
const EmbeddedPostgres = mod.default ?? mod;

const PORT = Number(process.env.PGPORT ?? 5433);
const DATA_DIR = path.join(__dirname, '..', '.pgdata');

(async () => {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false,
    // Force UTF-8; on Windows initdb otherwise defaults the cluster to WIN1252,
    // which rejects any non-Latin1 character (accents, arrows, etc.).
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
  });

  // Idempotent: only initdb when there's no existing cluster. Lets the DB be
  // restarted (e.g. after a hard kill that skipped graceful cleanup) without
  // tripping "directory exists but is not empty".
  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase('quoteflow');
  } catch (err) {
    if (!/already exists/i.test(String(err))) throw err;
  }

  console.log(
    `READY postgresql://postgres:postgres@localhost:${PORT}/quoteflow?schema=public`,
  );

  const shutdown = async () => {
    try {
      await pg.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  setInterval(() => {}, 1 << 30); // stay alive
})().catch((err) => {
  console.error('PG ERROR', err);
  process.exit(1);
});
