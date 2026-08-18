import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRepository } from '../src/repository/session-repository.js';
import { createMockSupabaseClient } from './mock-supabase.js';
import { createSampleFinalizedSession } from './fixtures/sample-session.js';
import { RawFinalizedSessionPackage } from '../src/types/raw.js';

describe('Milestone 4A — SessionRepository', () => {
  let client: ReturnType<typeof createMockSupabaseClient>;
  let repo: SessionRepository;

  beforeEach(() => {
    client = createMockSupabaseClient();
    repo = new SessionRepository(client);
  });

  // TEST 1 — Save valid finalized session
  it('TEST 1: should save a valid finalized session package', async () => {
    const pkg = createSampleFinalizedSession();
    await expect(repo.saveFinalizedSession(pkg)).resolves.not.toThrow();
  });

  // TEST 2 — Retrieve saved session
  it('TEST 2: should retrieve the saved session by sessionId', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const session = await repo.getSession(pkg.session.sessionId);
    expect(session).not.toBeNull();
    expect(session?.sessionId).toBe(pkg.session.sessionId);
    expect(session?.status).toBe('finalized');
  });

  // TEST 3 — Preserve exact session metadata
  it('TEST 3: should preserve exact session metadata', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const session = await repo.getSession(pkg.session.sessionId);
    expect(session?.startedAt).toBe(pkg.session.startedAt);
    expect(session?.endedAt).toBe(pkg.session.endedAt);
    expect(session?.durationMs).toBe(pkg.session.durationMs);
    expect(session?.rootUrl).toBe(pkg.session.rootUrl);
    expect(session?.activeTabId).toBe(pkg.session.activeTabId);
    expect(session?.persistedAt).toBeDefined();
  });

  // TEST 4 — Persist multiple websites separately
  it('TEST 4: should persist multiple websites separately under the session', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const websites = await repo.getWebsitesForSession(pkg.session.sessionId);
    expect(websites).toHaveLength(2);
    expect(websites.map((w) => w.origin)).toEqual([
      'https://www.hidevs.xyz',
      'https://github.com'
    ]);
  });

  // TEST 5 — Persist multiple pages under correct website
  it('TEST 5: should persist multiple pages under the correct website', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const hidevsPages = await repo.getPagesForWebsite(pkg.session.sessionId, 'web_hidevs_001');
    const githubPages = await repo.getPagesForWebsite(pkg.session.sessionId, 'web_github_002');

    expect(hidevsPages).toHaveLength(2);
    expect(hidevsPages[0]?.pageId).toBe('page_hidevs_home');
    expect(hidevsPages[1]?.pageId).toBe('page_hidevs_interns');

    expect(githubPages).toHaveLength(1);
    expect(githubPages[0]?.pageId).toBe('page_github_login');
  });

  // TEST 6 — Persist routes under correct page
  it('TEST 6: should persist routes under the correct page', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const internsRoutes = await repo.getRoutesForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_interns'
    );
    expect(internsRoutes).toHaveLength(2);
    expect(internsRoutes[0]?.routeId).toBe('route_hidevs_interns_init');
    expect(internsRoutes[1]?.routeId).toBe('route_hidevs_interns_faq');
    expect(internsRoutes[1]?.hash).toBe('#faq');
  });

  // TEST 7 — Persist events under correct page/route
  it('TEST 7: should persist events under the correct page and route', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const homeEvents = await repo.getEventsForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );
    expect(homeEvents).toHaveLength(2);
    expect(homeEvents[0]?.eventId).toBe('evt_net_hidevs_01');
    expect(homeEvents[1]?.eventId).toBe('evt_console_hidevs_01');
  });

  // TEST 8 — Preserve complete JSONB event payloads
  it('TEST 8: should preserve complete raw JSONB event payloads without data loss', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const homeEvents = await repo.getEventsForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );

    const netEvt = homeEvents.find((e) => e.eventId === 'evt_net_hidevs_01');
    expect(netEvt?.data).toEqual({
      requestType: 'fetch',
      method: 'GET',
      url: 'https://www.hidevs.xyz/api/home-feed',
      status: 200,
      durationMs: 45,
      ok: true
    });

    const consoleEvt = homeEvents.find((e) => e.eventId === 'evt_console_hidevs_01');
    expect(consoleEvt?.data).toEqual({
      level: 'info',
      message: 'App initialized',
      arguments: ['App initialized', { version: '1.0' }],
      sourceUrl: 'https://www.hidevs.xyz/main.js',
      rawTimestamp: '2026-08-18T10:00:03.000Z'
    });
  });

  // TEST 9 — Verify website isolation
  it('TEST 9: should strictly isolate pages between different websites in the same session', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const hidevsPages = await repo.getPagesForWebsite(pkg.session.sessionId, 'web_hidevs_001');
    const githubPages = await repo.getPagesForWebsite(pkg.session.sessionId, 'web_github_002');

    expect(hidevsPages.some((p) => p.websiteOrigin === 'https://github.com')).toBe(false);
    expect(githubPages.some((p) => p.websiteOrigin === 'https://www.hidevs.xyz')).toBe(false);
  });

  // TEST 10 — Verify page isolation
  it('TEST 10: should strictly isolate routes between different pages', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const homeRoutes = await repo.getRoutesForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );
    const internsRoutes = await repo.getRoutesForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_interns'
    );

    expect(homeRoutes.some((r) => r.path === '/ai-interns')).toBe(false);
    expect(internsRoutes.some((r) => r.routeId === 'route_hidevs_home_init')).toBe(false);
  });

  // TEST 11 — Verify event isolation
  it('TEST 11: should strictly isolate events between different pages', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const homeEvents = await repo.getEventsForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );
    const internsEvents = await repo.getEventsForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_interns'
    );

    expect(homeEvents.some((e) => e.type === 'performance')).toBe(false);
    expect(internsEvents.some((e) => e.type === 'network')).toBe(false);
  });

  // TEST 12 — Verify duplicate session persistence is idempotent
  it('TEST 12: should be idempotent when saving the exact same session repeatedly', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);
    await repo.saveFinalizedSession(pkg);
    await repo.saveFinalizedSession(pkg);

    const sessions = await repo.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionId).toBe(pkg.session.sessionId);
  });

  // TEST 13 — Verify duplicate website persistence is idempotent
  it('TEST 13: should not create duplicate websites on repeated saves', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);
    await repo.saveFinalizedSession(pkg);

    const websites = await repo.getWebsitesForSession(pkg.session.sessionId);
    expect(websites).toHaveLength(2);
  });

  // TEST 14 — Verify duplicate page persistence is idempotent
  it('TEST 14: should not create duplicate pages on repeated saves', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);
    await repo.saveFinalizedSession(pkg);

    const pages = await repo.getPagesForWebsite(pkg.session.sessionId, 'web_hidevs_001');
    expect(pages).toHaveLength(2);
  });

  // TEST 15 — Verify duplicate route persistence is idempotent
  it('TEST 15: should not create duplicate routes on repeated saves', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);
    await repo.saveFinalizedSession(pkg);

    const routes = await repo.getRoutesForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_interns'
    );
    expect(routes).toHaveLength(2);
  });

  // TEST 16 — Verify duplicate event persistence is idempotent
  it('TEST 16: should not create duplicate runtime events on repeated saves', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);
    await repo.saveFinalizedSession(pkg);

    const events = await repo.getEventsForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );
    expect(events).toHaveLength(2);
  });

  // TEST 17 — Verify empty-event sessions
  it('TEST 17: should cleanly save and retrieve sessions with no events', async () => {
    const pkg = createSampleFinalizedSession();
    pkg.websites[0]!.pages[0]!.events = [];
    pkg.websites[0]!.pages[1]!.events = [];
    pkg.websites[1]!.pages[0]!.events = [];

    await repo.saveFinalizedSession(pkg);

    const events = await repo.getEventsForPage(
      pkg.session.sessionId,
      'web_hidevs_001',
      'page_hidevs_home'
    );
    expect(events).toHaveLength(0);
  });

  // TEST 18 — Verify multi-website sessions
  it('TEST 18: should persist multi-website sessions with distinct origins', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const w1 = await repo.getWebsite(pkg.session.sessionId, 'web_hidevs_001');
    const w2 = await repo.getWebsite(pkg.session.sessionId, 'web_github_002');

    expect(w1?.origin).toBe('https://www.hidevs.xyz');
    expect(w2?.origin).toBe('https://github.com');
  });

  // TEST 19 — Verify listSessions()
  it('TEST 19: should list all persisted sessions ordered by startedAt descending', async () => {
    const pkg1 = createSampleFinalizedSession();
    const pkg2 = createSampleFinalizedSession();
    pkg2.session.sessionId = 'sess_20260818_test002';
    pkg2.session.startedAt = '2026-08-18T11:00:00.000Z';

    // Fix IDs in pkg2
    for (const w of pkg2.websites) {
      w.sessionId = pkg2.session.sessionId;
      w.websiteId = `${w.websiteId}_2`;
      for (const p of w.pages) {
        p.sessionId = pkg2.session.sessionId;
        p.websiteId = w.websiteId;
        p.pageId = `${p.pageId}_2`;
        for (const r of p.routes) {
          r.sessionId = pkg2.session.sessionId;
          r.pageId = p.pageId;
          r.routeId = `${r.routeId}_2`;
        }
        for (const e of p.events) {
          e.sessionId = pkg2.session.sessionId;
          e.pageId = p.pageId;
          e.eventId = `${e.eventId}_2`;
        }
      }
    }

    await repo.saveFinalizedSession(pkg1);
    await repo.saveFinalizedSession(pkg2);

    const sessions = await repo.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.sessionId).toBe('sess_20260818_test002');
    expect(sessions[1]?.sessionId).toBe('sess_20260818_test001');
  });

  // TEST 20 — Verify getWebsitesForSession()
  it('TEST 20: should return empty list for non-existent session websites', async () => {
    const websites = await repo.getWebsitesForSession('sess_non_existent');
    expect(websites).toEqual([]);
  });

  // TEST 21 — Verify getPagesForWebsite()
  it('TEST 21: should return empty list for non-existent website pages', async () => {
    const pages = await repo.getPagesForWebsite('sess_non_existent', 'web_non_existent');
    expect(pages).toEqual([]);
  });

  // TEST 22 — Verify getRoutesForPage()
  it('TEST 22: should return empty list for non-existent page routes', async () => {
    const routes = await repo.getRoutesForPage('sess_non_existent', 'web_none', 'page_none');
    expect(routes).toEqual([]);
  });

  // TEST 23 — Verify getEventsForPage()
  it('TEST 23: should return empty list for non-existent page events', async () => {
    const events = await repo.getEventsForPage('sess_non_existent', 'web_none', 'page_none');
    expect(events).toEqual([]);
  });

  // TEST 24 — Verify invalid session data is rejected
  it('TEST 24: should reject invalid session metadata', async () => {
    const pkg = createSampleFinalizedSession();
    (pkg.session as unknown as { sessionId: string }).sessionId = '';

    await expect(repo.saveFinalizedSession(pkg)).rejects.toThrow();
  });

  // TEST 25 — Verify invalid website data is rejected
  it('TEST 25: should reject invalid website origin or mismatched session ID', async () => {
    const pkg = createSampleFinalizedSession();
    pkg.websites[0]!.origin = 'ftp://invalid-protocol.com';

    await expect(repo.saveFinalizedSession(pkg)).rejects.toThrow(/origin must start with http/);
  });

  // TEST 26 — Verify invalid page data is rejected
  it('TEST 26: should reject mismatched websiteId in page record', async () => {
    const pkg = createSampleFinalizedSession();
    pkg.websites[0]!.pages[0]!.websiteId = 'web_different_mismatched';

    await expect(repo.saveFinalizedSession(pkg)).rejects.toThrow(/does not match website/);
  });

  // TEST 27 — Verify invalid event identity is rejected
  it('TEST 27: should reject events with missing eventId', async () => {
    const pkg = createSampleFinalizedSession();
    (pkg.websites[0]!.pages[0]!.events[0] as unknown as { eventId: string }).eventId = '';

    await expect(repo.saveFinalizedSession(pkg)).rejects.toThrow();
  });

  // TEST 28 — Verify repeated save produces the same database state
  it('TEST 28: should maintain identical database state across repeated saves', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);
    const beforeSession = await repo.getSession(pkg.session.sessionId);
    const beforeWebsites = await repo.getWebsitesForSession(pkg.session.sessionId);

    await repo.saveFinalizedSession(pkg);
    const afterSession = await repo.getSession(pkg.session.sessionId);
    const afterWebsites = await repo.getWebsitesForSession(pkg.session.sessionId);

    expect(beforeSession?.sessionId).toBe(afterSession?.sessionId);
    expect(beforeWebsites).toEqual(afterWebsites);
  });

  // TEST 29 — Verify the input finalized session object is not mutated
  it('TEST 29: should not mutate the input finalized session object', async () => {
    const pkg = createSampleFinalizedSession();
    const pkgClone: RawFinalizedSessionPackage = JSON.parse(JSON.stringify(pkg));

    await repo.saveFinalizedSession(pkg);
    expect(pkg).toEqual(pkgClone);
  });

  // TEST 30 — Verify deterministic retrieval
  it('TEST 30: should return deterministic results across multiple retrieval calls', async () => {
    const pkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(pkg);

    const res1 = await repo.getEventsForPage(pkg.session.sessionId, 'web_hidevs_001', 'page_hidevs_home');
    const res2 = await repo.getEventsForPage(pkg.session.sessionId, 'web_hidevs_001', 'page_hidevs_home');

    expect(res1).toEqual(res2);
  });

  // TEST 31 — Full workflow test: package matches original hierarchy
  it('TEST 31: full end-to-end hierarchy retrieval matches the original package', async () => {
    const originalPkg = createSampleFinalizedSession();
    await repo.saveFinalizedSession(originalPkg);

    // 1. Session
    const session = await repo.getSession(originalPkg.session.sessionId);
    expect(session?.sessionId).toBe(originalPkg.session.sessionId);

    // 2. Websites
    const websites = await repo.getWebsitesForSession(originalPkg.session.sessionId);
    expect(websites).toHaveLength(originalPkg.websites.length);

    // 3. Select website 1
    const targetWeb = websites[0]!;
    const pages = await repo.getPagesForWebsite(originalPkg.session.sessionId, targetWeb.websiteId);
    expect(pages).toHaveLength(originalPkg.websites[0]!.pages.length);

    // 4. Select page 1
    const targetPage = pages[0]!;
    const routes = await repo.getRoutesForPage(originalPkg.session.sessionId, targetWeb.websiteId, targetPage.pageId);
    const events = await repo.getEventsForPage(originalPkg.session.sessionId, targetWeb.websiteId, targetPage.pageId);

    expect(routes).toHaveLength(originalPkg.websites[0]!.pages[0]!.routes.length);
    expect(events).toHaveLength(originalPkg.websites[0]!.pages[0]!.events.length);
    expect(events[0]?.eventId).toBe(originalPkg.websites[0]!.pages[0]!.events[0]!.eventId);
  });
});
