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
  FindingType
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

function createEvidence(pattern: AggregatedPattern, extras: Partial<FindingEvidence> = {}): FindingEvidence {
  return {
    aggregationId: pattern.aggregationId,
    eventIds: [...pattern.eventIds],
    count: pattern.count,
    firstSeenAt: pattern.firstSeenAt,
    lastSeenAt: pattern.lastSeenAt,
    timeSpanMs: pattern.timeSpanMs,
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
      const method = netKey.method || netData.method;
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
            `The same ${method} request to ${url} was observed ${pattern.count} times within approximately ${Math.round(pattern.timeSpanMs / 1000)}s on this page.`,
            0.95,
            { url, method, status, durationMs }
          )
        );
      }

      // 2. Network Transport Failure
      if (netData.failureType === 'network' || (status === null && netData.errorMessage)) {
        findings.push(
          createFinding(
            pattern,
            'network_transport_failure',
            'high',
            'Network transport failure observed',
            `A network transport error (${netData.errorMessage || netData.failureType || 'connection failure'}) was observed for ${method} ${url}.`,
            1.0,
            { url, method, failureType: netData.failureType, errorMessage: netData.errorMessage }
          )
        );
      } else if (typeof status === 'number' && status >= 400) {
        // 3. Failed Network Request (HTTP 4xx / 5xx)
        let severity: FindingSeverity = 'medium';
        if (status >= 500) {
          severity = 'high';
        } else if (status === 401 || status === 403 || status === 404) {
          severity = 'low';
        }

        const statusCategory = status >= 500 ? 'Server-side HTTP' : 'Client-side HTTP';

        findings.push(
          createFinding(
            pattern,
            'failed_network_request',
            severity,
            `HTTP ${status} response observed`,
            `Observed ${statusCategory} error (HTTP ${status} ${netData.statusText || ''}) for ${method} ${url}.`,
            1.0,
            { url, method, status, statusText: netData.statusText, durationMs }
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
              { level, message }
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
              { level, message }
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
              'Slow resource loading observed',
              `Resource "${name}" load duration of ${durationMs}ms exceeded the configured threshold (${config.slowResource.warningMs}ms).`,
              0.9,
              { url: name, initiatorType, durationMs, decodedBodySize: resData.decodedBodySize, transferSize: resData.transferSize }
            )
          );
        }

        // 8. Large Resource Payload
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
              { url: name, initiatorType, decodedBodySize: resData.decodedBodySize, transferSize: resData.transferSize, encodedBodySize: resData.encodedBodySize }
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
