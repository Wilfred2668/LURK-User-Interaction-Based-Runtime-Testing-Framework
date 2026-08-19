import { SessionRepository } from '../repository/session-repository.js';
import { AIAnalysisRepository } from '../repository/ai-analysis-repository.js';
import { AIAnalysisFindingInput, AIAnalysisResultPackage } from '../types/ai-models.js';
import { NotFoundError, BadRequestError } from './query-service.js';

export interface AnalysisOrchestrationResult {
  success: boolean;
  sessionId: string;
  processedPages: string[];
  batches: string[];
  mode?: 'llm' | 'deterministic' | 'deterministic_fallback';
}

interface InteractionData {
  interactionType?: string;
  elementTag?: string;
  elementId?: string | null;
  elementClasses?: string | null;
  elementRole?: string | null;
  accessibleLabel?: string | null;
  textPreview?: string | null;
  selector?: string | null;
}

function findPrecedingInteractionForTimestamp(
  targetTimestamp: string,
  events: Array<{ type: string; timestamp: string; data: Record<string, unknown> }>,
  maxLookbackMs = 1500
): {
  interactionType: string;
  elementTag: string;
  elementId?: string | null;
  elementClasses?: string | null;
  textPreview?: string | null;
  selector?: string | null;
  timeDeltaMs: number;
} | null {
  const targetTime = new Date(targetTimestamp).getTime();
  if (Number.isNaN(targetTime)) return null;

  let closest: { data: InteractionData; timeDeltaMs: number } | null = null;

  for (const e of events) {
    if (e.type !== 'interaction' || !e.data) continue;
    const interactionTime = new Date(e.timestamp).getTime();
    if (Number.isNaN(interactionTime)) continue;

    const timeDeltaMs = targetTime - interactionTime;
    if (timeDeltaMs >= 0 && timeDeltaMs <= maxLookbackMs) {
      if (!closest || timeDeltaMs < closest.timeDeltaMs) {
        closest = {
          data: e.data as InteractionData,
          timeDeltaMs
        };
      }
    }
  }

  if (!closest) return null;

  return {
    interactionType: closest.data.interactionType || 'click',
    elementTag: closest.data.elementTag || 'BUTTON',
    elementId: closest.data.elementId || null,
    elementClasses: closest.data.elementClasses || null,
    textPreview: closest.data.textPreview || null,
    selector: closest.data.selector || null,
    timeDeltaMs: closest.timeDeltaMs
  };
}

export class AnalysisOrchestrator {
  public readonly aiServiceUrl: string;

  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly aiRepo: AIAnalysisRepository,
    aiServiceUrl: string = process.env['AI_SERVICE_URL'] || 'http://localhost:8000'
  ) {
    this.aiServiceUrl = aiServiceUrl.replace(/\/+$/, '');
  }

  /**
   * Triggers user-controlled AI analysis on selected pages for a given session.
   */
  async runAnalysisForPages(
    sessionId: string,
    pageIds: string[]
  ): Promise<AnalysisOrchestrationResult> {
    if (!pageIds || pageIds.length === 0) {
      throw new BadRequestError('At least one page must be selected for analysis.');
    }

    const session = await this.sessionRepo.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found.`);
    }

    const websites = await this.sessionRepo.getWebsitesForSession(sessionId);
    const processedPages: string[] = [];
    const generatedBatches: string[] = [];
    let overallMode: 'llm' | 'deterministic' | 'deterministic_fallback' = 'deterministic';

    for (const website of websites) {
      const pages = await this.sessionRepo.getPagesForWebsite(sessionId, website.websiteId);
      const targetPages = pages.filter((p) => pageIds.includes(p.pageId));

      for (const page of targetPages) {
        const routes = await this.sessionRepo.getRoutesForPage(sessionId, website.websiteId, page.pageId);
        const events = await this.sessionRepo.getEventsForPage(sessionId, website.websiteId, page.pageId);
        const batchId = `batch_${sessionId}_${website.websiteId}_${page.pageId}`;

        // 1. Build deterministic findings from page telemetry
        const findings: AIAnalysisFindingInput[] = [];
        let networkFailures = 0;
        let repeatedRequests = 0;
        let longTasks = 0;
        let consoleErrors = 0;

        // Group network events by URL
        const networkEvents = events.filter((e) => e.type === 'network');
        const urlCounts = new Map<string, typeof networkEvents>();
        for (const e of networkEvents) {
          const url = (e.data['url'] as string) || '';
          if (!urlCounts.has(url)) urlCounts.set(url, []);
          urlCounts.get(url)!.push(e);
        }

        for (const [url, evts] of urlCounts.entries()) {
          const firstEvt = evts[0]!;
          const lastEvt = evts[evts.length - 1]!;
          const method = String(firstEvt.data['method'] || 'GET');
          const status = firstEvt.data['status'] !== null && firstEvt.data['status'] !== undefined ? Number(firstEvt.data['status']) : null;

          let origin = website.origin;
          let shortPath = url;
          try {
            const parsed = new URL(url);
            origin = parsed.origin;
            shortPath = parsed.pathname;
          } catch {
            // fallback
          }

          const firstTime = new Date(firstEvt.timestamp).getTime();
          const lastTime = new Date(lastEvt.timestamp).getTime();
          const timeSpanMs = Math.max(0, lastTime - firstTime);
          const precedingInteraction = findPrecedingInteractionForTimestamp(firstEvt.timestamp, events);

          // Repeated requests
          if (evts.length >= 3) {
            repeatedRequests += evts.length;
            const spanSec = (timeSpanMs / 1000).toFixed(1);
            const spanText = timeSpanMs > 0 ? ` over ${spanSec}s` : '';

            findings.push({
              findingId: `fnd_rep_net_${page.pageId}_${findings.length + 1}`,
              findingType: 'repeated_network_request',
              category: 'network',
              severity: evts.length >= 20 ? 'high' : 'medium',
              title: `Repeated API Request (${method} ${shortPath})`,
              observedFact: `${method} ${shortPath} was called ${evts.length} times${spanText}.`,
              possibleInterpretation: precedingInteraction
                ? `Rapid repeated requests observed shortly after user ${precedingInteraction.interactionType} on "${precedingInteraction.textPreview || precedingInteraction.elementTag}". Possible missing debounce, polling loop, or component re-render.`
                : 'Undebounced event handler, component re-render cycle, or interval polling loop.',
              requiredAdditionalContext: 'Verify component lifecycle triggers, caching headers, and debounce configurations.',
              analysis: `${evts.length} identical ${method} requests were issued${spanText}. Host: ${origin}.`,
              confidence: 0.95,
              likelyImpact: 'Unnecessary network bandwidth usage and extra server CPU overhead.',
              evidence: {
                count: evts.length,
                url,
                origin,
                path: shortPath,
                method,
                status,
                firstSeenAt: firstEvt.timestamp,
                lastSeenAt: lastEvt.timestamp,
                timeSpanMs,
                aggregationId: `agg_net_${page.pageId}_${firstEvt.eventId}`,
                eventIds: evts.map((e) => e.eventId),
                interactionTrigger: precedingInteraction
              }
            });
          }

          // Failed requests & transport failures
          for (const e of evts) {
            const evStatus = e.data['status'] !== null && e.data['status'] !== undefined ? Number(e.data['status']) : null;
            const isNetworkFailure = e.data['failureType'] === 'network' || (evStatus === null && e.data['ok'] === false);
            const errMsg = (e.data['errorMessage'] as string) || null;
            const reqInteraction = findPrecedingInteractionForTimestamp(e.timestamp, events);

            if (isNetworkFailure) {
              networkFailures++;
              findings.push({
                findingId: `fnd_net_transport_${e.eventId}`,
                findingType: 'failed_network_request',
                category: 'network',
                severity: 'high',
                title: `Failed Network Operation (${method} ${shortPath})`,
                observedFact: `Network transport failure on ${method} ${shortPath}: ${errMsg || 'Connection failed / CORS / Aborted'}.`,
                possibleInterpretation: 'Network transport failure. Available telemetry does not establish whether the cause was client offline status, CORS policy mismatch, DNS lookup failure, or request abort.',
                requiredAdditionalContext: 'Verify browser network devtools tab, CORS response headers on server, and proxy configuration.',
                analysis: `The fetch operation encountered a client-side transport error before receiving an HTTP response.`,
                confidence: 0.95,
                likelyImpact: 'Data failed to load, leading to empty state or broken UI component.',
                evidence: {
                  url,
                  origin,
                  path: shortPath,
                  method,
                  status: null,
                  ok: false,
                  failureType: 'network',
                  errorMessage: errMsg,
                  firstSeenAt: e.timestamp,
                  lastSeenAt: e.timestamp,
                  timeSpanMs: 0,
                  aggregationId: `agg_net_fail_${e.eventId}`,
                  eventIds: [e.eventId],
                  interactionTrigger: reqInteraction
                }
              });
            } else if (evStatus !== null && evStatus >= 400) {
              networkFailures++;
              const isServerErr = evStatus >= 500;
              findings.push({
                findingId: `fnd_fail_net_${e.eventId}`,
                findingType: 'failed_network_request',
                category: 'network',
                severity: isServerErr ? 'high' : 'low',
                title: `API Request Failed (HTTP ${evStatus} on ${shortPath})`,
                observedFact: `${method} ${shortPath} failed with HTTP ${evStatus} (${e.data['statusText'] || 'Error'}).`,
                possibleInterpretation: isServerErr
                  ? 'Server-side crash, internal database connection error, or gateway timeout.'
                  : evStatus === 401 || evStatus === 403
                  ? 'Unauthorized or expired session credentials on this specific endpoint.'
                  : 'Requested resource not found or invalid client request parameters.',
                requiredAdditionalContext: 'Inspect backend API server logs and verify payload parameters.',
                analysis: `Request failed with HTTP status ${evStatus}.`,
                confidence: 1.0,
                likelyImpact: isServerErr
                  ? 'Backend service error causing broken workflow or failed submission.'
                  : 'Client view may render missing data or prompt user for re-authentication.',
                evidence: {
                  url,
                  origin,
                  path: shortPath,
                  status: evStatus,
                  method,
                  firstSeenAt: e.timestamp,
                  lastSeenAt: e.timestamp,
                  timeSpanMs: 0,
                  aggregationId: `agg_fail_${e.eventId}`,
                  eventIds: [e.eventId],
                  interactionTrigger: reqInteraction
                }
              });
            }
          }
        }

        // Performance analysis: Group into meaningful patterns
        const perfEvents = events.filter((e) => e.type === 'performance');
        const longTaskEvents = perfEvents.filter((e) => {
          const dur = Number(e.data['duration'] || e.data['durationMs'] || 0);
          return dur >= 50;
        });

        longTasks = longTaskEvents.length;

        if (longTaskEvents.length > 0) {
          const durations = longTaskEvents.map((e) => Number(e.data['duration'] || e.data['durationMs'] || 0));
          const maxDurationMs = Math.max(...durations);
          const minDurationMs = Math.min(...durations);
          const totalBlockedTimeMs = durations.reduce((sum, d) => sum + d, 0);
          const averageDurationMs = Math.round(totalBlockedTimeMs / longTaskEvents.length);
          const tasksOver100ms = durations.filter((d) => d >= 100).length;
          const tasksOver500ms = durations.filter((d) => d >= 500).length;
          const tasksOver1000ms = durations.filter((d) => d >= 1000).length;

          const sortedTasks = [...longTaskEvents].sort(
            (a, b) => Number(b.data['duration'] || b.data['durationMs'] || 0) - Number(a.data['duration'] || a.data['durationMs'] || 0)
          );

          const representativeTasks = sortedTasks.slice(0, 5).map((e) => ({
            eventId: e.eventId,
            durationMs: Number(e.data['duration'] || e.data['durationMs'] || 0),
            startTime: Number(e.data['startTime'] || 0),
            sourceUrl: (e.data['sourceUrl'] as string) || undefined
          }));

          const worstEvent = sortedTasks[0]!;
          const perfInteraction = findPrecedingInteractionForTimestamp(worstEvent.timestamp, events);

          let perfSeverity: 'low' | 'medium' | 'high' = 'low';
          if (maxDurationMs >= 1000 || tasksOver1000ms >= 2 || totalBlockedTimeMs >= 3000) {
            perfSeverity = 'high';
          } else if (maxDurationMs >= 500 || tasksOver500ms >= 3) {
            perfSeverity = 'medium';
          }

          const worstSec = (maxDurationMs / 1000).toFixed(2);
          const totalSec = (totalBlockedTimeMs / 1000).toFixed(2);

          findings.push({
            findingId: `fnd_perf_degradation_${page.pageId}`,
            findingType: 'main_thread_performance_degradation',
            category: 'performance',
            severity: perfSeverity,
            title: `Main-Thread Performance Degradation (${longTaskEvents.length} long tasks, ${worstSec}s worst)`,
            observedFact: `Detected ${longTaskEvents.length} main-thread blocking tasks totaling ${totalSec}s (worst: ${worstSec}s, average: ${averageDurationMs}ms).`,
            possibleInterpretation: perfInteraction
              ? `Main thread stalled for ${worstSec}s shortly after user clicked "${perfInteraction.textPreview || perfInteraction.elementTag}". Possible heavy synchronous computation, expensive re-render, or unoptimized data parsing.`
              : 'Heavy synchronous script execution, complex DOM recalculation, or intensive data processing.',
            requiredAdditionalContext: 'Profile JavaScript execution flamegraph to isolate slow functions or heavy component renders.',
            analysis: `The browser main thread experienced ${longTaskEvents.length} execution pauses. ${tasksOver500ms} tasks exceeded 500ms.`,
            confidence: 0.95,
            likelyImpact: 'Temporary UI freezing, dropped animation frames, and delayed response to user input.',
            evidence: {
              count: longTaskEvents.length,
              maxDurationMs,
              minDurationMs,
              averageDurationMs,
              totalBlockedTimeMs,
              tasksOver100ms,
              tasksOver500ms,
              tasksOver1000ms,
              representativeTasks,
              aggregationId: `agg_perf_degradation_${page.pageId}`,
              eventIds: longTaskEvents.map((e) => e.eventId),
              interactionTrigger: perfInteraction
            }
          });
        }

        // Console error analysis with source location and stack extraction
        const consoleEvents = events.filter((e) => e.type === 'console');
        const groupedErrors = new Map<string, typeof consoleEvents>();

        for (const e of consoleEvents) {
          const level = String(e.data['level'] || '');
          const msg = String(e.data['message'] || '');
          if (level === 'error' || msg.includes('Uncaught') || msg.includes('TypeError') || msg.includes('Error')) {
            consoleErrors++;
            if (!groupedErrors.has(msg)) groupedErrors.set(msg, []);
            groupedErrors.get(msg)!.push(e);
          }
        }

        for (const [msg, errEvts] of groupedErrors.entries()) {
          const repErr = errEvts[0]!;
          const sourceUrl = (repErr.data['sourceUrl'] as string) || null;
          const lineNumber = repErr.data['lineNumber'] ? Number(repErr.data['lineNumber']) : null;
          const columnNumber = repErr.data['columnNumber'] ? Number(repErr.data['columnNumber']) : null;
          const stack = (repErr.data['stack'] as string) || null;
          const errInteraction = findPrecedingInteractionForTimestamp(repErr.timestamp, events);

          const isFetchError = msg.includes('Failed to fetch') || msg.includes('NetworkError');
          const isNullError = msg.includes('undefined') || msg.includes('null') || msg.includes('not a function');

          let sourceLabel = '';
          if (sourceUrl) {
            try {
              const parsed = new URL(sourceUrl);
              sourceLabel = `${parsed.pathname.split('/').pop() || sourceUrl}${lineNumber ? `:${lineNumber}` : ''}`;
            } catch {
              sourceLabel = `${sourceUrl}${lineNumber ? `:${lineNumber}` : ''}`;
            }
          }

          findings.push({
            findingId: `fnd_console_err_${repErr.eventId}`,
            findingType: 'unhandled_runtime_error',
            category: 'error',
            severity: 'critical',
            title: isFetchError
              ? `Runtime Error: Failed to fetch${sourceLabel ? ` (${sourceLabel})` : ''}`
              : `JavaScript Runtime Error: ${msg.slice(0, 45)}${sourceLabel ? ` (${sourceLabel})` : ''}`,
            observedFact: `Uncaught exception logged to browser console (${errEvts.length}x): "${msg}"`,
            possibleInterpretation: isFetchError
              ? 'Fetch promise rejected at runtime. Telemetry does not establish whether the cause was server downtime, network loss, CORS error, or aborted request.'
              : isNullError
              ? 'Attempted to access property or method on an undefined or null state value during render/handler execution.'
              : 'Unhandled JavaScript runtime exception.',
            requiredAdditionalContext: sourceUrl
              ? `Inspect ${sourceUrl}${lineNumber ? ` at line ${lineNumber}` : ''} around the failing call.`
              : 'Capture full unminified stack trace or source map.',
            analysis: `Exception occurred ${errEvts.length} time(s). Stack trace was ${stack ? 'captured' : 'unavailable'}.`,
            confidence: 1.0,
            likelyImpact: 'Can cause broken application views, unresponsive buttons, or incomplete workflow state.',
            evidence: {
              count: errEvts.length,
              message: msg,
              sourceUrl,
              lineNumber,
              columnNumber,
              stack,
              aggregationId: `agg_err_${repErr.eventId}`,
              eventIds: errEvts.map((e) => e.eventId),
              interactionTrigger: errInteraction
            }
          });
        }

        // 2. Prepare structured AI Context Batch payload for Python AI Service
        const aiBatchPayload = {
          schemaVersion: '3A.1',
          batchId,
          sessionId,
          websiteId: website.websiteId,
          websiteOrigin: website.origin,
          pageId: page.pageId,
          session: {
            sessionId: session.sessionId,
            status: session.status,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationMs: session.durationMs,
            rootUrl: session.rootUrl,
            activeTabId: session.activeTabId
          },
          website: {
            websiteId: website.websiteId,
            origin: website.origin,
            firstSeenAt: website.firstSeenAt,
            lastSeenAt: website.lastSeenAt
          },
          page: {
            pageId: page.pageId,
            sessionId: page.sessionId,
            websiteId: page.websiteId,
            websiteOrigin: website.origin,
            tabId: page.tabId,
            url: page.url,
            title: page.title,
            createdAt: page.createdAt
          },
          routes: routes.map((r) => ({
            routeId: r.routeId,
            pageId: r.pageId,
            websiteId: website.websiteId,
            websiteOrigin: website.origin,
            sessionId: r.sessionId,
            tabId: r.tabId,
            url: r.url,
            path: r.path,
            hash: r.hash,
            navigationType: r.navigationType,
            timestamp: r.timestamp
          })),
          summary: {
            consoleErrors,
            consoleWarnings: 0,
            networkFailures,
            repeatedRequests,
            longTasks,
            totalFindings: findings.length
          },
          findings: findings.map((f) => ({
            findingId: f.findingId,
            findingType: f.findingType,
            category: f.category,
            severity: f.severity,
            title: f.title,
            description: f.observedFact,
            confidence: f.confidence,
            context: {
              sessionId,
              websiteId: website.websiteId,
              websiteOrigin: website.origin,
              pageId: page.pageId,
              tabId: page.tabId
            },
            evidence: {
              aggregationId: f.evidence?.['aggregationId'] || `agg_${f.findingId}`,
              eventIds: f.evidence?.['eventIds'] || [],
              count: f.evidence?.['count'] || 1,
              firstSeenAt: f.evidence?.['firstSeenAt'] || page.createdAt,
              lastSeenAt: f.evidence?.['lastSeenAt'] || page.createdAt,
              timeSpanMs: f.evidence?.['timeSpanMs'] || 0,
              url: f.evidence?.['url'] || undefined,
              origin: f.evidence?.['origin'] || undefined,
              path: f.evidence?.['path'] || undefined,
              method: f.evidence?.['method'] || undefined,
              status: f.evidence?.['status'] !== undefined ? f.evidence?.['status'] : undefined,
              durationMs: f.evidence?.['durationMs'] || undefined,
              message: f.evidence?.['message'] || undefined,
              sourceUrl: f.evidence?.['sourceUrl'] || undefined,
              lineNumber: f.evidence?.['lineNumber'] || undefined,
              columnNumber: f.evidence?.['columnNumber'] || undefined,
              stack: f.evidence?.['stack'] || undefined,
              maxDurationMs: f.evidence?.['maxDurationMs'] || undefined,
              minDurationMs: f.evidence?.['minDurationMs'] || undefined,
              averageDurationMs: f.evidence?.['averageDurationMs'] || undefined,
              totalBlockedTimeMs: f.evidence?.['totalBlockedTimeMs'] || undefined,
              tasksOver100ms: f.evidence?.['tasksOver100ms'] || undefined,
              tasksOver500ms: f.evidence?.['tasksOver500ms'] || undefined,
              tasksOver1000ms: f.evidence?.['tasksOver1000ms'] || undefined,
              representativeTasks: f.evidence?.['representativeTasks'] || undefined,
              interactionTrigger: f.evidence?.['interactionTrigger'] || undefined
            }
          })),
          metadata: {
            samplingApplied: false,
            truncatedFindingsCount: 0,
            originalEventCount: events.length
          }
        };

        // 3. Invoke Python AI Service for LLM-powered interpretation
        let analysisResult: AIAnalysisResultPackage;
        try {
          const response = await fetch(`${this.aiServiceUrl}/api/v1/analyze?mode=llm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiBatchPayload)
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`AI service returned ${response.status}: ${errBody}`);
          }

          const rawJson = (await response.json()) as any;
          overallMode = rawJson.mode || 'llm';

          const mappedFindings = (rawJson.findings || []).map((rf: any, idx: number) => {
            const match = findings.find((df) => df.findingId === rf.findingId) || findings[idx];
            const mergedEvidence: Record<string, any> = {
              ...(match?.evidence || {}),
              ...(rf.evidence || {})
            };

            if (match?.evidence?.['eventIds'] && (!mergedEvidence['eventIds'] || mergedEvidence['eventIds'].length === 0)) {
              mergedEvidence['eventIds'] = match.evidence['eventIds'];
            }
            if (match?.evidence?.['maxDurationMs']) mergedEvidence['maxDurationMs'] = match.evidence['maxDurationMs'];
            if (match?.evidence?.['minDurationMs']) mergedEvidence['minDurationMs'] = match.evidence['minDurationMs'];
            if (match?.evidence?.['totalBlockedTimeMs']) mergedEvidence['totalBlockedTimeMs'] = match.evidence['totalBlockedTimeMs'];
            if (match?.evidence?.['tasksOver1000ms'] !== undefined) mergedEvidence['tasksOver1000ms'] = match.evidence['tasksOver1000ms'];
            if (match?.evidence?.['tasksOver500ms'] !== undefined) mergedEvidence['tasksOver500ms'] = match.evidence['tasksOver500ms'];
            if (match?.evidence?.['tasksOver100ms'] !== undefined) mergedEvidence['tasksOver100ms'] = match.evidence['tasksOver100ms'];
            if (match?.evidence?.['interactionTrigger']) mergedEvidence['interactionTrigger'] = match.evidence['interactionTrigger'];
            if (match?.evidence?.['representativeTasks']) mergedEvidence['representativeTasks'] = match.evidence['representativeTasks'];

            const observedFact = rf.observedFact && rf.observedFact.length > 10 && !rf.observedFact.includes('Pattern matched')
              ? rf.observedFact
              : match?.observedFact || 'Observed runtime event';

            const possibleInterpretation = rf.possibleInterpretation && rf.possibleInterpretation.length > 10 && !rf.possibleInterpretation.includes('Pattern matched')
              ? rf.possibleInterpretation
              : match?.possibleInterpretation || 'No specific interpretation available';

            const analysis = rf.analysis && rf.analysis.length > 10 && !rf.analysis.includes('Pattern matched')
              ? rf.analysis
              : match?.analysis || 'Analysis completed';

            return {
              findingId: rf.findingId || match?.findingId || `fnd_${page.pageId}_${idx + 1}`,
              findingType: rf.findingType || match?.findingType || 'observation',
              category: rf.category || match?.category || 'general',
              severity: rf.severity || match?.severity || 'medium',
              title: rf.title || match?.title || 'Observation',
              observedFact,
              possibleInterpretation,
              requiredAdditionalContext: rf.requiredAdditionalContext || match?.requiredAdditionalContext || 'Source code review required',
              analysis,
              confidence: rf.confidence ?? match?.confidence ?? 0.9,
              likelyImpact: rf.likelyImpact || match?.likelyImpact || undefined,
              evidence: mergedEvidence
            };
          });

          analysisResult = {
            batchId,
            sessionId,
            websiteId: website.websiteId,
            websiteOrigin: website.origin,
            pageId: page.pageId,
            summary: rawJson.overallSummary || `Analysis completed for ${page.title || page.url}`,
            engineeringAssessment: rawJson.engineeringAssessment || `Identified ${mappedFindings.length} runtime patterns affecting performance or reliability.`,
            findings: mappedFindings.length > 0 ? mappedFindings : findings,
            status: 'completed',
            createdAt: new Date().toISOString()
          };
        } catch (error) {
          console.warn(`[ORCHESTRATOR] AI Service unavailable or error (${(error as Error).message}). Using deterministic fallback.`);
          overallMode = 'deterministic_fallback';

          analysisResult = {
            batchId,
            sessionId,
            websiteId: website.websiteId,
            websiteOrigin: website.origin,
            pageId: page.pageId,
            summary: `Deterministic analysis identified ${findings.length} findings for ${page.title || page.url}.`,
            engineeringAssessment: `Identified ${findings.length} runtime patterns affecting performance or reliability.`,
            findings,
            status: 'completed',
            createdAt: new Date().toISOString()
          };
        }

        // 4. Persist analysis results into Supabase
        await this.aiRepo.saveAnalysisResult(analysisResult);
        processedPages.push(page.pageId);
        generatedBatches.push(batchId);
      }
    }

    return {
      success: true,
      sessionId,
      processedPages,
      batches: generatedBatches,
      mode: overallMode
    };
  }
}
