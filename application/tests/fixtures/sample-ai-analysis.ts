import { AIAnalysisResultPackage } from '../../src/types/ai-models.js';

export function createSampleAIAnalysisResult(
  overrides: Partial<AIAnalysisResultPackage> = {}
): AIAnalysisResultPackage {
  return {
    batchId: 'batch_sess_20260818_test001_web_hidevs_001_page_interns',
    sessionId: 'sess_20260818_test001',
    websiteId: 'web_hidevs_001',
    pageId: 'page_hidevs_interns',
    websiteOrigin: 'https://www.hidevs.xyz',
    schemaVersion: '3A.1',
    analysisVersion: '3C.1',
    status: 'completed',
    summary: 'Analyzed 3 runtime engineering findings on page https://www.hidevs.xyz/ai-interns.',
    engineeringAssessment: 'Main thread responsiveness is impacted by an 85ms task while network polling repeats 10 times.',
    createdAt: '2026-08-18T10:02:00.000Z',
    completedAt: '2026-08-18T10:02:05.000Z',
    findings: [
      {
        findingId: 'fnd_repeated_net_01',
        findingType: 'repeated_network_request',
        category: 'network',
        severity: 'medium',
        title: 'Repeated network request detected',
        observedFact: 'Observed 10 identical GET requests to /api/leaderboard within 3 seconds.',
        possibleInterpretation: 'Rapid interval polling or reactive component loops.',
        requiredAdditionalContext: 'Examine state update triggers in the leaderboard widget.',
        analysis: '10 GET requests occurred rapidly.',
        confidence: 0.95,
        likelyImpact: 'Increased backend bandwidth consumption and client CPU overhead.',
        evidence: {
          count: 10,
          url: 'https://www.hidevs.xyz/api/leaderboard',
          method: 'GET',
          status: 200,
          eventIds: [
            'evt_net_01', 'evt_net_02', 'evt_net_03', 'evt_net_04', 'evt_net_05',
            'evt_net_06', 'evt_net_07', 'evt_net_08', 'evt_net_09', 'evt_net_10'
          ],
          aggregationId: 'agg_evt_net_01'
        }
      },
      {
        findingId: 'fnd_failed_net_02',
        findingType: 'failed_network_request',
        category: 'network',
        severity: 'low',
        title: 'HTTP 404 response observed',
        observedFact: 'Observed Client-side HTTP error (HTTP 404 Not Found) for /api/missing-info.',
        possibleInterpretation: 'Dead link or deprecated API endpoint.',
        requiredAdditionalContext: 'Verify backend API route registration.',
        analysis: 'HTTP 404 response detected.',
        confidence: 1.0,
        likelyImpact: 'User experiences missing data or partial view state.',
        evidence: {
          count: 1,
          url: 'https://www.hidevs.xyz/api/missing-info',
          method: 'GET',
          status: 404,
          eventIds: ['evt_net_fail'],
          aggregationId: 'agg_evt_net_fail'
        }
      },
      {
        findingId: 'fnd_long_task_03',
        findingType: 'long_task',
        category: 'performance',
        severity: 'medium',
        title: 'Main thread long task observed',
        observedFact: 'A long task lasting 85ms was observed blocking the execution thread.',
        possibleInterpretation: 'Expensive synchronous computation during FAQ hash navigation.',
        requiredAdditionalContext: 'Profile JavaScript call tree during hash change.',
        analysis: 'Main thread blocked for 85ms.',
        confidence: 0.95,
        likelyImpact: 'Temporary UI stutter and frame drops.',
        evidence: {
          durationMs: 85,
          eventIds: ['evt_perf_01'],
          aggregationId: 'agg_evt_p02'
        }
      }
    ],
    ...overrides
  };
}
