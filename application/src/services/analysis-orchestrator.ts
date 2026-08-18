import { SessionRepository } from '../repository/session-repository.js';
import { AIAnalysisRepository } from '../repository/ai-analysis-repository.js';
import { AIAnalysisFindingInput, AIAnalysisResultPackage } from '../types/ai-models.js';
import { NotFoundError, BadRequestError } from './query-service.js';

export interface AnalysisOrchestrationResult {
  success: boolean;
  sessionId: string;
  processedPages: string[];
  batches: string[];
}

export class AnalysisOrchestrator {
  public readonly aiServiceUrl: string;

  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly aiRepo: AIAnalysisRepository,
    aiServiceUrl: string = process.env['AI_SERVICE_URL'] || 'http://localhost:8000'
  ) {
    this.aiServiceUrl = aiServiceUrl;
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

    for (const website of websites) {
      const pages = await this.sessionRepo.getPagesForWebsite(sessionId, website.websiteId);
      const targetPages = pages.filter((p) => pageIds.includes(p.pageId));

      for (const page of targetPages) {
        const events = await this.sessionRepo.getEventsForPage(sessionId, website.websiteId, page.pageId);
        const batchId = `batch_${sessionId}_${website.websiteId}_${page.pageId}`;

        // 1. Build deterministic findings from page telemetry
        const findings: AIAnalysisFindingInput[] = [];

        // Network analysis
        const networkEvents = events.filter((e) => e.type === 'network');
        const urlCounts = new Map<string, typeof networkEvents>();
        for (const e of networkEvents) {
          const url = (e.data['url'] as string) || '';
          if (!urlCounts.has(url)) urlCounts.set(url, []);
          urlCounts.get(url)!.push(e);
        }

        for (const [url, evts] of urlCounts.entries()) {
          if (evts.length >= 3) {
            const firstEvt = evts[0]!;
            findings.push({
              findingId: `fnd_rep_net_${page.pageId}_${findings.length + 1}`,
              findingType: 'repeated_network_request',
              category: 'network',
              severity: 'medium',
              title: 'Repeated network request detected',
              observedFact: `Observed ${evts.length} identical ${firstEvt.data['method'] || 'GET'} requests to ${url}.`,
              possibleInterpretation: 'Repeated polling or un-debounced component state updates.',
              requiredAdditionalContext: 'Examine state update triggers in component lifecycle.',
              analysis: `${evts.length} network requests were issued in rapid succession.`,
              confidence: 0.95,
              likelyImpact: 'Unnecessary client CPU utilization and extra server load.',
              evidence: {
                count: evts.length,
                url,
                method: firstEvt.data['method'] || 'GET',
                status: firstEvt.data['status'] || 200,
                eventIds: evts.map((e) => e.eventId)
              }
            });
          }

          for (const e of evts) {
            const status = Number(e.data['status'] || 0);
            if (status >= 400) {
              findings.push({
                findingId: `fnd_fail_net_${page.pageId}_${findings.length + 1}`,
                findingType: 'failed_network_request',
                category: 'network',
                severity: status >= 500 ? 'high' : 'low',
                title: `HTTP ${status} response observed`,
                observedFact: `Observed HTTP error (${status}) for ${url}.`,
                possibleInterpretation: 'Missing resource endpoint or server route misconfiguration.',
                requiredAdditionalContext: 'Verify API endpoint route registration and server logs.',
                analysis: `Request failed with HTTP status ${status}.`,
                confidence: 1.0,
                likelyImpact: 'Client view may render incomplete data or throw uncaught errors.',
                evidence: {
                  url,
                  status,
                  method: e.data['method'] || 'GET',
                  eventIds: [e.eventId]
                }
              });
            }
          }
        }

        // Performance analysis
        const perfEvents = events.filter((e) => e.type === 'performance');
        for (const e of perfEvents) {
          const duration = Number(e.data['duration'] || e.data['durationMs'] || 0);
          if (duration >= 50) {
            findings.push({
              findingId: `fnd_long_task_${page.pageId}_${findings.length + 1}`,
              findingType: 'long_task',
              category: 'performance',
              severity: duration > 100 ? 'high' : 'medium',
              title: 'Main thread long task observed',
              observedFact: `A long task lasting ${duration}ms was observed blocking the execution thread.`,
              possibleInterpretation: 'Heavy synchronous script execution or un-optimized layout recalculation.',
              requiredAdditionalContext: 'Profile JavaScript call tree during page interaction.',
              analysis: `Main thread was blocked for ${duration}ms.`,
              confidence: 0.95,
              likelyImpact: 'Temporary UI freezing, input lag, and frame drops.',
              evidence: {
                durationMs: duration,
                eventIds: [e.eventId]
              }
            });
          }
        }

        // 2. Prepare AI Analysis Package
        const analysisPackage: AIAnalysisResultPackage = {
          batchId,
          sessionId,
          websiteId: website.websiteId,
          pageId: page.pageId,
          websiteOrigin: website.origin,
          schemaVersion: '3A.1',
          analysisVersion: '3C.1',
          status: 'completed',
          summary: `Analyzed ${findings.length} runtime engineering findings on page ${page.url}.`,
          engineeringAssessment: findings.length > 0
            ? `Identified ${findings.length} runtime patterns affecting performance or network traffic.`
            : 'No abnormal runtime patterns detected during this session.',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          findings
        };

        // 3. Persist analysis results into Supabase
        await this.aiRepo.saveAnalysisResult(analysisPackage);

        processedPages.push(page.pageId);
        generatedBatches.push(batchId);
      }
    }

    return {
      success: true,
      sessionId,
      processedPages,
      batches: generatedBatches
    };
  }
}
