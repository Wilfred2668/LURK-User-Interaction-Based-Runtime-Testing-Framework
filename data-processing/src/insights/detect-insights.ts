import type {
  AggregatedPattern,
  ConsoleGroupingKey,
  NetworkGroupingKey,
  PerformanceGroupingKey
} from '../types/aggregated.js';
import type {
  EngineeringFinding,
  FindingEvidence,
  FindingSeverity,
  FindingType,
  RepresentativeTaskItem
} from '../types/findings.js';
import type {
  RawConsoleEventData,
  RawNavigationPerformanceData,
  RawNetworkEventData,
  RawResourcePerformanceData,
  RawLongTaskPerformanceData
} from '../types/raw.js';
import type { InsightConfig } from './insight-config.js';
import { DEFAULT_INSIGHT_CONFIG } from './insight-config.js';

function extractUrlComponents(rawUrl?: string): { origin?: string; path?: string } {
  if (!rawUrl) return {};
  try {
    const parsed = new URL(rawUrl);
    return { origin: parsed.origin, path: parsed.pathname };
  } catch {
    return { path: rawUrl };
  }
}

function createEvidence(pattern: AggregatedPattern, extras: Partial<FindingEvidence> = {}): FindingEvidence {
  const urlComps = extractUrlComponents((extras.url as string) || (pattern.representativeData as any)?.url);

  return {
    aggregationId: pattern.aggregationId,
    eventIds: [...pattern.eventIds],
    count: pattern.count,
    firstSeenAt: pattern.firstSeenAt,
    lastSeenAt: pattern.lastSeenAt,
    timeSpanMs: pattern.timeSpanMs,
    origin: urlComps.origin,
    path: urlComps.path,
    ...extras
  };
}

function createFinding(
  pattern: AggregatedPattern,
  findingType: FindingType,
  severity: FindingSeverity,
  title: string,
  description: string,
  confidence: number,
  evidenceExtras: Partial<FindingEvidence> = {},
  metadata?: Record<string, unknown>
): EngineeringFinding {
  const findingId = `fnd_${findingType}_${pattern.aggregationId}`;

  return {
    findingId,
    findingType,
    category: pattern.category,
    severity,
    title,
    description,
    confidence,
    context: { ...pattern.context },
    evidence: createEvidence(pattern, evidenceExtras),
    metadata
  };
}

/**
 * Detects rule-based engineering findings from a single AggregatedPattern.
 *
 * Immutability Guarantee: Input pattern is NEVER modified.
 * Factual Guarantee: No root-cause speculation or solution recommendations.
 */
export function detectInsightsFromPattern(
  pattern: AggregatedPattern,
  config: InsightConfig = DEFAULT_INSIGHT_CONFIG
): EngineeringFinding[] {
  const findings: EngineeringFinding[] = [];

  switch (pattern.category) {
    case 'network': {
      const netKey = pattern.key as NetworkGroupingKey;
      const netData = pattern.representativeData as RawNetworkEventData;
      const url = netKey.url || netData.url;
      const method = netKey.method || netData.method || 'GET';
      const status = netData.status;
      const durationMs = netData.durationMs;
      // 1. Repeated Network Request
      if (
        pattern.patternType === 'repeated_network' &&
        pattern.count >= config.repeatedNetwork.minCount &&
        pattern.timeSpanMs <= config.repeatedNetwork.maxTimeSpanMs
      ) {
        let severity: FindingSeverity = 'low';
        if (pattern.count >= 50) {
          severity = 'high';
        } else if (pattern.count >= 20) {
          severity = 'medium';
        }

        findings.push(
          createFinding(
            pattern,
            'repeated_network_request',
            severity,
            'Repeated network request detected',
            `The network request "${method} ${url}" was issued ${pattern.count} times within the aggregation window (${pattern.timeSpanMs}ms).`,
            0.95,
            {
              url,
              method,
              status,
              statusText: netData.statusText,
              ok: netData.ok,
              durationMs
            }
          )
        );
      }

      // 2. Failed Network Request (HTTP 4xx / 5xx)
      if (typeof status === 'number' && status >= 400) {
        let severity: FindingSeverity = 'low';
        if (status >= 500) {
          severity = 'high';
        }

        findings.push(
          createFinding(
            pattern,
            'failed_network_request',
            severity,
            'Failed network request detected',
            `The request "${method} ${url}" returned HTTP ${status}.`,
            1.0,
            {
              url,
              method,
              status,
              statusText: netData.statusText,
              ok: false,
              durationMs,
              failureType: netData.failureType ?? 'http'
            }
          )
        );
      }

      // 3. Network Transport Failure
      if (netData.failureType === 'network' || (!netData.ok && status === null)) {
        findings.push(
          createFinding(
            pattern,
            'network_transport_failure',
            'high',
            'Network transport failure detected',
            `The request "${method} ${url}" encountered a transport-level failure: ${netData.errorMessage || 'network error'}.`,
            0.95,
            {
              url,
              method,
              status: null,
              ok: false,
              failureType: 'network',
              errorMessage: netData.errorMessage ?? undefined,
              durationMs
            }
          )
        );
      }

      // 4. Slow Network Request
      if (typeof durationMs === 'number' && !Number.isNaN(durationMs) && durationMs >= config.slowNetwork.warningMs) {
        let severity: FindingSeverity = 'medium';
        if (durationMs >= config.slowNetwork.highMs) {
          severity = 'high';
        }

        findings.push(
          createFinding(
            pattern,
            'slow_network_request',
            severity,
            'Slow network request observed',
            `Request duration of ${durationMs}ms for ${method} ${url} exceeded the configured threshold (${config.slowNetwork.warningMs}ms).`,
            0.9,
            { url, method, status, durationMs }
          )
        );
      }

      break;
    }

    case 'console': {
      const conKey = pattern.key as ConsoleGroupingKey;
      const conData = pattern.representativeData as RawConsoleEventData;
      const level = conKey.level || conData.level;
      const message = conKey.message || conData.message;

      // 5. Repeated Console Error / Warning
      if (pattern.patternType === 'repeated_console' && pattern.count >= config.repeatedConsole.minCount) {
        if (level === 'error') {
          let severity: FindingSeverity = 'low';
          if (pattern.count >= 50) {
            severity = 'high';
          } else if (pattern.count >= 10) {
            severity = 'medium';
          }

          findings.push(
            createFinding(
              pattern,
              'repeated_console_error',
              severity,
              'Repeated console error detected',
              `The console error "${message}" was observed ${pattern.count} times on this page.`,
              0.95,
              {
                level,
                message,
                sourceUrl: conData.sourceUrl ?? undefined,
                lineNumber: conData.lineNumber ?? undefined,
                columnNumber: conData.columnNumber ?? undefined,
                stack: conData.stack ?? undefined
              }
            )
          );
        } else if (level === 'warn') {
          let severity: FindingSeverity = 'low';
          if (pattern.count >= 50) {
            severity = 'medium';
          }

          findings.push(
            createFinding(
              pattern,
              'repeated_console_warning',
              severity,
              'Repeated console warning detected',
              `The console warning "${message}" was observed ${pattern.count} times on this page.`,
              0.9,
              {
                level,
                message,
                sourceUrl: conData.sourceUrl ?? undefined,
                lineNumber: conData.lineNumber ?? undefined,
                columnNumber: conData.columnNumber ?? undefined,
                stack: conData.stack ?? undefined
              }
            )
          );
        }
      }

      break;
    }

    case 'performance': {
      const perfKey = pattern.key as PerformanceGroupingKey;
      const perfData = pattern.representativeData as
        | RawResourcePerformanceData
        | RawLongTaskPerformanceData
        | RawNavigationPerformanceData;

      if (perfKey.performanceType === 'resource') {
        const resData = perfData as RawResourcePerformanceData;
        const name = perfKey.name || resData.name;
        const initiatorType = perfKey.initiatorType || resData.initiatorType;
        const durationMs = resData.durationMs;
        const size = resData.decodedBodySize || resData.transferSize || resData.encodedBodySize || 0;

        // 6. Repeated Resource
        if (pattern.patternType === 'repeated_resource' && pattern.count >= config.repeatedResource.minCount) {
          let severity: FindingSeverity = 'low';
          if (pattern.count >= 20) {
            severity = 'medium';
          }

          findings.push(
            createFinding(
              pattern,
              'repeated_resource',
              severity,
              'Repeated resource loading detected',
              `Resource "${name}" (${initiatorType || 'resource'}) was requested ${pattern.count} times within the aggregation window.`,
              0.9,
              { url: name, initiatorType, durationMs }
            )
          );
        }

        // 7. Slow Resource
        if (typeof durationMs === 'number' && !Number.isNaN(durationMs) && durationMs >= config.slowResource.warningMs) {
          let severity: FindingSeverity = 'medium';
          if (durationMs >= config.slowResource.highMs) {
            severity = 'high';
          }

          findings.push(
            createFinding(
              pattern,
              'slow_resource',
              severity,
              'Slow resource load observed',
              `Resource "${name}" load time of ${durationMs}ms exceeded the threshold (${config.slowResource.warningMs}ms).`,
              0.9,
              { url: name, initiatorType, durationMs }
            )
          );
        }

        // 8. Large Resource
        if (typeof size === 'number' && !Number.isNaN(size) && size >= config.largeResource.warningBytes) {
          let severity: FindingSeverity = 'medium';
          if (size >= config.largeResource.highBytes) {
            severity = 'high';
          }

          findings.push(
            createFinding(
              pattern,
              'large_resource',
              severity,
              'Large resource payload observed',
              `Resource "${name}" size of ${Math.round(size / 1024)} KB exceeded the configured threshold (${Math.round(config.largeResource.warningBytes / 1024)} KB).`,
              0.9,
              {
                url: name,
                initiatorType,
                decodedBodySize: resData.decodedBodySize,
                transferSize: resData.transferSize,
                encodedBodySize: resData.encodedBodySize
              }
            )
          );
        }
      } else if (perfKey.performanceType === 'longtask') {
        const longTaskData = perfData as RawLongTaskPerformanceData;
        const durationMs = longTaskData.durationMs;

        // 9. Main Thread Long Task
        if (typeof durationMs === 'number' && !Number.isNaN(durationMs) && durationMs >= config.longTask.warningMs) {
          let severity: FindingSeverity = 'medium';
          if (durationMs >= config.longTask.highMs) {
            severity = 'high';
          }

          findings.push(
            createFinding(
              pattern,
              'long_task',
              severity,
              'Main thread long task observed',
              `A long task lasting ${durationMs}ms was observed blocking the main execution thread.`,
              0.95,
              { durationMs, startTime: longTaskData.startTime, url: longTaskData.sourceUrl ?? undefined }
            )
          );
        }
      } else if (perfKey.performanceType === 'navigation') {
        const navData = perfData as RawNavigationPerformanceData;
        const durationMs = navData.durationMs;

        // 10. Slow Navigation Timing
        if (typeof durationMs === 'number' && !Number.isNaN(durationMs) && durationMs >= config.slowNavigation.warningMs) {
          let severity: FindingSeverity = 'medium';
          if (durationMs >= config.slowNavigation.highMs) {
            severity = 'high';
          }

          findings.push(
            createFinding(
              pattern,
              'slow_navigation',
              severity,
              'Slow navigation timing observed',
              `Page navigation duration of ${durationMs}ms exceeded the configured threshold (${config.slowNavigation.warningMs}ms).`,
              0.9,
              { durationMs, url: navData.sourceUrl ?? undefined }
            )
          );
        }
      }

      break;
    }
  }

  return findings;
}

/**
 * Groups multiple individual long-task findings on a page into a high-signal
 * 'main_thread_performance_degradation' finding with statistical distribution and severe representative tasks.
 */
export function groupPerformanceFindings(findings: EngineeringFinding[]): EngineeringFinding[] {
  const nonLongTaskFindings: EngineeringFinding[] = [];
  const longTaskFindings: EngineeringFinding[] = [];

  for (const f of findings) {
    if (f.findingType === 'long_task') {
      longTaskFindings.push(f);
    } else {
      nonLongTaskFindings.push(f);
    }
  }

  // If 3 or fewer long tasks, keep them individual
  if (longTaskFindings.length <= 3) {
    return findings;
  }

  // Aggregate long tasks into a single high-signal degradation finding
  const count = longTaskFindings.length;
  const allEventIds = longTaskFindings.flatMap((f) => f.evidence.eventIds);
  const durations = longTaskFindings.map((f) => f.evidence.durationMs || 50);

  const maxDurationMs = Math.max(...durations);
  const minDurationMs = Math.min(...durations);
  const totalBlockedTimeMs = durations.reduce((sum, d) => sum + d, 0);
  const averageDurationMs = Math.round(totalBlockedTimeMs / count);

  const tasksOver100ms = durations.filter((d) => d >= 100).length;
  const tasksOver500ms = durations.filter((d) => d >= 500).length;
  const tasksOver1000ms = durations.filter((d) => d >= 1000).length;

  const sortedByDuration = [...longTaskFindings].sort(
    (a, b) => (b.evidence.durationMs || 0) - (a.evidence.durationMs || 0)
  );

  const representativeTasks: RepresentativeTaskItem[] = sortedByDuration.slice(0, 5).map((f) => ({
    eventId: f.evidence.eventIds[0] || f.findingId,
    durationMs: f.evidence.durationMs || 0,
    startTime: f.evidence.startTime,
    sourceUrl: f.evidence.url
  }));

  const firstSeenAt = longTaskFindings[0]!.evidence.firstSeenAt;
  const lastSeenAt = longTaskFindings[longTaskFindings.length - 1]!.evidence.lastSeenAt;
  const timeSpanMs = Math.max(0, new Date(lastSeenAt).getTime() - new Date(firstSeenAt).getTime());

  let severity: FindingSeverity = 'medium';
  if (maxDurationMs >= 1000 || tasksOver1000ms >= 2 || totalBlockedTimeMs >= 3000) {
    severity = 'high';
  } else if (maxDurationMs >= 500 || tasksOver500ms >= 3) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  const baseFinding = longTaskFindings[0]!;
  const groupedFinding: EngineeringFinding = {
    findingId: `fnd_main_thread_performance_degradation_${baseFinding.context.pageId}`,
    findingType: 'main_thread_performance_degradation',
    category: 'performance',
    severity,
    title: `Main-Thread Performance Degradation (${count} long tasks, ${Math.round(totalBlockedTimeMs)}ms total)`,
    description: `Observed ${count} main-thread blocking tasks totaling ${Math.round(totalBlockedTimeMs)}ms (max: ${Math.round(maxDurationMs)}ms, average: ${averageDurationMs}ms).`,
    confidence: 0.95,
    context: { ...baseFinding.context },
    evidence: {
      aggregationId: `agg_perf_degradation_${baseFinding.context.pageId}`,
      eventIds: allEventIds,
      count,
      firstSeenAt,
      lastSeenAt,
      timeSpanMs,
      minDurationMs,
      maxDurationMs,
      averageDurationMs,
      totalBlockedTimeMs,
      tasksOver100ms,
      tasksOver500ms,
      tasksOver1000ms,
      representativeTasks
    }
  };

  return [...nonLongTaskFindings, groupedFinding];
}
