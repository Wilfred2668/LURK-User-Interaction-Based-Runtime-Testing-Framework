# Layer 2 — Runtime Monitoring Data Processing

This module is the Layer 2 processing foundation for the Runtime Monitoring system. It ingests finalized raw monitoring session packages produced by the Chrome Extension (Layer 1) and transforms them into clean, self-contained, normalized structures.

## Architecture Principles

1. **Read-Only / Immutability**: The raw input data from Layer 1 is treated as the immutable source of truth and is never modified.
2. **1:1 Preservation (No Aggregation)**: Raw observations (console, network, performance) remain individual events without grouping or loss of payload fidelity.
3. **Explicit Context**: Every normalized event and route embeds complete hierarchical bindings (`sessionId`, `websiteId`, `websiteOrigin`, `pageId`, `routeId`, `tabId`).
4. **Deterministic**: Normalization produces repeatable, stable output with identical event sorting.

## Usage

```typescript
import {
  normalizeSession,
  validateSessionPackage,
  aggregateSession,
  extractInsights,
  prepareWebsiteBatches,
  preparePageBatch
} from './src/index.js';

// 1. Validate a finalized raw session package
const validation = validateSessionPackage(rawSessionPackage);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// 2. Normalize the raw session package
const normalized = normalizeSession(rawSessionPackage);

// 3. Aggregate repeated patterns within a configurable time window
const aggregated = aggregateSession(normalized, { windowMs: 5000 });

// 4. Extract deterministic, evidence-backed engineering findings
const insights = extractInsights(aggregated);

// 5. Prepare page-wise AI analysis batches for a selected website
const pageBatches = prepareWebsiteBatches(insights, 'web_hidevs_01');
console.log(`Prepared ${pageBatches.length} page batches for AI analysis:`, pageBatches);
```

## Running Tests & Build

```bash
# Run test suite (106 unit & integration tests across Layer 2 & 3A)
npm test

# Build TypeScript
npm run build
```

