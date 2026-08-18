import { describe, it, expect } from 'vitest';
import { createSupabaseClient } from '../src/db/supabase-client.js';
import { SessionRepository } from '../src/repository/session-repository.js';
import { createSampleFinalizedSession } from './fixtures/sample-session.js';
import { getSupabaseConfig } from '../src/config/env.js';

const config = getSupabaseConfig();
const hasCredentials = Boolean(
  config.supabaseUrl &&
  config.supabaseServiceRoleKey &&
  !config.supabaseUrl.includes('your-project')
);

describe.runIf(hasCredentials)('Milestone 4A — Live Supabase Integration', () => {
  it('should save and retrieve session from live Supabase PostgreSQL database', async () => {
    const client = createSupabaseClient();
    const repo = new SessionRepository(client);

    const pkg = createSampleFinalizedSession();
    const now = Date.now();
    pkg.session.sessionId = `sess_live_${now}`;
    for (const w of pkg.websites) {
      w.sessionId = pkg.session.sessionId;
      w.websiteId = `${w.websiteId}_${now}`;
      for (const p of w.pages) {
        p.sessionId = pkg.session.sessionId;
        p.websiteId = w.websiteId;
        p.pageId = `${p.pageId}_${now}`;
        const routeIdMap = new Map<string, string>();
        for (const r of p.routes) {
          const newRouteId = `${r.routeId}_${now}`;
          routeIdMap.set(r.routeId, newRouteId);
          r.sessionId = pkg.session.sessionId;
          r.pageId = p.pageId;
          r.routeId = newRouteId;
        }
        for (const e of p.events) {
          e.sessionId = pkg.session.sessionId;
          e.pageId = p.pageId;
          e.eventId = `${e.eventId}_${now}`;
          if (e.routeId && routeIdMap.has(e.routeId)) {
            e.routeId = routeIdMap.get(e.routeId)!;
          }
        }
      }
    }

    // 1. Save Session
    await repo.saveFinalizedSession(pkg);

    // 2. Retrieve Session
    const session = await repo.getSession(pkg.session.sessionId);
    expect(session).not.toBeNull();
    expect(session?.sessionId).toBe(pkg.session.sessionId);

    // 3. Verify Websites
    const websites = await repo.getWebsitesForSession(pkg.session.sessionId);
    expect(websites.length).toBeGreaterThanOrEqual(2);

    // 4. Save AI Analysis Result (Milestone 4B)
    const { AIAnalysisRepository } = await import('../src/repository/ai-analysis-repository.js');
    const { createSampleAIAnalysisResult } = await import('./fixtures/sample-ai-analysis.js');

    const aiRepo = new AIAnalysisRepository(client);
    const aiPkg = createSampleAIAnalysisResult({
      batchId: `batch_live_${now}`,
      sessionId: pkg.session.sessionId,
      websiteId: pkg.websites[0]!.websiteId,
      pageId: pkg.websites[0]!.pages[0]!.pageId,
      findings: [
        {
          findingId: `fnd_live_${now}`,
          findingType: 'repeated_network_request',
          category: 'network',
          severity: 'medium',
          title: 'Live repeated request test',
          observedFact: 'Observed 10 repeated requests',
          possibleInterpretation: 'Polling',
          requiredAdditionalContext: 'Code inspection',
          analysis: 'Analysis text',
          confidence: 0.95,
          likelyImpact: 'Latency',
          evidence: { count: 10, eventIds: ['evt_live_1'] }
        }
      ]
    });

    // Save AI Batch
    await aiRepo.saveAnalysisResult(aiPkg);

    // Retrieve AI Batch
    const savedBatch = await aiRepo.getAnalysisBatch(aiPkg.batchId);
    expect(savedBatch).not.toBeNull();
    expect(savedBatch?.batchId).toBe(aiPkg.batchId);

    // Retrieve AI Findings
    const savedFindings = await aiRepo.getFindingsForBatch(aiPkg.batchId);
    expect(savedFindings).toHaveLength(1);
    expect(savedFindings[0]?.findingId).toBe(`fnd_live_${now}`);

    // Idempotent re-save
    await aiRepo.saveAnalysisResult(aiPkg);
    const afterResave = await aiRepo.getFindingsForBatch(aiPkg.batchId);
    expect(afterResave).toHaveLength(1);

    // 5. Cleanup (Cascades to websites, pages, routes, events, batches, findings)
    await client.from('sessions').delete().eq('session_id', pkg.session.sessionId);
  });
});
