import type { RawFinalizedSessionPackage } from '../../src/types/raw.js';

export function createValidSingleWebsiteSession(): RawFinalizedSessionPackage {
  return {
    session: {
      sessionId: 'sess_20260817_test001',
      status: 'finalized',
      startedAt: '2026-08-17T08:00:00.000Z',
      endedAt: '2026-08-17T08:05:00.000Z',
      durationMs: 300000,
      rootUrl: 'https://www.hidevs.xyz/',
      activeTabId: 101
    },
    websites: [
      {
        websiteId: 'web_20260817_w01',
        sessionId: 'sess_20260817_test001',
        origin: 'https://www.hidevs.xyz',
        firstSeenAt: '2026-08-17T08:00:00.000Z',
        lastSeenAt: '2026-08-17T08:04:30.000Z',
        pages: [
          {
            pageId: 'page_001',
            sessionId: 'sess_20260817_test001',
            websiteId: 'web_20260817_w01',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 101,
            url: 'https://www.hidevs.xyz/',
            title: 'HiDevs Home',
            createdAt: '2026-08-17T08:00:00.000Z',
            routes: [
              {
                routeId: 'route_001',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_001',
                tabId: 101,
                url: 'https://www.hidevs.xyz/',
                path: '/',
                hash: '',
                timestamp: '2026-08-17T08:00:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: [
              {
                eventId: 'evt_c01',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_001',
                routeId: 'route_001',
                tabId: 101,
                timestamp: '2026-08-17T08:00:05.000Z',
                type: 'console',
                data: {
                  level: 'info',
                  message: 'App loaded',
                  arguments: ['App loaded'],
                  sourceUrl: 'https://www.hidevs.xyz/main.js',
                  rawTimestamp: '2026-08-17T08:00:05.000Z'
                }
              },
              {
                eventId: 'evt_n01',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_001',
                routeId: 'route_001',
                tabId: 101,
                timestamp: '2026-08-17T08:00:06.000Z',
                type: 'network',
                data: {
                  requestType: 'fetch',
                  method: 'GET',
                  url: 'https://www.hidevs.xyz/api/config',
                  status: 200,
                  statusText: 'OK',
                  ok: true,
                  durationMs: 45,
                  failureType: null,
                  errorMessage: null,
                  sourceUrl: 'https://www.hidevs.xyz/',
                  timestamp: '2026-08-17T08:00:06.000Z'
                }
              },
              {
                eventId: 'evt_p01',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_001',
                routeId: 'route_001',
                tabId: 101,
                timestamp: '2026-08-17T08:00:07.000Z',
                type: 'performance',
                data: {
                  performanceType: 'navigation',
                  navigationType: 'navigate',
                  startTime: 0,
                  durationMs: 450,
                  domContentLoadedMs: 250,
                  loadEventMs: 450,
                  dnsMs: 15,
                  connectMs: 30,
                  responseMs: 120,
                  sourceUrl: 'https://www.hidevs.xyz/',
                  timestamp: '2026-08-17T08:00:07.000Z'
                }
              }
            ]
          },
          {
            pageId: 'page_002',
            sessionId: 'sess_20260817_test001',
            websiteId: 'web_20260817_w01',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 101,
            url: 'https://www.hidevs.xyz/ai-interns',
            title: 'AI Interns',
            createdAt: '2026-08-17T08:02:00.000Z',
            routes: [
              {
                routeId: 'route_002',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_002',
                tabId: 101,
                url: 'https://www.hidevs.xyz/ai-interns',
                path: '/ai-interns',
                hash: '',
                timestamp: '2026-08-17T08:02:00.000Z',
                navigationType: 'initial'
              },
              {
                routeId: 'route_003',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_002',
                tabId: 101,
                url: 'https://www.hidevs.xyz/ai-interns#faq',
                path: '/ai-interns',
                hash: '#faq',
                timestamp: '2026-08-17T08:03:00.000Z',
                navigationType: 'hashchange'
              }
            ],
            events: [
              {
                eventId: 'evt_p02',
                sessionId: 'sess_20260817_test001',
                pageId: 'page_002',
                routeId: 'route_003',
                tabId: 101,
                timestamp: '2026-08-17T08:03:10.000Z',
                type: 'performance',
                data: {
                  performanceType: 'longtask',
                  name: 'self',
                  startTime: 1250,
                  durationMs: 85,
                  sourceUrl: 'https://www.hidevs.xyz/ai-interns',
                  timestamp: '2026-08-17T08:03:10.000Z'
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

export function createMultiWebsiteSession(): RawFinalizedSessionPackage {
  return {
    session: {
      sessionId: 'sess_20260817_multi002',
      status: 'finalized',
      startedAt: '2026-08-17T09:00:00.000Z',
      endedAt: '2026-08-17T09:10:00.000Z',
      durationMs: 600000,
      rootUrl: 'https://www.hidevs.xyz/',
      activeTabId: 201
    },
    websites: [
      {
        websiteId: 'web_hidevs_01',
        sessionId: 'sess_20260817_multi002',
        origin: 'https://www.hidevs.xyz',
        firstSeenAt: '2026-08-17T09:00:00.000Z',
        lastSeenAt: '2026-08-17T09:08:00.000Z',
        pages: [
          {
            pageId: 'page_hidevs_p1',
            sessionId: 'sess_20260817_multi002',
            websiteId: 'web_hidevs_01',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 201,
            url: 'https://www.hidevs.xyz/',
            title: 'HiDevs',
            createdAt: '2026-08-17T09:00:00.000Z',
            routes: [
              {
                routeId: 'route_h1',
                sessionId: 'sess_20260817_multi002',
                pageId: 'page_hidevs_p1',
                tabId: 201,
                url: 'https://www.hidevs.xyz/',
                path: '/',
                hash: '',
                timestamp: '2026-08-17T09:00:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: [
              {
                eventId: 'evt_hidevs_c1',
                sessionId: 'sess_20260817_multi002',
                pageId: 'page_hidevs_p1',
                routeId: 'route_h1',
                tabId: 201,
                timestamp: '2026-08-17T09:01:00.000Z',
                type: 'console',
                data: {
                  level: 'log',
                  message: 'HiDevs console event',
                  arguments: ['HiDevs console event'],
                  sourceUrl: 'https://www.hidevs.xyz/app.js',
                  rawTimestamp: '2026-08-17T09:01:00.000Z'
                }
              }
            ]
          }
        ]
      },
      {
        websiteId: 'web_github_02',
        sessionId: 'sess_20260817_multi002',
        origin: 'https://github.com',
        firstSeenAt: '2026-08-17T09:03:00.000Z',
        lastSeenAt: '2026-08-17T09:07:00.000Z',
        pages: [
          {
            pageId: 'page_github_p1',
            sessionId: 'sess_20260817_multi002',
            websiteId: 'web_github_02',
            websiteOrigin: 'https://github.com',
            tabId: 202,
            url: 'https://github.com/login',
            title: 'GitHub Login',
            createdAt: '2026-08-17T09:03:00.000Z',
            routes: [
              {
                routeId: 'route_g1',
                sessionId: 'sess_20260817_multi002',
                pageId: 'page_github_p1',
                tabId: 202,
                url: 'https://github.com/login',
                path: '/login',
                hash: '',
                timestamp: '2026-08-17T09:03:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: [
              {
                eventId: 'evt_github_n1',
                sessionId: 'sess_20260817_multi002',
                pageId: 'page_github_p1',
                routeId: 'route_g1',
                tabId: 202,
                timestamp: '2026-08-17T09:04:00.000Z',
                type: 'network',
                data: {
                  requestType: 'fetch',
                  method: 'POST',
                  url: 'https://github.com/session',
                  status: 200,
                  statusText: 'OK',
                  ok: true,
                  durationMs: 80,
                  failureType: null,
                  errorMessage: null,
                  sourceUrl: 'https://github.com/login',
                  timestamp: '2026-08-17T09:04:00.000Z'
                }
              }
            ]
          }
        ]
      }
    ]
  };
}

export function createRepeatedEventsSession(count = 10): RawFinalizedSessionPackage {
  const consoleEvents = Array.from({ length: count }, (_, i) => ({
    eventId: `evt_rep_c_${i + 1}`,
    sessionId: 'sess_20260817_rep003',
    pageId: 'page_rep_1',
    routeId: 'route_rep_1',
    tabId: 301,
    timestamp: `2026-08-17T10:00:${String(i).padStart(2, '0')}.000Z`,
    type: 'console' as const,
    data: {
      level: 'warn' as const,
      message: 'Repeated warning message',
      arguments: ['Repeated warning message'],
      sourceUrl: 'https://example.com/bundle.js',
      rawTimestamp: `2026-08-17T10:00:${String(i).padStart(2, '0')}.000Z`
    }
  }));

  const networkEvents = Array.from({ length: count }, (_, i) => ({
    eventId: `evt_rep_n_${i + 1}`,
    sessionId: 'sess_20260817_rep003',
    pageId: 'page_rep_1',
    routeId: 'route_rep_1',
    tabId: 301,
    timestamp: `2026-08-17T10:01:${String(i).padStart(2, '0')}.000Z`,
    type: 'network' as const,
    data: {
      requestType: 'fetch' as const,
      method: 'GET',
      url: 'https://example.com/api/items',
      status: 200,
      statusText: 'OK',
      ok: true,
      durationMs: 30,
      failureType: null,
      errorMessage: null,
      sourceUrl: 'https://example.com/',
      timestamp: `2026-08-17T10:01:${String(i).padStart(2, '0')}.000Z`
    }
  }));

  const perfEvents = Array.from({ length: count }, (_, i) => ({
    eventId: `evt_rep_p_${i + 1}`,
    sessionId: 'sess_20260817_rep003',
    pageId: 'page_rep_1',
    routeId: 'route_rep_1',
    tabId: 301,
    timestamp: `2026-08-17T10:02:${String(i).padStart(2, '0')}.000Z`,
    type: 'performance' as const,
    data: {
      performanceType: 'resource' as const,
      name: 'https://example.com/static/icon.png',
      initiatorType: 'img',
      durationMs: 15,
      startTime: 100 + i * 50,
      responseEnd: 115 + i * 50,
      transferSize: 1024,
      encodedBodySize: 800,
      decodedBodySize: 800,
      dnsMs: 0,
      connectMs: 0,
      responseMs: 10,
      sourceUrl: 'https://example.com/',
      timestamp: `2026-08-17T10:02:${String(i).padStart(2, '0')}.000Z`
    }
  }));

  return {
    session: {
      sessionId: 'sess_20260817_rep003',
      status: 'finalized',
      startedAt: '2026-08-17T10:00:00.000Z',
      endedAt: '2026-08-17T10:05:00.000Z',
      durationMs: 300000,
      rootUrl: 'https://example.com/',
      activeTabId: 301
    },
    websites: [
      {
        websiteId: 'web_example_01',
        sessionId: 'sess_20260817_rep003',
        origin: 'https://example.com',
        firstSeenAt: '2026-08-17T10:00:00.000Z',
        lastSeenAt: '2026-08-17T10:04:00.000Z',
        pages: [
          {
            pageId: 'page_rep_1',
            sessionId: 'sess_20260817_rep003',
            websiteId: 'web_example_01',
            websiteOrigin: 'https://example.com',
            tabId: 301,
            url: 'https://example.com/',
            title: 'Example',
            createdAt: '2026-08-17T10:00:00.000Z',
            routes: [
              {
                routeId: 'route_rep_1',
                sessionId: 'sess_20260817_rep003',
                pageId: 'page_rep_1',
                tabId: 301,
                url: 'https://example.com/',
                path: '/',
                hash: '',
                timestamp: '2026-08-17T10:00:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: [...consoleEvents, ...networkEvents, ...perfEvents]
          }
        ]
      }
    ]
  };
}

export function createEmptyEventsSession(): RawFinalizedSessionPackage {
  return {
    session: {
      sessionId: 'sess_20260817_empty004',
      status: 'finalized',
      startedAt: '2026-08-17T11:00:00.000Z',
      endedAt: '2026-08-17T11:01:00.000Z',
      durationMs: 60000,
      rootUrl: 'https://empty.example.com/',
      activeTabId: 401
    },
    websites: [
      {
        websiteId: 'web_empty_01',
        sessionId: 'sess_20260817_empty004',
        origin: 'https://empty.example.com',
        firstSeenAt: '2026-08-17T11:00:00.000Z',
        lastSeenAt: '2026-08-17T11:01:00.000Z',
        pages: [
          {
            pageId: 'page_empty_1',
            sessionId: 'sess_20260817_empty004',
            websiteId: 'web_empty_01',
            websiteOrigin: 'https://empty.example.com',
            tabId: 401,
            url: 'https://empty.example.com/',
            title: 'Empty Page',
            createdAt: '2026-08-17T11:00:00.000Z',
            routes: [
              {
                routeId: 'route_empty_1',
                sessionId: 'sess_20260817_empty004',
                pageId: 'page_empty_1',
                tabId: 401,
                url: 'https://empty.example.com/',
                path: '/',
                hash: '',
                timestamp: '2026-08-17T11:00:00.000Z',
                navigationType: 'initial'
              }
            ],
            events: []
          }
        ]
      }
    ]
  };
}
