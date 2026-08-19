import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/api/app.js';
import { SessionRepository } from '../src/repository/session-repository.js';
import { AIAnalysisRepository } from '../src/repository/ai-analysis-repository.js';
import { AnalysisOrchestrator } from '../src/services/analysis-orchestrator.js';
import { RawFinalizedSessionPackage } from '../src/types/raw.js';

// In-memory mock repositories for fast unit/integration testing
class MockSessionRepository {
  private sessions = new Map<string, any>();
  private websites = new Map<string, any[]>();
  private pages = new Map<string, any[]>();
  private routes = new Map<string, any[]>();
  private events = new Map<string, any[]>();

  async saveFinalizedSession(pkg: RawFinalizedSessionPackage): Promise<void> {
    this.sessions.set(pkg.session.sessionId, {
      ...pkg.session,
      persistedAt: new Date().toISOString()
    });

    const webs: any[] = [];
    for (const w of pkg.websites) {
      webs.push({
        websiteId: w.websiteId,
        sessionId: w.sessionId,
        origin: w.origin,
        firstSeenAt: w.firstSeenAt,
        lastSeenAt: w.lastSeenAt
      });

      const pgs: any[] = [];
      for (const p of w.pages) {
        pgs.push({
          pageId: p.pageId,
          sessionId: p.sessionId,
          websiteId: p.websiteId,
          websiteOrigin: p.websiteOrigin,
          tabId: p.tabId,
          url: p.url,
          title: p.title,
          createdAt: p.createdAt
        });

        this.routes.set(`${w.sessionId}:${w.websiteId}:${p.pageId}`, p.routes || []);
        this.events.set(`${w.sessionId}:${w.websiteId}:${p.pageId}`, p.events || []);
      }
      this.pages.set(`${w.sessionId}:${w.websiteId}`, pgs);
    }
    this.websites.set(pkg.session.sessionId, webs);
  }

  async listSessions(limit: number = 50): Promise<any[]> {
    return Array.from(this.sessions.values()).slice(0, limit);
  }

  async getSession(sessionId: string): Promise<any | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getWebsitesForSession(sessionId: string): Promise<any[]> {
    return this.websites.get(sessionId) || [];
  }

  async getWebsite(sessionId: string, websiteId: string): Promise<any | null> {
    const webs = this.websites.get(sessionId) || [];
    return webs.find((w) => w.websiteId === websiteId) || null;
  }

  async getPagesForWebsite(sessionId: string, websiteId: string): Promise<any[]> {
    return this.pages.get(`${sessionId}:${websiteId}`) || [];
  }

  async getPage(sessionId: string, websiteId: string, pageId: string): Promise<any | null> {
    const pgs = this.pages.get(`${sessionId}:${websiteId}`) || [];
    return pgs.find((p) => p.pageId === pageId) || null;
  }

  async getRoutesForPage(sessionId: string, websiteId: string, pageId: string): Promise<any[]> {
    return this.routes.get(`${sessionId}:${websiteId}:${pageId}`) || [];
  }

  async getEventsForPage(sessionId: string, websiteId: string, pageId: string): Promise<any[]> {
    return this.events.get(`${sessionId}:${websiteId}:${pageId}`) || [];
  }
}

class MockAIAnalysisRepository {
  private batches = new Map<string, any>();
  private findings = new Map<string, any[]>();

  async saveAnalysisResult(pkg: any): Promise<void> {
    this.batches.set(pkg.batchId, {
      batchId: pkg.batchId,
      sessionId: pkg.sessionId,
      websiteId: pkg.websiteId,
      pageId: pkg.pageId,
      websiteOrigin: pkg.websiteOrigin,
      schemaVersion: pkg.schemaVersion || '3A.1',
      analysisVersion: pkg.analysisVersion || '3C.1',
      status: pkg.status || 'completed',
      summary: pkg.summary,
      engineeringAssessment: pkg.engineeringAssessment,
      createdAt: pkg.createdAt || new Date().toISOString(),
      completedAt: pkg.completedAt || new Date().toISOString()
    });

    const fnds = (pkg.findings || []).map((f: any) => ({
      findingId: f.findingId,
      batchId: pkg.batchId,
      sessionId: pkg.sessionId,
      websiteId: pkg.websiteId,
      pageId: pkg.pageId,
      findingType: f.findingType,
      category: f.category,
      severity: f.severity,
      title: f.title,
      observedFact: f.observedFact,
      possibleInterpretation: f.possibleInterpretation,
      requiredAdditionalContext: f.requiredAdditionalContext,
      analysis: f.analysis,
      confidence: f.confidence || null,
      likelyImpact: f.likelyImpact || null,
      evidence: f.evidence || {},
      createdAt: new Date().toISOString()
    }));

    this.findings.set(pkg.batchId, fnds);
  }

  async getBatch(batchId: string): Promise<any | null> {
    return this.batches.get(batchId) || null;
  }

  async getAnalysisBatchForPage(sessionId: string, websiteId: string, pageId: string): Promise<any | null> {
    for (const b of this.batches.values()) {
      if (b.sessionId === sessionId && b.websiteId === websiteId && b.pageId === pageId) {
        return b;
      }
    }
    return null;
  }

  async getFindingsForBatch(batchId: string): Promise<any[]> {
    return this.findings.get(batchId) || [];
  }

  async getFindingsForWebsite(sessionId: string, websiteId: string): Promise<any[]> {
    const results: any[] = [];
    for (const fnds of this.findings.values()) {
      for (const f of fnds) {
        if (f.sessionId === sessionId && f.websiteId === websiteId) {
          results.push(f);
        }
      }
    }
    return results;
  }

  async getFindingsForPage(sessionId: string, websiteId: string, pageId: string): Promise<any[]> {
    const results: any[] = [];
    for (const fnds of this.findings.values()) {
      for (const f of fnds) {
        if (f.sessionId === sessionId && f.websiteId === websiteId && f.pageId === pageId) {
          results.push(f);
        }
      }
    }
    return results;
  }

  async getFindingsForSession(sessionId: string): Promise<any[]> {
    const results: any[] = [];
    for (const fnds of this.findings.values()) {
      for (const f of fnds) {
        if (f.sessionId === sessionId) results.push(f);
      }
    }
    return results;
  }

  async getSeveritySummaryForPage(sessionId: string, websiteId: string, pageId: string): Promise<any> {
    const findings = await this.getFindingsForPage(sessionId, websiteId, pageId);
    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      const sev = (f.severity || 'info').toLowerCase();
      if (sev in summary) (summary as any)[sev]++;
    }
    return summary;
  }

  async getFindingTypeSummaryForPage(sessionId: string, websiteId: string, pageId: string): Promise<any> {
    const findings = await this.getFindingsForPage(sessionId, websiteId, pageId);
    const summary: Record<string, number> = {};
    for (const f of findings) {
      summary[f.findingType] = (summary[f.findingType] || 0) + 1;
    }
    return summary;
  }

  async getSeveritySummaryForSession(sessionId: string): Promise<any> {
    const findings = await this.getFindingsForSession(sessionId);
    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) {
      const sev = (f.severity || 'info').toLowerCase();
      if (sev in summary) (summary as any)[sev]++;
    }
    return summary;
  }

  async getFindingTypeSummaryForSession(sessionId: string): Promise<any> {
    const findings = await this.getFindingsForSession(sessionId);
    const summary: Record<string, number> = {};
    for (const f of findings) {
      summary[f.findingType] = (summary[f.findingType] || 0) + 1;
    }
    return summary;
  }
}

const mockPackage: RawFinalizedSessionPackage = {
  session: {
    sessionId: 'sess_e2e_001',
    status: 'finalized',
    startedAt: '2026-08-18T10:00:00.000Z',
    endedAt: '2026-08-18T10:05:00.000Z',
    durationMs: 300000,
    rootUrl: 'https://app.acme.com',
    activeTabId: 101
  },
  websites: [
    {
      websiteId: 'web_acme_001',
      sessionId: 'sess_e2e_001',
      origin: 'https://app.acme.com',
      firstSeenAt: '2026-08-18T10:00:00.000Z',
      lastSeenAt: '2026-08-18T10:05:00.000Z',
      pages: [
        {
          pageId: 'page_acme_dash',
          sessionId: 'sess_e2e_001',
          websiteId: 'web_acme_001',
          websiteOrigin: 'https://app.acme.com',
          tabId: 101,
          url: 'https://app.acme.com/dashboard',
          title: 'Acme Dashboard',
          createdAt: '2026-08-18T10:00:00.000Z',
          routes: [
            {
              routeId: 'route_dash_01',
              sessionId: 'sess_e2e_001',
              pageId: 'page_acme_dash',
              tabId: 101,
              url: 'https://app.acme.com/dashboard',
              path: '/dashboard',
              hash: '',
              timestamp: '2026-08-18T10:00:00.000Z',
              navigationType: 'initial'
            }
          ],
          events: [
            // 4 repeated GET requests
            ...Array.from({ length: 4 }).map((_, i) => ({
              eventId: `evt_net_${i + 1}`,
              sessionId: 'sess_e2e_001',
              pageId: 'page_acme_dash',
              routeId: 'route_dash_01',
              tabId: 101,
              timestamp: `2026-08-18T10:00:0${i + 1}.000Z`,
              type: 'network' as const,
              data: {
                url: 'https://app.acme.com/api/v1/metrics',
                method: 'GET',
                status: 200,
                durationMs: 40
              }
            })),
            // Long task
            {
              eventId: 'evt_perf_01',
              sessionId: 'sess_e2e_001',
              pageId: 'page_acme_dash',
              routeId: 'route_dash_01',
              tabId: 101,
              timestamp: '2026-08-18T10:00:05.000Z',
              type: 'performance' as const,
              data: { duration: 180 }
            }
          ]
        }
      ]
    }
  ]
};

describe('Milestone 4E — End-to-End RuntimeLens Integration', () => {
  let sessionRepo: MockSessionRepository;
  let aiRepo: MockAIAnalysisRepository;
  let app: any;

  beforeEach(() => {
    sessionRepo = new MockSessionRepository();
    aiRepo = new MockAIAnalysisRepository();
    app = createApp(sessionRepo as unknown as SessionRepository, aiRepo as unknown as AIAnalysisRepository);
  });

  // TEST 1 — Ingest finalized session via POST /api/sessions/ingest
  it('TEST 1: Ingests raw finalized session package from Extension and persists to database', async () => {
    const res = await request(app)
      .post('/api/sessions/ingest')
      .send(mockPackage);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.sessionId).toBe('sess_e2e_001');

    const session = await sessionRepo.getSession('sess_e2e_001');
    expect(session).not.toBeNull();
    expect(session.rootUrl).toBe('https://app.acme.com');
  });

  // TEST 2 — Health & System Status Endpoints
  it('TEST 2: GET /api/health and GET /api/system/status return structured service topology', async () => {
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    const statusRes = await request(app).get('/api/system/status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.components.applicationApi.status).toBe('connected');
    expect(statusRes.body.components.database.status).toBe('connected');
  });

  // TEST 3 — User-controlled AI Analysis Orchestration (with AI service mock)
  it('TEST 3: POST /api/sessions/:sessionId/analyze runs end-to-end analysis and saves findings', async () => {
    // 1. Ingest session first
    await request(app).post('/api/sessions/ingest').send(mockPackage);

    // 2. Mock global fetch to simulate Python AI service response
    const mockAiResponse = {
      analysisVersion: '3C.1',
      batchId: 'batch_sess_e2e_001_web_acme_001_page_acme_dash',
      sessionId: 'sess_e2e_001',
      websiteId: 'web_acme_001',
      pageId: 'page_acme_dash',
      status: 'completed',
      summary: 'AI Engine identified 2 runtime engineering findings.',
      engineeringAssessment: 'High repeated network traffic detected on metrics endpoint.',
      findings: [
        {
          findingId: 'fnd_rep_net_page_acme_dash_1',
          findingType: 'repeated_network_request',
          category: 'network',
          severity: 'medium',
          title: 'Repeated API Request (GET /api/v1/metrics)',
          observedFact: 'GET https://app.acme.com/api/v1/metrics was called 4 times in 3 seconds.',
          possibleInterpretation: 'Undebounced state update or component render cycle.',
          requiredAdditionalContext: 'Inspect metrics widget lifecycle.',
          analysis: 'Rapid duplicate requests.',
          confidence: 0.96,
          likelyImpact: 'Increased server load.'
        }
      ]
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAiResponse
    }) as any;

    try {
      // 3. User triggers AI analysis for the page
      const analyzeRes = await request(app)
        .post('/api/sessions/sess_e2e_001/analyze')
        .send({ pageIds: ['page_acme_dash'] });

      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.success).toBe(true);
      expect(analyzeRes.body.processedPages).toEqual(['page_acme_dash']);

      // 4. Verify AI findings were persisted and can be read by query layer
      const pageAnalysisRes = await request(app)
        .get('/api/sessions/sess_e2e_001/websites/web_acme_001/pages/page_acme_dash/analysis');

      expect(pageAnalysisRes.status).toBe(200);
      expect(pageAnalysisRes.body.totalFindings).toBeGreaterThan(0);
      expect(pageAnalysisRes.body.findings[0].findingType).toBe('repeated_network_request');
      expect(pageAnalysisRes.body.findings[0].evidence.eventIds).toContain('evt_net_1');
      expect(pageAnalysisRes.body.findings[0].evidence.aggregationId).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // TEST 4 — Graceful fallback when AI service is unavailable
  it('TEST 4: Falls back cleanly to deterministic analysis when AI service times out or fails', async () => {
    await request(app).post('/api/sessions/ingest').send(mockPackage);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused to AI service')) as any;

    try {
      const analyzeRes = await request(app)
        .post('/api/sessions/sess_e2e_001/analyze')
        .send({ pageIds: ['page_acme_dash'] });

      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.body.success).toBe(true);
      expect(analyzeRes.body.mode).toBe('deterministic_fallback');

      const findings = await aiRepo.getFindingsForPage('sess_e2e_001', 'web_acme_001', 'page_acme_dash');
      expect(findings.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // TEST 5 — Idempotency of re-analysis
  it('TEST 5: Running analysis multiple times on the same page is idempotent', async () => {
    await request(app).post('/api/sessions/ingest').send(mockPackage);

    const run1 = await request(app)
      .post('/api/sessions/sess_e2e_001/analyze')
      .send({ pageIds: ['page_acme_dash'] });
    expect(run1.status).toBe(200);

    const run2 = await request(app)
      .post('/api/sessions/sess_e2e_001/analyze')
      .send({ pageIds: ['page_acme_dash'] });
    expect(run2.status).toBe(200);

    const findings = await aiRepo.getFindingsForPage('sess_e2e_001', 'web_acme_001', 'page_acme_dash');
    expect(findings.length).toBe(2); // exactly 2 findings, no duplicates
  });
});
