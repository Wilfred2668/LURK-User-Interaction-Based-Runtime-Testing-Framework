# Layer 4 — Application Backend & Read API

Node.js / Express backend service connected to Supabase PostgreSQL for telemetry ingestion, data persistence, analysis pipeline orchestration, and dashboard REST endpoints.

---

## Overview
- **Ingestion & Persistence**: Receives raw finalized telemetry bundles from the Chrome extension and stores normalized entities into Supabase PostgreSQL.
- **Analysis Orchestration**: Fetches page telemetry batches, triggers the Python AI Service (`POST /analyze`), and stores the resulting engineering assessments and structured findings.
- **Secure Read API**: Exposes clean REST API endpoints for sessions, websites, pages, and diagnostics to the frontend without exposing database service role keys to the browser.

---

## Setup & Execution

### Configuration (`.env`)
Create a `.env` file in `application/`:
```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
AI_SERVICE_URL=http://127.0.0.1:8001
```

### Start Server
```bash
# 1. Install dependencies
npm install

# 2. Run backend in development mode with hot reload
npm run dev

# 3. Run automated tests
npm test
```
The REST API runs on `http://localhost:3001`.
