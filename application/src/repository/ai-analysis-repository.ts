import { SupabaseClient } from '@supabase/supabase-js';
import {
  AIAnalysisBatchRecord,
  AIAnalysisFindingRecord,
  AIAnalysisResultPackage,
  DatabaseAIAnalysisBatchRow,
  DatabaseAIAnalysisFindingRow
} from '../types/ai-models.js';
import { Database, Json } from '../types/models.js';
import { validateAIAnalysisResultPackage } from '../validation/validate-ai-analysis.js';

export function rowToAIAnalysisBatchRecord(row: DatabaseAIAnalysisBatchRow): AIAnalysisBatchRecord {
  return {
    batchId: row.batch_id,
    sessionId: row.session_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    websiteOrigin: row.website_origin,
    schemaVersion: row.schema_version,
    analysisVersion: row.analysis_version,
    status: row.status,
    summary: row.summary,
    engineeringAssessment: row.engineering_assessment,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

export function rowToAIAnalysisFindingRecord(row: DatabaseAIAnalysisFindingRow): AIAnalysisFindingRecord {
  return {
    findingId: row.finding_id,
    batchId: row.batch_id,
    sessionId: row.session_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    findingType: row.finding_type,
    category: row.category,
    severity: row.severity,
    title: row.title,
    observedFact: row.observed_fact,
    possibleInterpretation: row.possible_interpretation,
    requiredAdditionalContext: row.required_additional_context,
    analysis: row.analysis,
    confidence: row.confidence,
    likelyImpact: row.likely_impact,
    evidence: (row.evidence as Record<string, unknown>) || {},
    createdAt: row.created_at
  };
}

export class AIAnalysisRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Idempotently persists an AI analysis result package (batch + findings) into Supabase PostgreSQL.
   */
  async saveAnalysisResult(result: AIAnalysisResultPackage): Promise<void> {
    const validated = validateAIAnalysisResultPackage(result);

    const now = new Date().toISOString();
    const batchRow: DatabaseAIAnalysisBatchRow = {
      batch_id: validated.batchId,
      session_id: validated.sessionId,
      website_id: validated.websiteId,
      page_id: validated.pageId,
      website_origin: validated.websiteOrigin,
      schema_version: validated.schemaVersion || '3A.1',
      analysis_version: validated.analysisVersion || '3C.1',
      status: validated.status || 'completed',
      summary: validated.summary,
      engineering_assessment: validated.engineeringAssessment || null,
      created_at: validated.createdAt || now,
      completed_at: validated.completedAt || now
    };

    // 1. Upsert Batch row
    const { error: batchError } = await (this.client as any)
      .from('ai_analysis_batches')
      .upsert(batchRow, { onConflict: 'batch_id' });

    if (batchError) {
      throw new Error(`Failed to persist AI analysis batch: ${batchError.message}`);
    }

    // 2. Upsert Finding rows
    if (validated.findings.length > 0) {
      const findingRows: DatabaseAIAnalysisFindingRow[] = validated.findings.map((f) => ({
        finding_id: f.findingId,
        batch_id: validated.batchId,
        session_id: validated.sessionId,
        website_id: validated.websiteId,
        page_id: validated.pageId,
        finding_type: f.findingType,
        category: f.category,
        severity: f.severity,
        title: f.title,
        observed_fact: f.observedFact,
        possible_interpretation: f.possibleInterpretation,
        required_additional_context: f.requiredAdditionalContext,
        analysis: f.analysis,
        confidence: f.confidence !== undefined ? f.confidence : null,
        likely_impact: f.likelyImpact || null,
        evidence: f.evidence as unknown as Json,
        created_at: now
      }));

      const { error: findingsError } = await (this.client as any)
        .from('ai_analysis_findings')
        .upsert(findingRows, { onConflict: 'finding_id' });

      if (findingsError) {
        throw new Error(`Failed to persist AI analysis findings: ${findingsError.message}`);
      }
    }
  }

  /**
   * Retrieves a single AI analysis batch by batchId.
   */
  async getAnalysisBatch(batchId: string): Promise<AIAnalysisBatchRecord | null> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_batches')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve AI analysis batch: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return rowToAIAnalysisBatchRecord(data);
  }

  /**
   * Retrieves all AI analysis batches for a specific session.
   */
  async getAnalysisBatchesForSession(sessionId: string): Promise<AIAnalysisBatchRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_batches')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve AI analysis batches for session: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisBatchRecord);
  }

  /**
   * Retrieves all AI analysis batches for a specific website within a session.
   */
  async getAnalysisBatchesForWebsite(
    sessionId: string,
    websiteId: string
  ): Promise<AIAnalysisBatchRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_batches')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve AI analysis batches for website: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisBatchRecord);
  }

  /**
   * Retrieves the AI analysis batch for a specific page.
   */
  async getAnalysisBatchForPage(
    sessionId: string,
    websiteId: string,
    pageId: string
  ): Promise<AIAnalysisBatchRecord | null> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_batches')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .eq('page_id', pageId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve AI analysis batch for page: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return rowToAIAnalysisBatchRecord(data);
  }

  /**
   * Retrieves all findings belonging to a specific batch.
   */
  async getFindingsForBatch(batchId: string): Promise<AIAnalysisFindingRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_findings')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve findings for batch: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisFindingRecord);
  }

  /**
   * Retrieves all findings belonging to a specific session.
   */
  async getFindingsForSession(sessionId: string): Promise<AIAnalysisFindingRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_findings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve findings for session: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisFindingRecord);
  }

  /**
   * Retrieves all findings belonging to a specific website within a session.
   */
  async getFindingsForWebsite(
    sessionId: string,
    websiteId: string
  ): Promise<AIAnalysisFindingRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_findings')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve findings for website: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisFindingRecord);
  }

  /**
   * Retrieves findings for a session filtered by severity.
   */
  async getFindingsBySeverity(
    sessionId: string,
    severity: string
  ): Promise<AIAnalysisFindingRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_findings')
      .select('*')
      .eq('session_id', sessionId)
      .eq('severity', severity)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve findings by severity: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisFindingRecord);
  }

  /**
   * Retrieves findings for a session filtered by findingType.
   */
  async getFindingsByType(
    sessionId: string,
    findingType: string
  ): Promise<AIAnalysisFindingRecord[]> {
    const { data, error } = await (this.client as any)
      .from('ai_analysis_findings')
      .select('*')
      .eq('session_id', sessionId)
      .eq('finding_type', findingType)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve findings by type: ${error.message}`);
    }

    return (data || []).map(rowToAIAnalysisFindingRecord);
  }
}
