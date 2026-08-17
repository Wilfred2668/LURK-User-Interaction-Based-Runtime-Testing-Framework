import type { AIAnalysisBatch, SampledEvidenceItem } from '../types/ai-context.js';
import type { EngineeringFinding } from '../types/findings.js';

const SEVERITY_REDUCTION_PRIORITY: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4
};

function getBatchByteSize(batch: AIAnalysisBatch): number {
  return new TextEncoder().encode(JSON.stringify(batch)).length;
}

/**
 * Enforces a maximum byte size on an AIAnalysisBatch using priority-based reduction.
 *
 * Immutability Guarantee: Input batch is never mutated.
 * Structural Integrity: The output is ALWAYS valid structured data, never a truncated string.
 */
export function constrainBatchSize(batch: AIAnalysisBatch, maxBytes: number): AIAnalysisBatch {
  let currentBytes = getBatchByteSize(batch);
  if (currentBytes <= maxBytes) {
    return batch;
  }

  // Create a working clone of the batch
  const constrainedBatch: AIAnalysisBatch = {
    ...batch,
    findings: [...batch.findings],
    evidence: [...batch.evidence]
  };

  // Step 1: Reduce sampled evidence arrays in low/info findings
  constrainedBatch.evidence = constrainedBatch.evidence.map((item) => {
    if (item.severity === 'low' || item.severity === 'info') {
      return {
        ...item,
        sampledEventIds: item.sampledEventIds.slice(0, 1),
        representativeData: undefined
      };
    }
    return item;
  });

  currentBytes = getBatchByteSize(constrainedBatch);
  if (currentBytes <= maxBytes) {
    return constrainedBatch;
  }

  // Step 2: Remove low and info findings if still exceeding limit, preserving summary counts
  const highPriorityFindings: EngineeringFinding[] = [];
  const highPriorityEvidence: SampledEvidenceItem[] = [];

  // Sort findings by severity priority (critical & high first)
  const sortedFindings = [...constrainedBatch.findings].sort(
    (a, b) => (SEVERITY_REDUCTION_PRIORITY[a.severity] ?? 99) - (SEVERITY_REDUCTION_PRIORITY[b.severity] ?? 99)
  );

  for (const finding of sortedFindings) {
    const candidateFindings = [...highPriorityFindings, finding];
    const candidateEvidence = constrainedBatch.evidence.filter((e) =>
      candidateFindings.some((f) => f.findingId === e.findingId)
    );

    const testBatch: AIAnalysisBatch = {
      ...constrainedBatch,
      findings: candidateFindings,
      evidence: candidateEvidence
    };

    if (getBatchByteSize(testBatch) <= maxBytes) {
      highPriorityFindings.push(finding);
      highPriorityEvidence.length = 0;
      highPriorityEvidence.push(...candidateEvidence);
    } else {
      // If even the next finding exceeds limit, stop adding lower priority findings
      break;
    }
  }

  return {
    ...constrainedBatch,
    findings: highPriorityFindings,
    evidence: highPriorityEvidence
  };
}
