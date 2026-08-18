# Layer 4 — Application Layer: Persistent Data & Read API (Milestones 4A, 4B, 4C)

This module provides the persistent application data layer and REST Read API for the Runtime Monitoring system, backed by **Supabase PostgreSQL** and **Express**.

---

## 1. Relational Hierarchy & Architecture

```
Future Web Frontend Dashboard
               │
               ▼ HTTP Requests (GET /api/...)
┌────────────────────────────────────────────────────────┐
│             Layer 4 Application Read API               │
│                                                        │
│   [Routes Layer: sessions, websites, pages, analysis]  │
│                          │                             │
│                          ▼                             │
│   [Service Layer: QueryService]                        │
│                          │                             │
│                          ▼                             │
│   [Repositories: SessionRepository, AIAnalysisRepo]    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ (Service Role Key - Backend Only)
              ┌────────────────────────┐
              │ Supabase PostgreSQL DB │
              └────────────────────────┘
```

### Key Guarantees
- **Decoupled Frontend Interface**: The frontend communicates strictly with this application API layer. The browser never receives the `SUPABASE_SERVICE_ROLE_KEY` or direct DB access.
- **Strict Hierarchical Isolation**: Verifies that pages belong to their parent website and session, and findings belong to their parent batch/page.
- **Raw Telemetry Untouched**: Original browser telemetry in `runtime_events` is never modified or overwritten by AI analysis findings.
- **Full Traceability**: Every AI finding exposes human-readable observations while preserving complete structured `evidence` in JSONB with `eventIds` and `aggregationId`.
- **Factual Summaries**: Summaries report objective severity and finding-type counts without subjective or uncalibrated percentage ratings.

---

## 2. API Endpoints (Milestone 4C)

### Sessions
- `GET /api/sessions`: Returns a list of persisted monitoring sessions.
- `GET /api/sessions/:sessionId`: Returns a session overview including website count, page count, and finding breakdown.
- `GET /api/sessions/:sessionId/websites`: Returns websites monitored strictly in the session.
- `GET /api/sessions/:sessionId/findings`: Returns findings under the session (supports optional `?severity=` and `?findingType=` filters).

### Websites
- `GET /api/sessions/:sessionId/websites/:websiteId`: Returns website overview and metadata.
- `GET /api/sessions/:sessionId/websites/:websiteId/pages`: Returns pages monitored under the website.
- `GET /api/sessions/:sessionId/websites/:websiteId/findings`: Returns findings strictly under the website (supports optional filters).

### Pages & Detailed Analysis
- `GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId`: Returns page metadata, route count, event count, and finding count.
- `GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/routes`: Returns route transition history for the page.
- `GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/events`: Returns raw runtime events for detailed technical inspection.
- `GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/findings`: Returns AI findings for the page.
- `GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/analysis`: Returns a comprehensive, dashboard-ready page analysis object combining session, website, and page metadata, routes, findings, and severity summaries.

---

## 3. Example Responses

### `GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/analysis`
```json
{
  "session": {
    "sessionId": "sess_20260818_test001",
    "status": "finalized",
    "startedAt": "2026-08-18T10:00:00.000Z",
    "endedAt": "2026-08-18T10:05:00.000Z",
    "durationMs": 300000,
    "rootUrl": "https://www.hidevs.xyz",
    "activeTabId": 101,
    "persistedAt": "2026-08-18T10:05:01.000Z"
  },
  "website": {
    "websiteId": "web_hidevs_001",
    "sessionId": "sess_20260818_test001",
    "origin": "https://www.hidevs.xyz",
    "firstSeenAt": "2026-08-18T10:00:00.000Z",
    "lastSeenAt": "2026-08-18T10:05:00.000Z"
  },
  "page": {
    "pageId": "page_hidevs_interns",
    "sessionId": "sess_20260818_test001",
    "websiteId": "web_hidevs_001",
    "websiteOrigin": "https://www.hidevs.xyz",
    "tabId": 101,
    "url": "https://www.hidevs.xyz/ai-interns",
    "title": "AI Interns - HiDevs",
    "createdAt": "2026-08-18T10:01:00.000Z"
  },
  "routes": [
    {
      "routeId": "route_hidevs_interns_init",
      "sessionId": "sess_20260818_test001",
      "websiteId": "web_hidevs_001",
      "pageId": "page_hidevs_interns",
      "tabId": 101,
      "url": "https://www.hidevs.xyz/ai-interns",
      "path": "/ai-interns",
      "hash": "",
      "timestamp": "2026-08-18T10:01:00.000Z",
      "navigationType": "navigate"
    }
  ],
  "analysisSummary": "Analyzed 3 runtime engineering findings on page https://www.hidevs.xyz/ai-interns.",
  "engineeringAssessment": "Main thread responsiveness is impacted by an 85ms task while network polling repeats 10 times.",
  "findings": [
    {
      "findingId": "fnd_repeated_net_01",
      "batchId": "batch_sess_20260818_test001_web_hidevs_001_page_interns",
      "sessionId": "sess_20260818_test001",
      "websiteId": "web_hidevs_001",
      "pageId": "page_hidevs_interns",
      "findingType": "repeated_network_request",
      "category": "network",
      "severity": "medium",
      "title": "Repeated network request detected",
      "observedFact": "Observed 10 identical GET requests to /api/leaderboard within 3 seconds.",
      "possibleInterpretation": "Rapid interval polling or reactive component loops.",
      "requiredAdditionalContext": "Examine state update triggers in the leaderboard widget.",
      "analysis": "10 GET requests occurred rapidly.",
      "confidence": 0.95,
      "likelyImpact": "Increased backend bandwidth consumption and client CPU overhead.",
      "evidence": {
        "count": 10,
        "url": "https://www.hidevs.xyz/api/leaderboard",
        "method": "GET",
        "status": 200,
        "eventIds": ["evt_net_01", "evt_net_02", "..."],
        "aggregationId": "agg_evt_net_01"
      },
      "createdAt": "2026-08-18T10:02:00.000Z"
    }
  ],
  "totalFindings": 1,
  "severitySummary": {
    "critical": 0,
    "high": 0,
    "medium": 1,
    "low": 0,
    "info": 0
  },
  "findingTypeSummary": {
    "repeated_network_request": 1
  }
}
```

---

## 4. Configuration & CORS

Copy `.env.example` to `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
PORT=3001
APPLICATION_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## 5. Running the Application

### Development Server
```bash
npm run dev
```

### Running Tests & Typecheck
```bash
npm test
npm run typecheck
npm run build
```
