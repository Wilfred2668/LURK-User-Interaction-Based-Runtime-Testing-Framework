import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../src/api/app.js';
import { SessionRepository } from '../src/repository/session-repository.js';
import { AIAnalysisRepository } from '../src/repository/ai-analysis-repository.js';
import { createMockSupabaseClient } from './mock-supabase.js';
import { createSampleFinalizedSession } from './fixtures/sample-session.js';
import { createSampleAIAnalysisResult } from './fixtures/sample-ai-analysis.js';

describe('Milestone 4C — Application Read API', () => {
  let app: Express;
  let sessionRepo: SessionRepository;
  let aiRepo: AIAnalysisRepository;
  let client: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    client = createMockSupabaseClient();
    sessionRepo = new SessionRepository(client);
    aiRepo = new AIAnalysisRepository(client);
    app = createApp(sessionRepo, aiRepo);

    // Seed session, websites, pages, routes, events
    const sessionPkg = createSampleFinalizedSession();
    await sessionRepo.saveFinalizedSession(sessionPkg);

    // Seed AI analysis result
    const aiPkg = createSampleAIAnalysisResult();
    await aiRepo.saveAnalysisResult(aiPkg);
  });

  // TEST 1 — GET /api/sessions returns sessions
  it('TEST 1: GET /api/sessions returns a list of persisted sessions', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].sessionId).toBe('sess_20260818_test001');
  });

  // TEST 2 — Session metadata is preserved
  it('TEST 2: GET /api/sessions preserves exact session metadata fields', async () => {
    const res = await request(app).get('/api/sessions');
    const s = res.body[0];
    expect(s.status).toBe('finalized');
    expect(s.startedAt).toBe('2026-08-18T10:00:00.000Z');
    expect(s.endedAt).toBe('2026-08-18T10:05:00.000Z');
    expect(s.durationMs).toBe(300000);
    expect(s.rootUrl).toBe('https://www.hidevs.xyz');
    expect(s.activeTabId).toBe(101);
  });

  // TEST 3 — GET single session overview
  it('TEST 3: GET /api/sessions/:sessionId returns session overview with counts', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001');
    expect(res.status).toBe(200);
    expect(res.body.session.sessionId).toBe('sess_20260818_test001');
    expect(res.body.websiteCount).toBe(2);
    expect(res.body.pageCount).toBe(3);
    expect(res.body.totalFindings).toBe(3);
  });

  // TEST 4 — Unknown session returns 404
  it('TEST 4: GET /api/sessions/:sessionId returns 404 for unknown session', async () => {
    const res = await request(app).get('/api/sessions/sess_unknown_999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });

  // TEST 5 — List websites for session
  it('TEST 5: GET /api/sessions/:sessionId/websites returns websites strictly for the session', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001/websites');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((w: { origin: string }) => w.origin)).toEqual([
      'https://www.hidevs.xyz',
      'https://github.com'
    ]);
  });

  // TEST 6 — Website isolation
  it('TEST 6: Websites for session A do not leak into session B', async () => {
    const res = await request(app).get('/api/sessions/sess_non_existent/websites');
    expect(res.status).toBe(404);
  });

  // TEST 7 — Unknown website returns 404
  it('TEST 7: GET /api/sessions/:sessionId/websites/:websiteId returns 404 for unknown website', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001/websites/web_non_existent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });

  // TEST 8 — List pages for website
  it('TEST 8: GET /api/sessions/:sessionId/websites/:websiteId/pages returns pages for website', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].pageId).toBe('page_hidevs_home');
    expect(res.body[1].pageId).toBe('page_hidevs_interns');
  });

  // TEST 9 — Page isolation
  it('TEST 9: Pages from one website do not appear under another website', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001/websites/web_github_002/pages');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].pageId).toBe('page_github_login');
  });

  // TEST 10 — Unknown page returns 404
  it('TEST 10: GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId returns 404 for unknown page', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_non_existent'
    );
    expect(res.status).toBe(404);
  });

  // TEST 11 — Get page metadata
  it('TEST 11: GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId returns page overview', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns'
    );
    expect(res.status).toBe(200);
    expect(res.body.page.pageId).toBe('page_hidevs_interns');
    expect(res.body.routeCount).toBe(2);
    expect(res.body.eventCount).toBe(1);
    expect(res.body.findingCount).toBe(3);
  });

  // TEST 12 — Get route history
  it('TEST 12: GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/routes returns routes', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/routes'
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[1].hash).toBe('#faq');
  });

  // TEST 13 — Get page runtime events
  it('TEST 13: GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/events returns events', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_home/events'
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].eventId).toBe('evt_net_hidevs_01');
  });

  // TEST 14 — Raw event payload is preserved
  it('TEST 14: Raw event payload inside data JSONB is preserved without loss', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_home/events'
    );
    const netEvent = res.body.find((e: { eventId: string }) => e.eventId === 'evt_net_hidevs_01');
    expect(netEvent.data.status).toBe(200);
    expect(netEvent.data.method).toBe('GET');
  });

  // TEST 15 — Get page findings
  it('TEST 15: GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/findings returns findings', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/findings'
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].findingId).toBe('fnd_repeated_net_01');
  });

  // TEST 16 — Findings preserve AI analysis fields
  it('TEST 16: Findings preserve observed facts, interpretations, and required context', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/findings'
    );
    const f1 = res.body[0];
    expect(f1.title).toBe('Repeated network request detected');
    expect(f1.observedFact).toContain('10 identical GET requests');
    expect(f1.possibleInterpretation).toContain('Rapid interval polling');
    expect(f1.requiredAdditionalContext).toContain('Examine state update triggers');
  });

  // TEST 17 — Findings preserve technical evidence
  it('TEST 17: Findings preserve complete technical evidence', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/findings'
    );
    const f1 = res.body[0];
    expect(f1.evidence.count).toBe(10);
    expect(f1.evidence.url).toBe('https://www.hidevs.xyz/api/leaderboard');
    expect(f1.evidence.method).toBe('GET');
  });

  // TEST 18 — Findings preserve eventIds for traceability
  it('TEST 18: Findings preserve eventIds array in evidence for machine traceability', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/findings'
    );
    const f1 = res.body[0];
    expect(f1.evidence.eventIds).toContain('evt_net_01');
    expect(f1.evidence.eventIds).toHaveLength(10);
  });

  // TEST 19 — Session findings endpoint
  it('TEST 19: GET /api/sessions/:sessionId/findings returns all findings under session', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001/findings');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  // TEST 20 — Website findings endpoint
  it('TEST 20: GET /api/sessions/:sessionId/websites/:websiteId/findings returns website findings', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/findings'
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  // TEST 21 — Severity filtering
  it('TEST 21: Querying findings filtered by severity returns matching findings', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/findings?severity=medium'
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  // TEST 22 — FindingType filtering
  it('TEST 22: Querying findings filtered by findingType returns matching findings', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/findings?findingType=long_task'
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].findingId).toBe('fnd_long_task_03');
  });

  // TEST 23 — Invalid severity rejected
  it('TEST 23: Querying findings with invalid severity returns 400', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/findings?severity=danger_zone'
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BadRequest');
  });

  // TEST 24 — Invalid findingType rejected
  it('TEST 24: Querying findings with invalid findingType returns 400', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/findings?findingType=unrecognized_type'
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BadRequest');
  });

  // TEST 25 — Cross-session isolation
  it('TEST 25: Attempting to access website belonging to another session returns 404', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_other_session/websites/web_hidevs_001'
    );
    expect(res.status).toBe(404);
  });

  // TEST 26 — Cross-website isolation
  it('TEST 26: Attempting to access page under wrong website returns 404', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_github_002/pages/page_hidevs_home'
    );
    expect(res.status).toBe(404);
  });

  // TEST 27 — Cross-page isolation
  it('TEST 27: Page events for page A cannot be fetched via page B URL', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_nonexistent/events'
    );
    expect(res.status).toBe(404);
  });

  // TEST 28 — Page analysis endpoint
  it('TEST 28: GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/analysis returns analysis DTO', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/analysis'
    );
    expect(res.status).toBe(200);
    expect(res.body.session.sessionId).toBe('sess_20260818_test001');
    expect(res.body.website.websiteId).toBe('web_hidevs_001');
    expect(res.body.page.pageId).toBe('page_hidevs_interns');
    expect(res.body.findings).toHaveLength(3);
    expect(res.body.analysisSummary).toContain('Analyzed 3 runtime engineering findings');
  });

  // TEST 29 — Page analysis contains summary counts
  it('TEST 29: Page analysis contains total findings and breakdown summaries', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/analysis'
    );
    expect(res.body.totalFindings).toBe(3);
    expect(res.body.severitySummary).toBeDefined();
    expect(res.body.findingTypeSummary).toBeDefined();
  });

  // TEST 30 — Severity summary is correct
  it('TEST 30: Severity summary accurately reflects finding counts', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/analysis'
    );
    expect(res.body.severitySummary.medium).toBe(2);
    expect(res.body.severitySummary.low).toBe(1);
    expect(res.body.severitySummary.high).toBe(0);
    expect(res.body.severitySummary.critical).toBe(0);
  });

  // TEST 31 — Finding type summary is correct
  it('TEST 31: Finding type summary accurately reflects finding type frequencies', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/analysis'
    );
    expect(res.body.findingTypeSummary.repeated_network_request).toBe(1);
    expect(res.body.findingTypeSummary.failed_network_request).toBe(1);
    expect(res.body.findingTypeSummary.long_task).toBe(1);
  });

  // TEST 32 — No health score is generated
  it('TEST 32: API does not generate subjective health scores or percentage ratings', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/analysis'
    );
    expect(res.body).not.toHaveProperty('healthScore');
    expect(res.body).not.toHaveProperty('percentageHealth');
    expect(res.body).not.toHaveProperty('score');
  });

  // TEST 33 — API does not expose provider-specific fields
  it('TEST 33: API does not expose LLM provider-specific fields', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_interns/analysis'
    );
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body).not.toHaveProperty('model');
    expect(res.body).not.toHaveProperty('systemPrompt');
    expect(res.body).not.toHaveProperty('temperature');
  });

  // TEST 34 — API does not expose Supabase credentials
  it('TEST 34: API does not expose Supabase credentials or database secrets', async () => {
    const res = await request(app).get('/api/sessions/sess_20260818_test001');
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(bodyStr).not.toContain('service_role');
  });

  // TEST 35 — API response is deterministic
  it('TEST 35: Successive GET requests return identical deterministic responses', async () => {
    const res1 = await request(app).get('/api/sessions/sess_20260818_test001/websites');
    const res2 = await request(app).get('/api/sessions/sess_20260818_test001/websites');
    expect(res1.body).toEqual(res2.body);
  });

  // TEST 36 — Repository/database failure returns safe 500 response
  it('TEST 36: Unhandled errors return a structured 500 response without leaking traces', async () => {
    // Force repository failure
    sessionRepo.listSessions = async () => {
      throw new Error('Database connection failed: SELECT * FROM sessions');
    };

    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    expect(res.body.message).toBe('An internal server error occurred.');
    expect(JSON.stringify(res.body)).not.toContain('SELECT * FROM');
  });

  // TEST 37 — Empty session works correctly
  it('TEST 37: Cleanly handles session with no websites', async () => {
    sessionRepo.getWebsitesForSession = async () => [];
    const res = await request(app).get('/api/sessions/sess_20260818_test001/websites');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // TEST 38 — Empty page findings works correctly
  it('TEST 38: Cleanly returns empty findings for page with no AI analysis', async () => {
    const res = await request(app).get(
      '/api/sessions/sess_20260818_test001/websites/web_hidevs_001/pages/page_hidevs_home/findings'
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // TEST 39 — Complete session hierarchy can be navigated through API
  it('TEST 39: Complete session hierarchy can be queried sequentially', async () => {
    // 1. Session
    const sessionRes = await request(app).get('/api/sessions/sess_20260818_test001');
    expect(sessionRes.status).toBe(200);

    // 2. Websites
    const websitesRes = await request(app).get('/api/sessions/sess_20260818_test001/websites');
    expect(websitesRes.status).toBe(200);
    const firstWeb = websitesRes.body[0];

    // 3. Pages
    const pagesRes = await request(app).get(
      `/api/sessions/sess_20260818_test001/websites/${firstWeb.websiteId}/pages`
    );
    expect(pagesRes.status).toBe(200);
    const firstPage = pagesRes.body[0];

    // 4. Routes
    const routesRes = await request(app).get(
      `/api/sessions/sess_20260818_test001/websites/${firstWeb.websiteId}/pages/${firstPage.pageId}/routes`
    );
    expect(routesRes.status).toBe(200);
  });

  // TEST 40 — Realistic end-to-end read workflow
  it('TEST 40: Realistic workflow: List sessions -> pick website -> pick page -> view full analysis', async () => {
    // 1. User loads dashboard -> lists sessions
    const sessions = (await request(app).get('/api/sessions')).body;
    const selectedSession = sessions[0];

    // 2. User clicks session -> gets websites
    const websites = (
      await request(app).get(`/api/sessions/${selectedSession.sessionId}/websites`)
    ).body;
    const selectedWebsite = websites.find((w: { origin: string }) => w.origin === 'https://www.hidevs.xyz');

    // 3. User clicks website -> gets pages
    const pages = (
      await request(app).get(
        `/api/sessions/${selectedSession.sessionId}/websites/${selectedWebsite.websiteId}/pages`
      )
    ).body;
    const internsPage = pages.find((p: { pageId: string }) => p.pageId === 'page_hidevs_interns');

    // 4. User views full page analysis
    const analysisRes = await request(app).get(
      `/api/sessions/${selectedSession.sessionId}/websites/${selectedWebsite.websiteId}/pages/${internsPage.pageId}/analysis`
    );

    expect(analysisRes.status).toBe(200);
    expect(analysisRes.body.findings).toHaveLength(3);
    expect(analysisRes.body.totalFindings).toBe(3);
    expect(analysisRes.body.severitySummary.medium).toBe(2);
  });

  // TEST 41 — Trigger user-controlled AI analysis
  it('TEST 41: POST /api/sessions/:sessionId/analyze runs deterministic analysis for selected pages', async () => {
    const res = await request(app)
      .post('/api/sessions/sess_20260818_test001/analyze')
      .send({ pageIds: ['page_hidevs_home', 'page_hidevs_interns'] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedPages).toEqual(['page_hidevs_home', 'page_hidevs_interns']);
  });
});
