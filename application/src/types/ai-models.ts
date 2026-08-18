import { Json } from './models.js';

export interface AIAnalysisFindingInput {
  findingId: string;
  findingType: string;
  category: string;
  severity: string;
  title: string;
  observedFact: string;
  possibleInterpretation: string;
  requiredAdditionalContext: string;
  analysis: string;
  confidence?: number | null;
  likelyImpact?: string | null;
  evidence: Record<string, unknown>;
}

export interface AIAnalysisResultPackage {
  batchId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  websiteOrigin: string;
  schemaVersion?: string;
  analysisVersion?: string;
  status?: string;
  summary: string;
  engineeringAssessment?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  findings: AIAnalysisFindingInput[];
}

export interface AIAnalysisBatchRecord {
  batchId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  websiteOrigin: string;
  schemaVersion: string;
  analysisVersion: string;
  status: string;
  summary: string;
  engineeringAssessment: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AIAnalysisFindingRecord {
  findingId: string;
  batchId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  findingType: string;
  category: string;
  severity: string;
  title: string;
  observedFact: string;
  possibleInterpretation: string;
  requiredAdditionalContext: string;
  analysis: string;
  confidence: number | null;
  likelyImpact: string | null;
  evidence: Record<string, unknown>;
  createdAt: string;
}

// Database representations (snake_case)
export interface DatabaseAIAnalysisBatchRow {
  batch_id: string;
  session_id: string;
  website_id: string;
  page_id: string;
  website_origin: string;
  schema_version: string;
  analysis_version: string;
  status: string;
  summary: string;
  engineering_assessment: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DatabaseAIAnalysisFindingRow {
  finding_id: string;
  batch_id: string;
  session_id: string;
  website_id: string;
  page_id: string;
  finding_type: string;
  category: string;
  severity: string;
  title: string;
  observed_fact: string;
  possible_interpretation: string;
  required_additional_context: string;
  analysis: string;
  confidence: number | null;
  likely_impact: string | null;
  evidence: Json;
  created_at: string;
}
