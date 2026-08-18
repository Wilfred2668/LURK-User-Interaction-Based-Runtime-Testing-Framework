# Layer 4 — Frontend Dashboard: RuntimeLens (Milestone 4D)

RuntimeLens is a modern, minimalist developer dashboard built with **React**, **TypeScript**, and **Vite**. It provides human-readable visibility into browser runtime telemetry, deterministic engineering findings, and a user-controlled AI analysis workflow.

---

## 1. Architecture & Security Guarantees

```
Chrome Extension (1A-1I)
    │ (Raw telemetry)
    ▼
Supabase PostgreSQL (4A)
    │
    ▼ (HTTP Read API)
[Application Read API] (4C) ◄────────┐
    │                                │ User selects pages & clicks
    ▼                                │ "Start AI Analysis"
[RuntimeLens Frontend (4D)] ─────────┘
    │
    ▼ (POST /api/sessions/:sessionId/analyze)
[Application Orchestration Service]
    │
    ├──► [data-processing] (Prepare 3A AIContextBatch)
    │
    ├──► [ai-service] (Python FastAPI / Groq 3C analysis)
    │
    ▼ (Idempotent save)
[Supabase ai_analysis_batches / findings] (4B)
    │
    ▼
[Frontend Page Analysis View (4D)]
```

### Security Isolation
- **Decoupled Backend Access**: The frontend communicates strictly with the backend Application Read API (`/api/...`).
- **Zero Exposed Secrets**: `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, database connection strings, and LLM credentials are never bundled into client assets or `VITE_*` environment variables.

---

## 2. Minimalist SaaS Aesthetics & Design System

- **Monochrome Foundation**: `#FAFAFA` app background, `#FFFFFF` cards, `#171717` primary typography, `#737373` secondary text, `#E5E5E5` subtle borders.
- **Restrained Accent**: Subtle Indigo (`#4F46E5` / `#6366F1`) used sparingly for key interactive highlights.
- **Calibrated Severity Badges**: Soft backgrounds and distinct dots (`critical/high` soft red, `medium` soft amber, `low/info` soft slate) preventing loud dashboard visual fatigue.
- **Spacious & Developer-Focused**: Clean Inter typography, generous whitespace, and focused information density.

---

## 3. Core Screens & Navigation

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | **Overview** | High-level metrics, recent monitoring sessions table, quick stats |
| `/sessions` | **Sessions List** | Filterable list of captured sessions with duration, origin, and status |
| `/sessions/:sessionId` | **Session Detail** | Detailed overview of monitored websites, page counts, and deterministic findings |
| `/sessions/:sessionId/analyze` | **Analysis Selection** | Interactive tree allowing page-by-page selection for AI analysis |
| `/sessions/:sessionId/websites/:websiteId` | **Website Detail** | Monitored origin summary with pages and route transition breakdown |
| `/sessions/:sessionId/websites/:websiteId/pages/:pageId` | **Page Analysis** | Human-readable AI finding cards with expandable technical evidence drawers |
| `/settings` | **Settings & Status** | System status, API connection indicator, and security boundary verification |

---

## 4. User-Controlled AI Analysis Workflow

1. **Automatic Detection**: Deterministic engineering findings (repeated requests, HTTP errors, long tasks) are detected automatically during data processing.
2. **Review & Selection**: The user opens `/sessions/:sessionId/analyze`, reviews available pages and findings, and checks the pages they want analyzed.
3. **Explicit Trigger**: The user clicks **"Start AI Analysis"** (disabled when 0 pages selected).
4. **Targeted Inference**: The backend sends only the selected pages to the Python AI service / Groq provider.
5. **Human-Readable Presentation**: The resulting page analysis presents clear observed facts, possible interpretations, and likely impacts, with raw `eventIds` and aggregation IDs tucked cleanly into a collapsible **"View Technical Evidence"** drawer.

---

## 5. Development & Testing

### Installation
```bash
cd frontend
npm install
```

### Start Development Server
```bash
npm run dev
# Running on http://localhost:3000 (proxies /api to http://localhost:3001)
```

### Run Tests & Build
```bash
npm test
npm run typecheck
npm run build
```
