import { AI_CONTEXT_SCHEMA_VERSION } from '../types/ai-context.js';

export interface AIContextConfig {
  schemaVersion: string;
  maxEvidenceEvents: number;
  maxBatchBytes: number;
  generatedAt?: string;
}

export const DEFAULT_AI_CONTEXT_CONFIG: AIContextConfig = {
  schemaVersion: AI_CONTEXT_SCHEMA_VERSION,
  maxEvidenceEvents: 5,
  maxBatchBytes: 100_000
};
