/**
 * lib/db.ts
 *
 * SQLite singleton (better-sqlite3) — stores raw sources and processing logs.
 * Wiki pages / graph data are handled by HydraDB (see lib/hydra.ts).
 *
 * The singleton is attached to `globalThis` so Next.js hot-reload in dev
 * doesn't re-open the database file on every module evaluation.
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'wiki.db')

// ---------------------------------------------------------------------------
// Singleton plumbing
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined
}

function openDatabase(): Database.Database {
  const db = new Database(DB_PATH)

  // WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables(db)
  migrateColumns(db)
  return db
}

function migrateColumns(db: Database.Database): void {
  const cols = db.pragma('table_info(pages)') as Array<{ name: string }>
  const names = new Set(cols.map((c) => c.name))
  if (!names.has('summary')) db.exec(`ALTER TABLE pages ADD COLUMN summary TEXT`)
  if (!names.has('source_id')) db.exec(`ALTER TABLE pages ADD COLUMN source_id INTEGER`)
}

function createTables(db: Database.Database): void {
  db.exec(/* sql */ `
    -- Raw content scraped from URLs before AI processing
    CREATE TABLE IF NOT EXISTS sources (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT,
      title       TEXT,
      raw_content TEXT    NOT NULL,
      processed   INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- One log row per ingestion / processing run
    CREATE TABLE IF NOT EXISTS logs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id     INTEGER,
      pages_created INTEGER NOT NULL DEFAULT 0,
      pages_updated INTEGER NOT NULL DEFAULT 0,
      message       TEXT,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Local cache/metadata for HydraDB wiki pages (deprecation pipeline)
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'concept',
      summary TEXT,
      source_id INTEGER,
      confidence INTEGER DEFAULT 100,
      last_validated DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_stale INTEGER DEFAULT 0,
      stale_reason TEXT,
      hydra_doc_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );


    -- Traced query logs for observability
    CREATE TABLE IF NOT EXISTS query_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      pages_considered INTEGER DEFAULT 0,
      pages_used INTEGER DEFAULT 0,
      answer_length INTEGER DEFAULT 0,
      recall_strategy TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wikilink edges parsed from page content at ingest time
    CREATE TABLE IF NOT EXISTS page_links (
      source_slug TEXT NOT NULL,
      target_slug TEXT NOT NULL,
      PRIMARY KEY (source_slug, target_slug)
    );
  `)
}

// Reuse existing instance across hot-reloads in development
export const db: Database.Database =
  globalThis.__db ?? (globalThis.__db = openDatabase())
