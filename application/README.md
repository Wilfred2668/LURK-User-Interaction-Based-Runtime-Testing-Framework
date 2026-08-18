# Layer 4 — Application Layer: Persistent Data & AI Results (Milestones 4A & 4B)

This module provides the persistent application data layer for the Runtime Monitoring system, backed by **Supabase PostgreSQL**.

---

## 1. Relational Hierarchy & Architecture

The database manages both raw monitoring telemetry (4A) and derived AI analysis results (4B) in a unified, isolated hierarchy:

```
sessions (session_id PK)
  └── websites (website_id PK, session_id FK, UNIQUE(session_id, origin))
        └── pages (page_id PK, session_id FK, website_id FK)
              ├── routes (route_id PK, session_id FK, website_id FK, page_id FK)
              ├── runtime_events (event_id PK, session_id FK, website_id FK, page_id FK, data JSONB)
              └── ai_analysis_batches (batch_id PK, session_id FK, website_id FK, page_id FK)
                    └── ai_analysis_findings (finding_id PK, batch_id FK, session_id FK, website_id FK, page_id FK, evidence JSONB)
```

### Key Guarantees
- **Raw Telemetry Untouched**: Original browser telemetry in `runtime_events` is never modified or overwritten by AI analysis findings.
- **Full Traceability**: Every AI finding preserves complete structured `evidence` in JSONB, including `eventIds` and `aggregationId`, allowing exact tracing back to raw browser telemetry.
- **Strict Isolation**: AI batches and findings strictly inherit `session_id`, `website_id`, and `page_id`. Cross-website queries are prevented by schema constraints and repository methods.
- **Idempotency**: Repeatedly saving the same session or AI analysis batch produces exactly **one logical copy** in the database with zero duplicate records.

---

## 2. Database Tables & Schema

### A. Raw Telemetry Tables (Milestone 4A)
- `sessions`: Session lifecycle and metadata (`started_at`, `ended_at`, `duration_ms`, `root_url`, `active_tab_id`).
- `websites`: Monitored origins per session (`origin`, `first_seen_at`, `last_seen_at`).
- `pages`: Documents visited (`tab_id`, `url`, `title`, `created_at`).
- `routes`: SPA route transitions (`path`, `hash`, `timestamp`, `navigation_type`).
- `runtime_events`: Complete event payloads in JSONB (`type`, `data`).

### B. AI Analysis Tables (Milestone 4B)
- `ai_analysis_batches`: Page-level AI analysis batch (`schema_version`, `analysis_version`, `status`, `summary`, `engineering_assessment`).
- `ai_analysis_findings`: Derived findings from AI inference (`finding_type`, `category`, `severity`, `title`, `observed_fact`, `possible_interpretation`, `required_additional_context`, `analysis`, `confidence`, `likely_impact`, `evidence` JSONB).

---

## 3. Repositories

### `SessionRepository`
- `saveFinalizedSession(pkg: RawFinalizedSessionPackage): Promise<void>`
- `getSession(sessionId: string): Promise<SessionRecord | null>`
- `listSessions(): Promise<SessionRecord[]>`
- `getWebsitesForSession(sessionId: string): Promise<WebsiteRecord[]>`
- `getPagesForWebsite(sessionId: string, websiteId: string): Promise<PageRecord[]>`
- `getRoutesForPage(sessionId: string, websiteId: string, pageId: string): Promise<RouteRecord[]>`
- `getEventsForPage(sessionId: string, websiteId: string, pageId: string): Promise<RuntimeEventRecord[]>`

### `AIAnalysisRepository`
- `saveAnalysisResult(result: AIAnalysisResultPackage): Promise<void>`
- `getAnalysisBatch(batchId: string): Promise<AIAnalysisBatchRecord | null>`
- `getAnalysisBatchesForSession(sessionId: string): Promise<AIAnalysisBatchRecord[]>`
- `getAnalysisBatchesForWebsite(sessionId: string, websiteId: string): Promise<AIAnalysisBatchRecord[]>`
- `getAnalysisBatchForPage(sessionId: string, websiteId: string, pageId: string): Promise<AIAnalysisBatchRecord | null>`
- `getFindingsForBatch(batchId: string): Promise<AIAnalysisFindingRecord[]>`
- `getFindingsForSession(sessionId: string): Promise<AIAnalysisFindingRecord[]>`
- `getFindingsForWebsite(sessionId: string, websiteId: string): Promise<AIAnalysisFindingRecord[]>`
- `getFindingsBySeverity(sessionId: string, severity: string): Promise<AIAnalysisFindingRecord[]>`
- `getFindingsByType(sessionId: string, findingType: string): Promise<AIAnalysisFindingRecord[]>`

---

## 4. Supabase Setup & Migrations

Execute the migration scripts in order in the Supabase SQL Editor:
1. `supabase/migrations/20260818000000_create_monitoring_schema.sql` (Raw Telemetry)
2. `supabase/migrations/20260818000001_create_ai_analysis_schema.sql` (AI Analysis Results)

---

## 5. Running Tests & Verification

```bash
cd application
npm install
npm test
npm run typecheck
npm run build
```
