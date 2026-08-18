import { RawFinalizedSessionPackage } from '../../src/types/raw.js';

export function createSampleFinalizedSession(): RawFinalizedSessionPackage {
  return {
    session: {
      sessionId: 'sess_20260818_test001',
      status: 'finalized',
      startedAt: '2026-08-18T10:00:00.000Z',
      endedAt: '2026-08-18T10:05:00.000Z',
      durationMs: 300000,
      rootUrl: 'https://www.hidevs.xyz',
      activeTabId: 101
    },
    websites: [
      {
        websiteId: 'web_hidevs_001',
        sessionId: 'sess_20260818_test001',
        origin: 'https://www.hidevs.xyz',
        firstSeenAt: '2026-08-18T10:00:00.000Z',
        lastSeenAt: '2026-08-18T10:03:00.000Z',
        pages: [
          {
            pageId: 'page_hidevs_home',
            sessionId: 'sess_20260818_test001',
            websiteId: 'web_hidevs_001',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 101,
            url: 'https://www.hidevs.xyz/',
            title: 'HiDevs Community',
            createdAt: '2026-08-18T10:00:00.000Z',
            routes: [
              {
                routeId: 'route_hidevs_home_init',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_hidevs_home',
                tabId: 101,
                url: 'https://www.hidevs.xyz/',
                path: '/',
                hash: '',
                timestamp: '2026-08-18T10:00:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: [
              {
                eventId: 'evt_net_hidevs_01',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_hidevs_home',
                routeId: 'route_hidevs_home_init',
                tabId: 101,
                timestamp: '2026-08-18T10:00:02.000Z',
                type: 'network',
                data: {
                  requestType: 'fetch',
                  method: 'GET',
                  url: 'https://www.hidevs.xyz/api/home-feed',
                  status: 200,
                  durationMs: 45,
                  ok: true
                }
              },
              {
                eventId: 'evt_console_hidevs_01',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_hidevs_home',
                routeId: 'route_hidevs_home_init',
                tabId: 101,
                timestamp: '2026-08-18T10:00:03.000Z',
                type: 'console',
                data: {
                  level: 'info',
                  message: 'App initialized',
                  arguments: ['App initialized', { version: '1.0' }],
                  sourceUrl: 'https://www.hidevs.xyz/main.js',
                  rawTimestamp: '2026-08-18T10:00:03.000Z'
                }
              }
            ]
          },
          {
            pageId: 'page_hidevs_interns',
            sessionId: 'sess_20260818_test001',
            websiteId: 'web_hidevs_001',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 101,
            url: 'https://www.hidevs.xyz/ai-interns',
            title: 'AI Internships',
            createdAt: '2026-08-18T10:01:00.000Z',
            routes: [
              {
                routeId: 'route_hidevs_interns_init',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_hidevs_interns',
                tabId: 101,
                url: 'https://www.hidevs.xyz/ai-interns',
                path: '/ai-interns',
                hash: '',
                timestamp: '2026-08-18T10:01:00.000Z',
                navigationType: 'pushState'
              },
              {
                routeId: 'route_hidevs_interns_faq',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_hidevs_interns',
                tabId: 101,
                url: 'https://www.hidevs.xyz/ai-interns#faq',
                path: '/ai-interns',
                hash: '#faq',
                timestamp: '2026-08-18T10:01:30.000Z',
                navigationType: 'hashchange'
              }
            ],
            events: [
              {
                eventId: 'evt_perf_hidevs_01',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_hidevs_interns',
                routeId: 'route_hidevs_interns_faq',
                tabId: 101,
                timestamp: '2026-08-18T10:01:31.000Z',
                type: 'performance',
                data: {
                  performanceType: 'longtask',
                  name: 'self',
                  startTime: 1250,
                  durationMs: 85,
                  sourceUrl: 'https://www.hidevs.xyz/faq.js'
                }
              }
            ]
          }
        ]
      },
      {
        websiteId: 'web_github_002',
        sessionId: 'sess_20260818_test001',
        origin: 'https://github.com',
        firstSeenAt: '2026-08-18T10:03:30.000Z',
        lastSeenAt: '2026-08-18T10:05:00.000Z',
        pages: [
          {
            pageId: 'page_github_login',
            sessionId: 'sess_20260818_test001',
            websiteId: 'web_github_002',
            websiteOrigin: 'https://github.com',
            tabId: 102,
            url: 'https://github.com/login',
            title: 'Sign in to GitHub',
            createdAt: '2026-08-18T10:03:30.000Z',
            routes: [
              {
                routeId: 'route_github_login_init',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_github_login',
                tabId: 102,
                url: 'https://github.com/login',
                path: '/login',
                hash: '',
                timestamp: '2026-08-18T10:03:30.000Z',
                navigationType: 'initial'
              }
            ],
            events: [
              {
                eventId: 'evt_net_github_01',
                sessionId: 'sess_20260818_test001',
                pageId: 'page_github_login',
                routeId: 'route_github_login_init',
                tabId: 102,
                timestamp: '2026-08-18T10:03:35.000Z',
                type: 'network',
                data: {
                  requestType: 'fetch',
                  method: 'POST',
                  url: 'https://github.com/session',
                  status: 401,
                  durationMs: 120,
                  ok: false,
                  errorMessage: 'Unauthorized'
                }
              }
            ]
          }
        ]
      }
    ]
  };
}
