# NeuroWiki

> Your personal AI-powered Wikipedia. Add any source — URL, PDF, or text —
> and an AI agent automatically builds, maintains, and interlinks a
> living knowledge base that gets smarter with everything you add.

---

## What It Does

NeuroWiki solves the core problem Andrej Karpathy identified: normal RAG
re-derives knowledge from scratch every query. NeuroWiki compiles your
sources into a persistent, interlinked wiki once — then answers from it
cheaply, forever.

Every time you add a source:
1. Gemini reads and extracts verified, cited knowledge
2. HydraDB builds a context graph automatically
3. A consistency agent checks for contradictions with existing pages
4. Pages are interlinked with `[[wikilinks]]` and connected in a graph
5. The wiki gets smarter — it never forgets, and it knows when it's wrong

---

## Tech Stack

| Layer | Tool | Version | Purpose |
|-------|------|---------|---------|
| Framework | Next.js (App Router) | 15.5.18 | Full-stack — frontend + API routes |
| Language | TypeScript | 5 | End-to-end type safety |
| Styling | Tailwind CSS + shadcn/ui | v4 | Utility-first + pre-built components |
| Fonts | Almarai + Instrument Serif | — | Cinematic dark UI |
| Animation | Framer Motion | 12 | Page transitions, stagger animations |
| AI Model | Google Gemini 2.0 Flash | — | Page generation, Q&A, consistency checks |
| AI SDK | Vercel AI SDK (@ai-sdk/google) | 3.x | Streaming, generateObject, structured output |
| Knowledge Store | HydraDB (@hydradb/sdk) | 0.0.3 | Entity graph, hybrid recall, vector search |
| Local DB | SQLite (better-sqlite3) | 12.x | Metadata, logs, health, relationships |
| Graph View | react-force-graph-2d | 1.29 | D3-force interactive knowledge graph |
| Markdown | react-markdown + remark-gfm | 10.x | Wiki rendering with wikilink support |
| Validation | Zod | 4.x | AI response validation, hallucination guard |
| Toasts | Sonner | 2.x | Real-time ingest feedback |
| Deployment | Google Cloud Run | — | Serverless, scales to zero |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Interface                             │
│                                                                     │
│  /ingest      /wiki      /search     /graph     /audit   /sources  │
│    │            │           │           │          │         │      │
└────┼────────────┼───────────┼───────────┼──────────┼─────────┼──────┘
     │            │           │           │          │         │
     ▼            ▼           ▼           ▼          ▼         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js API Routes                           │
│                                                                     │
│  /api/ingest  /api/wiki  /api/query  /api/graph  /api/audit        │
│  /api/repair  /api/lint  /api/export /api/logs   /api/sources      │
│  /api/wiki/synthesize    /api/fix-islands        /api/query-logs   │
└───────────────┬──────────────────────┬────────────────────────────-┘
                │                      │
        ┌───────▼───────┐      ┌───────▼───────┐
        │  AI Agents    │      │  Dual Storage  │
        │               │      │               │
        │ ingest-agent  │      │  ┌──────────┐ │
        │ absorb-agent  │◄────►│  │ HydraDB  │ │  Vector + Graph
        │ consist-agent │      │  │ (cloud)  │ │  Hybrid recall
        │ lint-agent    │      │  └──────────┘ │
        │               │      │  ┌──────────┐ │
        │ Gemini 2.0    │      │  │  SQLite  │ │  Metadata + Logs
        │ Flash via     │      │  │ (local)  │ │  Health + Links
        │ Vercel AI SDK │      │  └──────────┘ │
        └───────────────┘      └───────────────┘
```

---

### Ingest Pipeline

```
Source Input (URL / PDF / DOCX / TXT / plain text)
        │
        ▼
┌───────────────────┐
│  Content Parsing  │  article-extractor → pdf-parse → mammoth → raw text
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  SQLite: sources  │  INSERT INTO sources (url, title, raw_content)
└────────┬──────────┘
         │
         ▼
┌────────────────────────────────────────────────────┐
│                  ingest-agent.ts                   │
│                                                    │
│  1. Fetch existing wiki index from HydraDB (≤100)  │
│  2. Gemini generateObject → 2–5 wiki pages         │
│     • slug, title, type, summary, content          │
│     • sourceSentences (exact quotes, verified)     │
│  3. Hallucination check (60% word-match threshold) │
│  4. absorb-agent: merge if slug already exists     │
│  5. HydraDB upload.knowledge (upsert: true)        │
│  6. waitForIngestion → poll indexing status        │
│  7. SQLite: upsertPageHealth + upsertPageLinks     │
│     • on SQLite error → enqueueReindex             │
│  8. Enrich 2 related pages via fullRecall          │
│  9. consistency-agent: detect contradictions       │
└────────────────────┬───────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
  HydraDB (graph +          SQLite pages table
  vector index)             (slug, type, health,
                             confidence, links)
```

---

### Query / Recall Flow

```
User Question
      │
      ▼
┌─────────────────────────────────────────┐
│            /api/query (POST)            │
│                                         │
│  Strategy 1: Graph-Aware Recall         │
│    hydra.recall.fullRecall              │
│    graph_context: true, max 8 chunks    │
│             │                           │
│             │ if empty                  │
│             ▼                           │
│  Strategy 2: Pure Vector Recall         │
│    fullRecall without graph context     │
│    max 6 chunks                         │
│             │                           │
│             │ if empty                  │
│             ▼                           │
│  Strategy 3: SQLite Keyword Search      │
│    LIKE match on title + summary        │
│    max 6 pages                          │
└──────────────┬──────────────────────────┘
               │
               ▼
     Gemini 2.0 Flash (streamText)
     System: "Answer only from wiki, cite sources"
     Max tokens: 600
               │
               ▼
     Streamed response to client
     + INSERT INTO query_logs
```

---

### Database Schema

**SQLite** (`data/wiki.db`, WAL mode)

```
sources          logs             pages
────────         ────────         ────────
id               id               id
url              source_id        slug (UNIQUE)
title            pages_created    title
raw_content      pages_updated    type
processed        message          summary
created_at       created_at       source_id
                                  confidence
page_links       query_logs       last_validated
────────         ────────         is_stale
source_slug      id               stale_reason
target_slug      question         hydra_doc_id
                 pages_considered created_at
reindex_queue    pages_used       updated_at
────────         answer_length
id               recall_strategy  lint_sweeps
hydra_id (UQ)    created_at       ────────
attempts                          id
created_at                        ran_at
                                  pages_analyzed
                                  issues_found
```

**HydraDB** (cloud, tenant: `default`)

Each document stores:
```json
{
  "id": "<slug>",
  "title": "Page Title",
  "type": "document",
  "content": { "markdown": "# Title\n\n..." },
  "document_metadata": {
    "slug": "page-slug",
    "category": "concept|person|place|event|tool|organization",
    "summary": "One sentence.",
    "sourceSentences": ["exact quote from source..."],
    "verified": true,
    "verifiedAt": "2025-01-01T00:00:00Z",
    "sourceId": 42
  }
}
```

---

### AI Agents

| Agent | File | Responsibility |
|-------|------|---------------|
| **Ingest Agent** | `lib/agents/ingest-agent.ts` | Orchestrates full pipeline: extract → verify → upload → index |
| **Absorb Agent** | `lib/agents/absorb-agent.ts` | Merges new knowledge into existing pages without duplication |
| **Consistency Agent** | `lib/agents/consistency-agent.ts` | Detects contradictions between new and existing wiki pages |
| **Lint Agent** | `lib/agents/lint-agent.ts` | Audits graph health: orphans, islands, gaps, stale pages |

All agents use `withGeminiRetry()` — exponential backoff (15s / 30s / 60s) with API-specified retry-after parsing.

---

### Pages & Routes

| Route | Purpose |
|-------|---------|
| `/` | Home — hero, recent pages, quick ingest CTA |
| `/ingest` | Add sources (URL, text, PDF/DOCX/TXT, bulk URLs) with streaming progress |
| `/wiki` | Browse all pages — filter by type, search |
| `/wiki/[slug]` | Read page — markdown render, TOC, related pages, backlinks |
| `/wiki/[slug]/edit` | Edit title, type, summary, content (Cmd+S to save) |
| `/search` | Dual mode: vector search pages or ask AI (graph-aware Q&A) |
| `/graph` | D3-force knowledge graph — zoom, filter by type, click to open page |
| `/audit` | Wiki health — stale pages, flagged pages, missing stubs, lint sweep |
| `/sources` | Source library — view, delete, re-ingest all raw sources |
| `/about` | Project info |

---

## Environment Variables

```bash
# Required
HYDRADB_API_KEY=                  # HydraDB cloud API key
GOOGLE_GENERATIVE_AI_API_KEY=     # Google AI Studio API key (Gemini)
```

---

## Local Development

```bash
# Install dependencies
npm install

# Add environment variables
cp .env.example .env.local
# Fill in HYDRADB_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY

# Run dev server
npm run dev
```

SQLite database is auto-created at `data/wiki.db` on first run. No migrations needed.

---

## Key Design Decisions

**Why dual storage (SQLite + HydraDB)?**
HydraDB handles vector search and graph-aware recall — things SQLite can't do. SQLite handles metadata, health tracking, logs, and page links — things that need to be fast, synchronous, and local. Each does what it's best at.

**Why compile to a wiki instead of raw RAG?**
Raw RAG re-derives answers from chunks every query. NeuroWiki extracts knowledge once, stores it as structured wiki pages, and answers from that. Cheaper, faster, and the answer improves as the wiki grows — not just as the source corpus grows.

**Why Gemini 2.0 Flash?**
Fast enough for streaming ingest. Structured output via `generateObject` with Zod schemas prevents hallucinations at the schema level. The consistency agent can run post-ingest without blocking the user.

**Why stream the ingest response?**
Ingest can take 10–30 seconds. Streaming real-time step messages (parsing → analyzing → writing → linking → indexing) prevents the user from thinking the page hung.
