import dotenv from 'dotenv';
import { createSupabaseClient } from '../db/supabase-client.js';
import { SessionRepository } from '../repository/session-repository.js';
import { RawFinalizedSessionPackage } from '../types/raw.js';

dotenv.config();

export async function seedRealisticSession(): Promise<string> {
  const supabase = createSupabaseClient();
  const sessionRepo = new SessionRepository(supabase);

  const now = new Date();
  const startedAt = new Date(now.getTime() - 1000 * 60 * 8).toISOString(); // 8 mins ago
  const endedAt = now.toISOString();
  const sessionId = `sess_live_demo_${Date.now()}`;

  const samplePackage: RawFinalizedSessionPackage = {
    session: {
      sessionId,
      status: 'finalized',
      startedAt,
      endedAt,
      durationMs: 480000,
      rootUrl: 'https://app.acme-analytics.io',
      activeTabId: 501
    },
    websites: [
      {
        websiteId: `web_acme_${Date.now()}`,
        sessionId,
        origin: 'https://app.acme-analytics.io',
        firstSeenAt: startedAt,
        lastSeenAt: endedAt,
        pages: [
          {
            pageId: `page_acme_dashboard_${Date.now()}`,
            sessionId,
            websiteId: `web_acme_${Date.now()}`,
            websiteOrigin: 'https://app.acme-analytics.io',
            tabId: 501,
            url: 'https://app.acme-analytics.io/dashboard',
            title: 'Live Metrics & Leaderboard — Acme Analytics',
            createdAt: startedAt,
            routes: [
              {
                routeId: `route_acme_dash_01`,
                sessionId,
                pageId: `page_acme_dashboard_${Date.now()}`,
                tabId: 501,
                url: 'https://app.acme-analytics.io/dashboard',
                path: '/dashboard',
                hash: '',
                timestamp: startedAt,
                navigationType: 'initial'
              }
            ],
            events: [
              // 1. Repeated Network Requests (Leaderboard Polling / Render Loop)
              ...Array.from({ length: 6 }).map((_, i) => ({
                eventId: `evt_net_rep_${i + 1}`,
                sessionId,
                pageId: `page_acme_dashboard_${Date.now()}`,
                routeId: `route_acme_dash_01`,
                tabId: 501,
                timestamp: new Date(new Date(startedAt).getTime() + i * 350).toISOString(),
                type: 'network' as const,
                data: {
                  url: 'https://app.acme-analytics.io/api/v1/leaderboard',
                  method: 'GET',
                  status: 200,
                  statusText: 'OK',
                  durationMs: 38,
                  initiator: 'fetch',
                  responseHeaders: { 'content-type': 'application/json' }
                }
              })),

              // 2. Failed Network Request (500 Internal Server Error)
              {
                eventId: `evt_net_err_500`,
                sessionId,
                pageId: `page_acme_dashboard_${Date.now()}`,
                routeId: `route_acme_dash_01`,
                tabId: 501,
                timestamp: new Date(new Date(startedAt).getTime() + 3200).toISOString(),
                type: 'network' as const,
                data: {
                  url: 'https://app.acme-analytics.io/api/v1/metrics/export',
                  method: 'POST',
                  status: 500,
                  statusText: 'Internal Server Error',
                  durationMs: 420,
                  error: 'Database pool connection timeout on node-us-east-1',
                  responseBody: { message: 'Failed to aggregate time-series slice' }
                }
              },

              // 3. Long Task (Main thread freeze during D3 chart rendering)
              {
                eventId: `evt_perf_longtask_01`,
                sessionId,
                pageId: `page_acme_dashboard_${Date.now()}`,
                routeId: `route_acme_dash_01`,
                tabId: 501,
                timestamp: new Date(new Date(startedAt).getTime() + 4500).toISOString(),
                type: 'performance' as const,
                data: {
                  entryType: 'longtask',
                  name: 'self',
                  duration: 215, // 215ms blocking task
                  startTime: 4500,
                  attribution: [{ containerType: 'window', containerName: 'leaderboard-svg-render' }]
                }
              },

              // 4. Uncaught Console Error
              {
                eventId: `evt_console_err_01`,
                sessionId,
                pageId: `page_acme_dashboard_${Date.now()}`,
                routeId: `route_acme_dash_01`,
                tabId: 501,
                timestamp: new Date(new Date(startedAt).getTime() + 4600).toISOString(),
                type: 'console' as const,
                data: {
                  level: 'error',
                  message: "Uncaught TypeError: Cannot read properties of undefined (reading 'team_ranking')",
                  stack: "TypeError: Cannot read properties of undefined (reading 'team_ranking') at renderLeaderboard (https://app.acme-analytics.io/assets/dashboard.js:142:18)"
                }
              }
            ]
          },
          {
            pageId: `page_acme_billing_${Date.now()}`,
            sessionId,
            websiteId: `web_acme_${Date.now()}`,
            websiteOrigin: 'https://app.acme-analytics.io',
            tabId: 501,
            url: 'https://app.acme-analytics.io/settings/billing',
            title: 'Subscription & Billing — Acme Analytics',
            createdAt: new Date(new Date(startedAt).getTime() + 60000).toISOString(),
            routes: [
              {
                routeId: `route_acme_bill_01`,
                sessionId,
                pageId: `page_acme_billing_${Date.now()}`,
                tabId: 501,
                url: 'https://app.acme-analytics.io/settings/billing',
                path: '/settings/billing',
                hash: '',
                timestamp: new Date(new Date(startedAt).getTime() + 60000).toISOString(),
                navigationType: 'pushState'
              }
            ],
            events: [
              // Repeated 404 API request
              ...Array.from({ length: 4 }).map((_, i) => ({
                eventId: `evt_net_404_${i + 1}`,
                sessionId,
                pageId: `page_acme_billing_${Date.now()}`,
                routeId: `route_acme_bill_01`,
                tabId: 501,
                timestamp: new Date(new Date(startedAt).getTime() + 62000 + i * 800).toISOString(),
                type: 'network' as const,
                data: {
                  url: 'https://app.acme-analytics.io/api/v1/invoices/2026-Q1',
                  method: 'GET',
                  status: 404,
                  statusText: 'Not Found',
                  durationMs: 45
                }
              })),

              // Rapid Click Interaction (Rage clicks on broken upgrade button)
              ...Array.from({ length: 5 }).map((_, i) => ({
                eventId: `evt_interaction_click_${i + 1}`,
                sessionId,
                pageId: `page_acme_billing_${Date.now()}`,
                routeId: `route_acme_bill_01`,
                tabId: 501,
                timestamp: new Date(new Date(startedAt).getTime() + 65000 + i * 120).toISOString(),
                type: 'interaction' as const,
                data: {
                  eventType: 'click',
                  target: '#upgrade-enterprise-tier-btn',
                  tagName: 'BUTTON',
                  text: 'Upgrade to Enterprise Tier',
                  x: 480,
                  y: 320
                }
              }))
            ]
          }
        ]
      },
      {
        websiteId: `web_nexus_${Date.now()}`,
        sessionId,
        origin: 'https://shop.nexus-store.dev',
        firstSeenAt: new Date(new Date(startedAt).getTime() + 180000).toISOString(),
        lastSeenAt: endedAt,
        pages: [
          {
            pageId: `page_nexus_checkout_${Date.now()}`,
            sessionId,
            websiteId: `web_nexus_${Date.now()}`,
            websiteOrigin: 'https://shop.nexus-store.dev',
            tabId: 502,
            url: 'https://shop.nexus-store.dev/checkout/payment',
            title: 'Secure Checkout — Nexus Store',
            createdAt: new Date(new Date(startedAt).getTime() + 180000).toISOString(),
            routes: [
              {
                routeId: `route_nexus_chk_01`,
                sessionId,
                pageId: `page_nexus_checkout_${Date.now()}`,
                tabId: 502,
                url: 'https://shop.nexus-store.dev/checkout/payment',
                path: '/checkout/payment',
                hash: '',
                timestamp: new Date(new Date(startedAt).getTime() + 180000).toISOString(),
                navigationType: 'initial'
              }
            ],
            events: [
              // High latency network call
              {
                eventId: `evt_nexus_net_slow`,
                sessionId,
                pageId: `page_nexus_checkout_${Date.now()}`,
                routeId: `route_nexus_chk_01`,
                tabId: 502,
                timestamp: new Date(new Date(startedAt).getTime() + 182000).toISOString(),
                type: 'network' as const,
                data: {
                  url: 'https://shop.nexus-store.dev/api/v2/payment/intent',
                  method: 'POST',
                  status: 200,
                  durationMs: 3850, // 3.85s slow network request
                  initiator: 'fetch'
                }
              },
              // Deprecation warning
              {
                eventId: `evt_nexus_warn_01`,
                sessionId,
                pageId: `page_nexus_checkout_${Date.now()}`,
                routeId: `route_nexus_chk_01`,
                tabId: 502,
                timestamp: new Date(new Date(startedAt).getTime() + 183000).toISOString(),
                type: 'console' as const,
                data: {
                  level: 'warn',
                  message: '[Deprecation] Synchronous XMLHttpRequest on the main thread is deprecated because of its detrimental effects to the end user\'s experience.'
                }
              }
            ]
          }
        ]
      }
    ]
  };

  console.log(`[Seed] Persisting realistic monitoring session: ${sessionId}...`);
  await sessionRepo.saveFinalizedSession(samplePackage);
  console.log(`[Seed] Successfully saved session ${sessionId} with 2 websites and 3 pages to Supabase!`);
  return sessionId;
}

seedRealisticSession()
  .then((id) => {
    console.log(`\nDone! Session ID: ${id}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[Seed] Error persisting session:`, err);
    process.exit(1);
  });
