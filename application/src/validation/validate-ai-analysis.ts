import { z } from 'zod';
import { AIAnalysisResultPackage } from '../types/ai-models.js';

export const AIAnalysisFindingSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);

export const AIAnalysisFindingInputSchema = z.object({
  findingId: z.string().min(1, 'findingId must not be empty'),
  findingType: z.string().min(1, 'findingType must not be empty'),
  category: z.string().min(1, 'category must not be empty'),
  severity: AIAnalysisFindingSeveritySchema,
  title: z.string().min(1, 'title must not be empty'),
  observedFact: z.string().min(1, 'observedFact must not be empty'),
  possibleInterpretation: z.string(),
  requiredAdditionalContext: z.string(),
  analysis: z.string().min(1, 'analysis must not be empty'),
  confidence: z.number().min(0).max(1).nullable().optional(),
  likelyImpact: z.string().nullable().optional(),
  evidence: z.record(z.unknown())
});

export const AIAnalysisResultPackageSchema = z.object({
  batchId: z.string().min(1, 'batchId must not be empty'),
  sessionId: z.string().min(1, 'sessionId must not be empty'),
  websiteId: z.string().min(1, 'websiteId must not be empty'),
  pageId: z.string().min(1, 'pageId must not be empty'),
  websiteOrigin: z.string().refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
    message: 'websiteOrigin must start with http:// or https://'
  }),
  schemaVersion: z.string().default('3A.1'),
  analysisVersion: z.string().default('3C.1'),
  status: z.string().min(1, 'status must not be empty').default('completed'),
  summary: z.string().min(1, 'summary must not be empty'),
  engineeringAssessment: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  findings: z.array(AIAnalysisFindingInputSchema)
});

export function validateAIAnalysisResultPackage(input: unknown): AIAnalysisResultPackage {
  const parsed = AIAnalysisResultPackageSchema.parse(input);
  return parsed as AIAnalysisResultPackage;
}
