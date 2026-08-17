# Layer 2 — Runtime Monitoring Data Processing

This module is the Layer 2 processing foundation for the Runtime Monitoring system. It ingests finalized raw monitoring session packages produced by the Chrome Extension (Layer 1) and transforms them into clean, self-contained, normalized structures.

## Architecture Principles

1. **Read-Only / Immutability**: The raw input data from Layer 1 is treated as the immutable source of truth and is never modified.
2. **1:1 Preservation (No Aggregation)**: Raw observations (console, network, performance) remain individual events without grouping or loss of payload fidelity.
3. **Explicit Context**: Every normalized event and route embeds complete hierarchical bindings (`sessionId`, `websiteId`, `websiteOrigin`, `pageId`, `routeId`, `tabId`).
4. **Deterministic**: Normalization produces repeatable, stable output with identical event sorting.

## Usage

```typescript
import { normalizeSession, validateSessionPackage } from './src/index.js';

// Validate a finalized raw session package
const validation = validateSessionPackage(rawSessionPackage);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Normalize the session package
const normalized = normalizeSession(rawSessionPackage);
console.log(normalized.session, normalized.websites, normalized.events);
```

## Running Tests & Build

```bash
# Run test suite
npm test

# Build TypeScript
npm run build
```
