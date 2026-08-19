# Layer 5 — LURK Dashboard (Frontend)

Modern developer dashboard built with **React**, **TypeScript**, and **Vite** for visualizing runtime session telemetry, correlated anomalies, and AI engineering diagnostics.

---

## Overview
- **Session Intelligence**: Displays captured monitoring sessions, duration metrics, monitored origins, and visited pages.
- **Fixed-Frame Two-Panel Diagnostics**: Provides folder-tab navigation (`Errors`, `Network`, `Performance`) with dedicated scrollable lists and pinned page diagnostics.
- **On-Demand AI Analysis**: Supports selecting individual or multiple pages to run AI diagnostics and view synthesized engineering assessments.
- **Clean HTML5 Routing**: Full support for clean path and query parameter URLs (`/session?id=...`, `/page?sessionId=...&websiteId=...&pageId=...`, `/analyze?sessionId=...`) with zero hash `#` artifacts.

---

## Setup & Execution

```bash
# 1. Install dependencies
npm install

# 2. Start local Vite development server
npm run dev

# 3. Run automated tests
npm test

# 4. Build optimized production bundle
npm run build
```
Dashboard will be available at `http://localhost:3000`.
