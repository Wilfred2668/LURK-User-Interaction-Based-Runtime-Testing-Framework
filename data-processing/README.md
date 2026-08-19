# Layer 2 — Deterministic Data Processing Engine

Pure TypeScript processing engine that ingests raw telemetry from the browser extension, normalizes session records, and executes deterministic rule-based algorithms to detect runtime findings.

---

## Overview
- **Validation & Normalization**: Validates raw session packages and produces immutable, normalized structures with consistent IDs and hierarchical bindings (`sessionId`, `websiteId`, `pageId`, `routeId`).
- **Interaction Correlation**: Correlates runtime exceptions and slow network responses with preceding user interactions (e.g. clicking a button within 1000ms prior to the failure).
- **Deterministic Pattern Detection**: Identifies repeated network calls, unhandled promise rejections, 4xx/5xx HTTP errors, and main-thread blocking bottlenecks.
- **Batch Preparation**: Structures normalized findings into self-contained page-wise batches ready for AI diagnostic ingestion.

---

## Test & Build

```bash
# 1. Install dependencies
npm install

# 2. Run automated unit & integration test suite
npm test

# 3. Compile TypeScript to JavaScript
npm run build
```
