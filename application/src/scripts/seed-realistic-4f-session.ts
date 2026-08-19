import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { RawFinalizedSessionPackage } from '../types/raw.js';
import { SessionRepository } from '../repository/session-repository.js';
import { AIAnalysisRepository } from '../repository/ai-analysis-repository.js';
import { AnalysisOrchestrator } from '../services/analysis-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sessionRepo = new SessionRepository(supabase);
const aiRepo = new AIAnalysisRepository(supabase);
const orchestrator = new AnalysisOrchestrator(sessionRepo, aiRepo, process.env['AI_SERVICE_URL'] || 'http://localhost:8000');

async function seedAndAnalyze() {
  const sessionId = `sess_realistic_4f_${Date.now()}`;
  const websiteId = `web_acme_4f_${Date.now()}`;
  const pageId = `page_dashboard_4f_${Date.now()}`;
  const routeId = `route_dash_4f_${Date.now()}`;
  const origin = 'https://app.acme-analytics.io';
  const pageUrl = `${origin}/dashboard`;
  const baseTime = new Date('2026-08-18T14:42:20.000Z').getTime();

  console.log(`[SEED-4F] Creating realistic diagnostic error session: ${sessionId}`);

  // Build events array
  const events: any[] = [];

  // 1. User click interaction on Refresh button
  events.push({
    eventId: `evt_click_refresh_${Date.now()}`,
    sessionId,
    pageId,
    routeId,
    tabId: 101,
    timestamp: new Date(baseTime + 3000).toISOString(), // 14:42:23.000Z
    type: 'interaction',
    data: {
      interactionType: 'click',
      elementTag: 'BUTTON',
      elementId: 'refresh-leaderboard-btn',
      elementClasses: 'btn btn-primary shadow-sm',
      elementRole: 'button',
      accessibleLabel: 'Refresh Leaderboard Data',
      textPreview: 'Refresh Leaderboard',
      selector: 'button#refresh-leaderboard-btn.btn.btn-primary',
      timestamp: new Date(baseTime + 3000).toISOString()
    }
  });

  // 2. 14 Repeated network requests to /api/v1/leaderboard triggered shortly after click
  for (let i = 0; i < 14; i++) {
    const reqTime = baseTime + 3180 + i * 980; // Starts at 14:42:23.180Z (180ms after click)
    events.push({
      eventId: `evt_net_rep_${i + 1}`,
      sessionId,
      pageId,
      routeId,
      tabId: 101,
      timestamp: new Date(reqTime).toISOString(),
      type: 'network',
      data: {
        requestType: 'fetch',
        method: 'GET',
        url: `${origin}/api/v1/leaderboard`,
        origin,
        path: '/api/v1/leaderboard',
        status: 200,
        statusText: 'OK',
        ok: true,
        durationMs: 42 + (i % 5) * 10,
        sourceUrl: pageUrl,
        timestamp: new Date(reqTime).toISOString()
      }
    });
  }

  // 3. HTTP 500 server error on POST /api/v1/metrics/export
  events.push({
    eventId: `evt_net_500_${Date.now()}`,
    sessionId,
    pageId,
    routeId,
    tabId: 101,
    timestamp: new Date(baseTime + 8000).toISOString(),
    type: 'network',
    data: {
      requestType: 'fetch',
      method: 'POST',
      url: `${origin}/api/v1/metrics/export`,
      origin,
      path: '/api/v1/metrics/export',
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
      durationMs: 310,
      failureType: 'http',
      errorMessage: 'HTTP 500 Internal Server Error: Database transaction deadlock',
      sourceUrl: pageUrl,
      timestamp: new Date(baseTime + 8000).toISOString()
    }
  });

  // 4. HTTP 404 not found on GET /api/v1/missing-widget
  events.push({
    eventId: `evt_net_404_${Date.now()}`,
    sessionId,
    pageId,
    routeId,
    tabId: 101,
    timestamp: new Date(baseTime + 9500).toISOString(),
    type: 'network',
    data: {
      requestType: 'fetch',
      method: 'GET',
      url: `${origin}/api/v1/missing-widget`,
      origin,
      path: '/api/v1/missing-widget',
      status: 404,
      statusText: 'Not Found',
      ok: false,
      durationMs: 65,
      failureType: 'http',
      errorMessage: 'HTTP 404 Not Found',
      sourceUrl: pageUrl,
      timestamp: new Date(baseTime + 9500).toISOString()
    }
  });

  // 5. Failed fetch network transport error
  events.push({
    eventId: `evt_net_fetch_fail_${Date.now()}`,
    sessionId,
    pageId,
    routeId,
    tabId: 101,
    timestamp: new Date(baseTime + 11000).toISOString(),
    type: 'network',
    data: {
      requestType: 'fetch',
      method: 'GET',
      url: `https://telemetry-gateway.external.net/v1/ping`,
      origin: 'https://telemetry-gateway.external.net',
      path: '/v1/ping',
      status: null,
      statusText: '',
      ok: false,
      durationMs: 12,
      failureType: 'network',
      errorMessage: 'TypeError: Failed to fetch (CORS header missing or network timeout)',
      sourceUrl: pageUrl,
      timestamp: new Date(baseTime + 11000).toISOString()
    }
  });

  // 6. Unhandled JavaScript runtime exception with stack & source location
  events.push({
    eventId: `evt_js_err_${Date.now()}`,
    sessionId,
    pageId,
    routeId,
    tabId: 101,
    timestamp: new Date(baseTime + 4500).toISOString(),
    type: 'console',
    data: {
      level: 'error',
      message: 'Uncaught TypeError: Cannot read properties of undefined (reading \'calculateScore\')',
      sourceUrl: `${origin}/assets/app.js`,
      lineNumber: 142,
      columnNumber: 18,
      stack: `TypeError: Cannot read properties of undefined (reading 'calculateScore')\n    at renderLeaderboard (${origin}/assets/app.js:142:18)\n    at HTMLButtonElement.dispatch (${origin}/assets/vendor.js:89:12)\n    at ZoneDelegate.invokeTask (${origin}/assets/polyfills.js:421:31)`,
      arguments: [],
      rawTimestamp: new Date(baseTime + 4500).toISOString()
    }
  });

  // 7. 75 Main-thread long tasks (70 micro 50-90ms tasks + 5 severe 1500ms-2151ms tasks)
  const severeDurations = [2151, 1887, 1650, 1420, 1100];
  for (let i = 0; i < 75; i++) {
    const isSevere = i < 5;
    const dur = isSevere ? severeDurations[i]! : 55 + (i % 10) * 4;
    const taskTime = baseTime + 12000 + i * 200;

    events.push({
      eventId: `evt_perf_task_${i + 1}`,
      sessionId,
      pageId,
      routeId,
      tabId: 101,
      timestamp: new Date(taskTime).toISOString(),
      type: 'performance',
      data: {
        performanceType: 'longtask',
        name: 'self',
        durationMs: dur,
        duration: dur,
        startTime: taskTime,
        sourceUrl: `${origin}/assets/app.js`,
        timestamp: new Date(taskTime).toISOString()
      }
    });
  }

  const pkg: RawFinalizedSessionPackage = {
    session: {
      sessionId,
      status: 'finalized',
      startedAt: new Date(baseTime).toISOString(),
      endedAt: new Date(baseTime + 45000).toISOString(),
      durationMs: 45000,
      rootUrl: pageUrl,
      activeTabId: 101
    },
    websites: [
      {
        websiteId,
        sessionId,
        origin,
        firstSeenAt: new Date(baseTime).toISOString(),
        lastSeenAt: new Date(baseTime + 45000).toISOString(),
        pages: [
          {
            pageId,
            sessionId,
            websiteId,
            websiteOrigin: origin,
            tabId: 101,
            url: pageUrl,
            title: 'Acme Analytics Dashboard (Realistic Error Site)',
            createdAt: new Date(baseTime).toISOString(),
            routes: [
              {
                routeId,
                sessionId,
                pageId,
                tabId: 101,
                url: pageUrl,
                path: '/dashboard',
                hash: '',
                timestamp: new Date(baseTime).toISOString(),
                navigationType: 'initial'
              }
            ],
            events
          }
        ]
      }
    ]
  };

  console.log(`[SEED-4F] Ingesting package with ${events.length} raw runtime events...`);
  await sessionRepo.saveFinalizedSession(pkg);
  console.log('[SEED-4F] Session successfully saved to Supabase PostgreSQL!');

  console.log('[SEED-4F] Running user-controlled AI analysis on page...');
  const result = await orchestrator.runAnalysisForPages(sessionId, [pageId]);
  console.log('[SEED-4F] Analysis Result:', JSON.stringify(result, null, 2));

  const findings = await aiRepo.getFindingsForSession(sessionId);
  console.log(`\n======================================================`);
  console.log(`RAW EVENTS: ${events.length}`);
  console.log(`FINAL HIGH-SIGNAL DIAGNOSTIC FINDINGS: ${findings.length}`);
  console.log(`======================================================\n`);

  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] ${f.title}`);
    console.log(`  -> Type: ${f.findingType}`);
    console.log(`  -> Fact: ${f.observedFact}`);
    console.log(`  -> Interpretation: ${f.possibleInterpretation}`);
    if (f.evidence['interactionTrigger']) {
      const it = f.evidence['interactionTrigger'] as any;
      console.log(`  -> Preceding Interaction: ${it.interactionType} on "${it.textPreview || it.elementTag}" (${it.timeDeltaMs}ms before)`);
    }
    if (f.evidence['maxDurationMs']) {
      console.log(`  -> Performance Stats: worst ${f.evidence['maxDurationMs']}ms, total ${f.evidence['totalBlockedTimeMs']}ms, count: ${f.evidence['count']}`);
    }
    console.log(`  -> Trace Event IDs: ${((f.evidence['eventIds'] as string[]) || []).length} events attached\n`);
  }
}

seedAndAnalyze().catch((err) => {
  console.error('[SEED-4F] Fatal error:', err);
  process.exit(1);
});
