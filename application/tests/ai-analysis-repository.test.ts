import { describe, it, expect, beforeEach } from 'vitest';
import { AIAnalysisRepository } from '../src/repository/ai-analysis-repository.js';
import { SessionRepository } from '../src/repository/session-repository.js';
import { createMockSupabaseClient } from './mock-supabase.js';
import { createSampleFinalizedSession } from './fixtures/sample-session.js';
import { createSampleAIAnalysisResult } from './fixtures/sample-ai-analysis.js';
import { AIAnalysisResultPackage } from '../src/types/ai-models.js';

describe('Milestone 4B — AIAnalysisRepository', () => {
  let client: ReturnType<typeof createMockSupabaseClient>;
  let aiRepo: AIAnalysisRepository;
  let sessionRepo: SessionRepository;

  beforeEach(async () => {
    client = createMockSupabaseClient();
    aiRepo = new AIAnalysisRepository(client);
    sessionRepo = new SessionRepository(client);

    // Seed session, websites, pages, routes, events from 4A
    const rawSession = createSampleFinalizedSession();
    await sessionRepo.saveFinalizedSession(rawSession);
  });

  // TEST 1 — Save valid AI analysis result
  it('TEST 1: should save a valid AI analysis result package', async () => {
    const pkg = createSampleAIAnalysisResult();
    await expect(aiRepo.saveAnalysisResult(pkg)).resolves.not.toThrow();
  });

  // TEST 2 — Retrieve saved analysis batch
  it('TEST 2: should retrieve the saved analysis batch by batchId', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const batch = await aiRepo.getAnalysisBatch(pkg.batchId);
    expect(batch).not.toBeNull();
    expect(batch?.batchId).toBe(pkg.batchId);
    expect(batch?.sessionId).toBe(pkg.sessionId);
    expect(batch?.pageId).toBe(pkg.pageId);
    expect(batch?.status).toBe('completed');
  });

  // TEST 3 — Preserve exact batch metadata
  it('TEST 3: should preserve exact batch metadata', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const batch = await aiRepo.getAnalysisBatch(pkg.batchId);
    expect(batch?.websiteOrigin).toBe('https://www.hidevs.xyz');
    expect(batch?.schemaVersion).toBe('3A.1');
    expect(batch?.analysisVersion).toBe('3C.1');
    expect(batch?.summary).toBe(pkg.summary);
    expect(batch?.engineeringAssessment).toBe(pkg.engineeringAssessment);
    expect(batch?.createdAt).toBe(pkg.createdAt);
  });

  // TEST 4 — Persist multiple findings
  it('TEST 4: should persist multiple findings under the batch', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const findings = await aiRepo.getFindingsForBatch(pkg.batchId);
    expect(findings).toHaveLength(3);
    expect(findings.map((f) => f.findingId)).toEqual([
      'fnd_repeated_net_01',
      'fnd_failed_net_02',
      'fnd_long_task_03'
    ]);
  });

  // TEST 5 — Preserve complete finding fields
  it('TEST 5: should preserve all structured finding fields', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const findings = await aiRepo.getFindingsForBatch(pkg.batchId);
    const f1 = findings.find((f) => f.findingId === 'fnd_repeated_net_01')!;

    expect(f1.findingType).toBe('repeated_network_request');
    expect(f1.category).toBe('network');
    expect(f1.severity).toBe('medium');
    expect(f1.title).toBe('Repeated network request detected');
    expect(f1.observedFact).toContain('10 identical GET requests');
    expect(f1.possibleInterpretation).toContain('Rapid interval polling');
    expect(f1.requiredAdditionalContext).toContain('Examine state update triggers');
    expect(f1.analysis).toBe('10 GET requests occurred rapidly.');
    expect(f1.confidence).toBe(0.95);
    expect(f1.likelyImpact).toContain('Increased backend bandwidth');
  });

  // TEST 6 — Preserve complete evidence JSONB
  it('TEST 6: should preserve the complete raw evidence JSONB without data loss', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const findings = await aiRepo.getFindingsForBatch(pkg.batchId);
    const f1 = findings.find((f) => f.findingId === 'fnd_repeated_net_01')!;

    expect(f1.evidence['count']).toBe(10);
    expect(f1.evidence['url']).toBe('https://www.hidevs.xyz/api/leaderboard');
    expect(f1.evidence['method']).toBe('GET');
    expect(f1.evidence['status']).toBe(200);
    expect(f1.evidence['aggregationId']).toBe('agg_evt_net_01');
    expect(f1.evidence['eventIds']).toEqual([
      'evt_net_01', 'evt_net_02', 'evt_net_03', 'evt_net_04', 'evt_net_05',
      'evt_net_06', 'evt_net_07', 'evt_net_08', 'evt_net_09', 'evt_net_10'
    ]);
  });

  // TEST 7 — Correct session association
  it('TEST 7: should retrieve all batches belonging to a specific session', async () => {
    const pkg1 = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg1);

    const batches = await aiRepo.getAnalysisBatchesForSession(pkg1.sessionId);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.sessionId).toBe(pkg1.sessionId);
  });

  // TEST 8 — Correct website association
  it('TEST 8: should retrieve all batches belonging to a specific website', async () => {
    const pkg1 = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg1);

    const batches = await aiRepo.getAnalysisBatchesForWebsite(pkg1.sessionId, 'web_hidevs_001');
    expect(batches).toHaveLength(1);
    expect(batches[0]?.websiteId).toBe('web_hidevs_001');
  });

  // TEST 9 — Correct page association
  it('TEST 9: should retrieve the specific batch for a page', async () => {
    const pkg1 = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg1);

    const batch = await aiRepo.getAnalysisBatchForPage(pkg1.sessionId, 'web_hidevs_001', 'page_hidevs_interns');
    expect(batch?.pageId).toBe('page_hidevs_interns');
  });

  // TEST 10 — Strict website isolation
  it('TEST 10: should not return batches from other websites', async () => {
    const pkg1 = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg1);

    const githubBatches = await aiRepo.getAnalysisBatchesForWebsite(pkg1.sessionId, 'web_github_002');
    expect(githubBatches).toHaveLength(0);
  });

  // TEST 11 — Strict page isolation
  it('TEST 11: should not return batches from other pages', async () => {
    const pkg1 = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg1);

    const homeBatch = await aiRepo.getAnalysisBatchForPage(pkg1.sessionId, 'web_hidevs_001', 'page_hidevs_home');
    expect(homeBatch).toBeNull();
  });

  // TEST 12 — Strict session isolation
  it('TEST 12: should not return batches from other sessions', async () => {
    const pkg1 = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg1);

    const otherBatches = await aiRepo.getAnalysisBatchesForSession('sess_different_999');
    expect(otherBatches).toHaveLength(0);
  });

  // TEST 13 — Idempotent repeated batch save
  it('TEST 13: should be idempotent when saving the exact same batch repeatedly', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);
    await aiRepo.saveAnalysisResult(pkg);
    await aiRepo.saveAnalysisResult(pkg);

    const batches = await aiRepo.getAnalysisBatchesForSession(pkg.sessionId);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.batchId).toBe(pkg.batchId);
  });

  // TEST 14 — Idempotent repeated finding save
  it('TEST 14: should not create duplicate findings on repeated saves', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);
    await aiRepo.saveAnalysisResult(pkg);

    const findings = await aiRepo.getFindingsForBatch(pkg.batchId);
    expect(findings).toHaveLength(3);
  });

  // TEST 15 — Empty findings batch
  it('TEST 15: should save and retrieve a batch with no findings', async () => {
    const pkg = createSampleAIAnalysisResult({
      batchId: 'batch_empty_findings',
      summary: 'No issues found on page.',
      findings: []
    });
    await aiRepo.saveAnalysisResult(pkg);

    const batch = await aiRepo.getAnalysisBatch('batch_empty_findings');
    const findings = await aiRepo.getFindingsForBatch('batch_empty_findings');

    expect(batch).not.toBeNull();
    expect(findings).toHaveLength(0);
  });

  // TEST 16 — Invalid batch rejected
  it('TEST 16: should reject an invalid batch with missing batchId', async () => {
    const pkg = createSampleAIAnalysisResult({ batchId: '' });
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 17 — Invalid finding rejected
  it('TEST 17: should reject a finding with missing findingId', async () => {
    const pkg = createSampleAIAnalysisResult();
    pkg.findings[0]!.findingId = '';
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 18 — Invalid severity rejected
  it('TEST 18: should reject a finding with invalid severity', async () => {
    const pkg = createSampleAIAnalysisResult();
    (pkg.findings[0] as unknown as { severity: string }).severity = 'extreme_danger';
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 19 — Invalid findingType rejected
  it('TEST 19: should reject a finding with empty findingType', async () => {
    const pkg = createSampleAIAnalysisResult();
    pkg.findings[0]!.findingType = '';
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 20 — Invalid website origin rejected
  it('TEST 20: should reject a batch with invalid websiteOrigin protocol', async () => {
    const pkg = createSampleAIAnalysisResult({ websiteOrigin: 'file:///local/path' });
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow(/websiteOrigin must start with http/);
  });

  // TEST 21 — Cross-session association rejected
  it('TEST 21: should reject cross-session mismatch if sessionId is empty', async () => {
    const pkg = createSampleAIAnalysisResult({ sessionId: '' });
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 22 — Cross-website association rejected
  it('TEST 22: should reject cross-website mismatch if websiteId is empty', async () => {
    const pkg = createSampleAIAnalysisResult({ websiteId: '' });
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 23 — Cross-page association rejected
  it('TEST 23: should reject cross-page mismatch if pageId is empty', async () => {
    const pkg = createSampleAIAnalysisResult({ pageId: '' });
    await expect(aiRepo.saveAnalysisResult(pkg)).rejects.toThrow();
  });

  // TEST 24 — Input object is not mutated
  it('TEST 24: should not mutate the input AI analysis package', async () => {
    const pkg = createSampleAIAnalysisResult();
    const pkgClone: AIAnalysisResultPackage = JSON.parse(JSON.stringify(pkg));

    await aiRepo.saveAnalysisResult(pkg);
    expect(pkg).toEqual(pkgClone);
  });

  // TEST 25 — Deterministic retrieval
  it('TEST 25: should return deterministic results across multiple retrieval calls', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const res1 = await aiRepo.getFindingsForBatch(pkg.batchId);
    const res2 = await aiRepo.getFindingsForBatch(pkg.batchId);

    expect(res1).toEqual(res2);
  });

  // TEST 26 — Query findings by severity
  it('TEST 26: should query findings filtered by severity', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const mediumFindings = await aiRepo.getFindingsBySeverity(pkg.sessionId, 'medium');
    const lowFindings = await aiRepo.getFindingsBySeverity(pkg.sessionId, 'low');
    const highFindings = await aiRepo.getFindingsBySeverity(pkg.sessionId, 'high');

    expect(mediumFindings).toHaveLength(2);
    expect(lowFindings).toHaveLength(1);
    expect(highFindings).toHaveLength(0);
  });

  // TEST 27 — Query findings by findingType
  it('TEST 27: should query findings filtered by findingType', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const netFindings = await aiRepo.getFindingsByType(pkg.sessionId, 'repeated_network_request');
    const longTaskFindings = await aiRepo.getFindingsByType(pkg.sessionId, 'long_task');

    expect(netFindings).toHaveLength(1);
    expect(netFindings[0]?.findingId).toBe('fnd_repeated_net_01');
    expect(longTaskFindings).toHaveLength(1);
    expect(longTaskFindings[0]?.findingId).toBe('fnd_long_task_03');
  });

  // TEST 28 — Full hierarchy retrieval
  it('TEST 28: should retrieve all findings under a specific website across all pages', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    const webFindings = await aiRepo.getFindingsForWebsite(pkg.sessionId, 'web_hidevs_001');
    expect(webFindings).toHaveLength(3);
  });

  // TEST 29 — Raw runtime events remain untouched
  it('TEST 29: original raw telemetry in runtime_events must remain intact after AI persistence', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    // Query 4A raw events
    const rawEvents = await sessionRepo.getEventsForPage(
      pkg.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );
    expect(rawEvents).toHaveLength(2);
    expect(rawEvents[0]?.eventId).toBe('evt_net_hidevs_01');
    expect(rawEvents[1]?.eventId).toBe('evt_console_hidevs_01');
  });

  // TEST 30 — Full workflow: AIAnalysisResult -> persist -> retrieve -> trace evidence
  it('TEST 30: full workflow verifies hierarchy and event traceability to original telemetry', async () => {
    const pkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(pkg);

    // 1. Retrieve batch
    const batch = await aiRepo.getAnalysisBatch(pkg.batchId);
    expect(batch?.batchId).toBe(pkg.batchId);

    // 2. Retrieve findings
    const findings = await aiRepo.getFindingsForBatch(pkg.batchId);
    expect(findings).toHaveLength(3);

    // 3. Trace evidence back to event IDs
    const repNetFinding = findings.find((f) => f.findingType === 'repeated_network_request')!;
    const eventIds = repNetFinding.evidence['eventIds'] as string[];
    expect(eventIds).toHaveLength(10);
    expect(eventIds[0]).toBe('evt_net_01');
    expect(repNetFinding.evidence['aggregationId']).toBe('agg_evt_net_01');
  });
});
