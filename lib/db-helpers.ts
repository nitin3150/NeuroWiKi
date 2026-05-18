/**
 * lib/db-helpers.ts
 *
 * Typed helper functions for the SQLite database.
 * All operations are synchronous (better-sqlite3 API).
 */

import { db } from './db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Source {
  id: number
  url: string | null
  title: string | null
  raw_content: string
  processed: number // 0 = pending, 1 = done
  created_at: string
}

export interface Log {
  id: number
  source_id: number | null
  pages_created: number
  pages_updated: number
  message: string | null
  created_at: string
}

// Input types (id / created_at are auto-generated)
export type CreateSourceInput = Omit<Source, 'id' | 'created_at' | 'processed'> & {
  processed?: number
}

export type CreateLogInput = Omit<Log, 'id' | 'created_at'>

export interface PageHealth {
  id: number
  slug: string
  title: string
  type: string
  summary: string | null
  source_id: number | null
  confidence: number
  last_validated: string
  is_stale: number
  stale_reason: string | null
  hydra_doc_id: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Return all sources ordered by most-recent first.
 */
export function getAllSources(): Source[] {
  return db
    .prepare<[], Source>(
      `SELECT id, url, title, raw_content, processed, created_at
       FROM sources
       ORDER BY created_at DESC`
    )
    .all()
}

/**
 * Return a single source by its primary key, or null if not found.
 */
export function getSourceById(id: number): Source | null {
  return (
    db
      .prepare<[number], Source>(
        `SELECT id, url, title, raw_content, processed, created_at
         FROM sources
         WHERE id = ?`
      )
      .get(id) ?? null
  )
}

/**
 * Insert a new source row and return the inserted record.
 */
export function createSource(data: CreateSourceInput): Source {
  const stmt = db.prepare<[string | null, string | null, string, number]>(
    `INSERT INTO sources (url, title, raw_content, processed)
     VALUES (?, ?, ?, ?)
     RETURNING *`
  )

  const result = stmt.get(
    data.url ?? null,
    data.title ?? null,
    data.raw_content,
    data.processed ?? 0
  ) as Source

  return result
}

/**
 * Mark a source as processed (processed = 1).
 */
export function markSourceProcessed(id: number): void {
  db.prepare<[number]>(`UPDATE sources SET processed = 1 WHERE id = ?`).run(id)
}

//removed getUnprocessedSources function since it's not currently used, but can be re-added if needed in the future.
// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

/**
 * Insert a log entry and return the inserted record.
 */
export function createLog(data: CreateLogInput): Log {
  const stmt = db.prepare<[number | null, number, number, string | null]>(
    `INSERT INTO logs (source_id, pages_created, pages_updated, message)
     VALUES (?, ?, ?, ?)
     RETURNING *`
  )

  const result = stmt.get(
    data.source_id ?? null,
    data.pages_created ?? 0,
    data.pages_updated ?? 0,
    data.message ?? null
  ) as Log

  return result
}

/**
 * Return all log entries, most-recent first.
 */
export function getAllLogs(): Log[] {
  return db
    .prepare<[], Log>(
      `SELECT id, source_id, pages_created, pages_updated, message, created_at
       FROM logs
       ORDER BY created_at DESC`
    )
    .all()
}

//getLogsBySourceId function removed since it's not currently used, but can be re-added if needed in the future.

// ---------------------------------------------------------------------------
// Pages (Wiki Health Deprecation Pipeline)
// ---------------------------------------------------------------------------

export function upsertPageHealth(data: {
  slug: string
  title: string
  type?: string
  summary?: string
  source_id?: number
  confidence?: number
  stale_reason?: string | null
  hydra_doc_id: string
}): void {
  db.prepare(`
    INSERT INTO pages (slug, title, type, summary, source_id, confidence, is_stale, stale_reason, hydra_doc_id, last_validated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      summary = excluded.summary,
      source_id = excluded.source_id,
      confidence = excluded.confidence,
      is_stale = excluded.is_stale,
      stale_reason = excluded.stale_reason,
      hydra_doc_id = excluded.hydra_doc_id,
      last_validated = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    data.slug,
    data.title,
    data.type ?? 'concept',
    data.summary ?? null,
    data.source_id ?? null,
    data.confidence ?? 100,
    data.stale_reason ? 1 : 0,
    data.stale_reason ?? null,
    data.hydra_doc_id
  )
}

export function getAllPages(): PageHealth[] {
  return db.prepare<[], PageHealth>(`SELECT * FROM pages ORDER BY created_at DESC`).all()
}

export function getFlaggedPages(): PageHealth[] {
  return db.prepare<[], PageHealth>(`
    SELECT * FROM pages 
    WHERE is_stale = 1 
    ORDER BY confidence ASC
  `).all()
}

export function getStalePages(olderThanDays = 30): PageHealth[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)
  return db.prepare<[string], PageHealth>(`
    SELECT * FROM pages 
    WHERE last_validated < ? 
    ORDER BY last_validated ASC
  `).all(cutoff.toISOString())
}

export function markPageStale(slug: string, reason: string): void {
  db.prepare<[string, string]>(`
    UPDATE pages SET is_stale = 1, stale_reason = ?, confidence = confidence - 20, updated_at = CURRENT_TIMESTAMP
    WHERE slug = ?
  `).run(reason, slug)
}

// ---------------------------------------------------------------------------
// Page Links (wikilink graph edges)
// ---------------------------------------------------------------------------

export function upsertPageLinks(sourceSlug: string, targetSlugs: string[]): void {
  const stmt = db.prepare<[string, string]>(
    `INSERT OR IGNORE INTO page_links (source_slug, target_slug) VALUES (?, ?)`
  )
  for (const target of targetSlugs) {
    if (target !== sourceSlug) stmt.run(sourceSlug, target)
  }
}

export function getAllPageLinks(): Array<{ source_slug: string; target_slug: string }> {
  return db.prepare(`SELECT source_slug, target_slug FROM page_links`).all() as any[]
}

// ---------------------------------------------------------------------------
// Lint Sweeps
// ---------------------------------------------------------------------------

export function getLastLintTime(): string | null {
  const row = db.prepare(
    `SELECT ran_at FROM lint_sweeps ORDER BY ran_at DESC LIMIT 1`
  ).get() as { ran_at: string } | undefined
  return row?.ran_at ?? null
}

export function recordLintSweep(pagesAnalyzed: number, issuesFound: number): void {
  db.prepare(
    `INSERT INTO lint_sweeps (pages_analyzed, issues_found) VALUES (?, ?)`
  ).run(pagesAnalyzed, issuesFound)
}

export function getPagesUpdatedSince(since: string): PageHealth[] {
  return db.prepare<[string], PageHealth>(
    `SELECT * FROM pages WHERE updated_at > ? ORDER BY updated_at DESC`
  ).all(since)
}

//archivePage and restorePage functions removed since they're not currently used, but can be re-added if needed in the future.