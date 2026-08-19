import { describe, it, expect } from 'vitest';
import { findPrecedingInteraction } from '../src/correlation/correlate-interactions.js';
import { groupPerformanceFindings } from '../src/insights/detect-insights.js';
import { RawRuntimeEvent } from '../src/types/raw.js';
import { EngineeringFinding } from '../src/types/findings.js';

describe('Milestone 4F — Interaction Correlation & Performance Grouping', () => {
  // TEST 1: Correlates click interaction with subsequent event within 1500ms
  it('TEST 1: should correlate click interaction with subsequent event within 1500ms', () => {
    const events: RawRuntimeEvent[] = [
      {
        eventId: 'evt_click_1',
        sessionId: 'sess_1',
        pageId: 'page_1',
        tabId: 1,
        timestamp: '2026-08-18T10:00:00.000Z',
        type: 'interaction',
        data: {
          interactionType: 'click',
          elementTag: 'BUTTON',
          elementId: 'refresh-btn',
          elementClasses: 'btn btn-primary',
          textPreview: 'Refresh Leaderboard',
          selector: 'button#refresh-btn.btn.btn-primary',
          timestamp: '2026-08-18T10:00:00.000Z'
        }
      }
    ];

    const targetTime = '2026-08-18T10:00:00.350Z'; // 350ms later
    const result = findPrecedingInteraction(targetTime, events);

    expect(result).not.toBeNull();
    expect(result?.interactionType).toBe('click');
    expect(result?.elementId).toBe('refresh-btn');
    expect(result?.textPreview).toBe('Refresh Leaderboard');
    expect(result?.timeDeltaMs).toBe(350);
  });

  // TEST 2: Does not correlate interaction if outside lookback window (>1500ms)
  it('TEST 2: should return null if interaction occurred outside correlation window', () => {
    const events: RawRuntimeEvent[] = [
      {
        eventId: 'evt_click_1',
        sessionId: 'sess_1',
        pageId: 'page_1',
        tabId: 1,
        timestamp: '2026-08-18T10:00:00.000Z',
        type: 'interaction',
        data: {
          interactionType: 'click',
          elementTag: 'BUTTON',
          elementId: 'refresh-btn',
          timestamp: '2026-08-18T10:00:00.000Z'
        }
      }
    ];

    const targetTime = '2026-08-18T10:00:02.500Z'; // 2500ms later (exceeds 1500ms)
    const result = findPrecedingInteraction(targetTime, events);
    expect(result).toBeNull();
  });

  // TEST 3: Groups large clusters of long tasks into main_thread_performance_degradation
  it('TEST 3: should group 75 long task findings into 1 main_thread_performance_degradation finding', () => {
    const individualFindings: EngineeringFinding[] = Array.from({ length: 75 }).map((_, i) => ({
      findingId: `fnd_long_task_${i + 1}`,
      findingType: 'long_task',
      category: 'performance',
      severity: i === 0 ? 'high' : 'medium',
      title: 'Main thread long task observed',
      description: 'A long task was observed.',
      confidence: 0.95,
      context: {
        sessionId: 'sess_1',
        websiteId: 'web_1',
        websiteOrigin: 'https://app.acme.io',
        pageId: 'page_dashboard',
        tabId: 1
      },
      evidence: {
        aggregationId: `agg_${i + 1}`,
        eventIds: [`evt_perf_${i + 1}`],
        count: 1,
        firstSeenAt: `2026-08-18T10:00:${String(i).padStart(2, '0')}.000Z`,
        lastSeenAt: `2026-08-18T10:00:${String(i).padStart(2, '0')}.050Z`,
        timeSpanMs: 50,
        durationMs: i === 0 ? 2151 : 56
      }
    }));

    const grouped = groupPerformanceFindings(individualFindings);

    expect(grouped).toHaveLength(1);
    const mainDegradation = grouped[0]!;
    expect(mainDegradation.findingType).toBe('main_thread_performance_degradation');
    expect(mainDegradation.severity).toBe('high');
    expect(mainDegradation.evidence.count).toBe(75);
    expect(mainDegradation.evidence.maxDurationMs).toBe(2151);
    expect(mainDegradation.evidence.eventIds).toHaveLength(75);
    expect(mainDegradation.evidence.representativeTasks).toBeDefined();
    expect(mainDegradation.evidence.representativeTasks![0]!.durationMs).toBe(2151);
  });

  // TEST 4: Keeps few long tasks (<=3) individual without aggregating
  it('TEST 4: should keep <= 3 long tasks individual', () => {
    const individualFindings: EngineeringFinding[] = Array.from({ length: 2 }).map((_, i) => ({
      findingId: `fnd_long_task_${i + 1}`,
      findingType: 'long_task',
      category: 'performance',
      severity: 'high',
      title: 'Main thread long task observed',
      description: 'A long task was observed.',
      confidence: 0.95,
      context: {
        sessionId: 'sess_1',
        websiteId: 'web_1',
        websiteOrigin: 'https://app.acme.io',
        pageId: 'page_dashboard',
        tabId: 1
      },
      evidence: {
        aggregationId: `agg_${i + 1}`,
        eventIds: [`evt_perf_${i + 1}`],
        count: 1,
        firstSeenAt: '2026-08-18T10:00:00.000Z',
        lastSeenAt: '2026-08-18T10:00:01.000Z',
        timeSpanMs: 1000,
        durationMs: 1200
      }
    }));

    const grouped = groupPerformanceFindings(individualFindings);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.findingType).toBe('long_task');
  });
});
