import { SessionRepository } from '../repository/session-repository.js';
import { AIAnalysisRepository } from '../repository/ai-analysis-repository.js';
import {
  FindingDto,
  FindingTypeSummaryDto,
  PageAnalysisDto,
  PageListItemDto,
  PageOverviewDto,
  RouteDto,
  RuntimeEventDto,
  SessionListItemDto,
  SessionOverviewDto,
  SeveritySummaryDto,
  WebsiteDto
} from '../api/schemas/responses.js';
import { AIAnalysisFindingRecord } from '../types/ai-models.js';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const VALID_FINDING_TYPES = new Set([
  'repeated_network_request',
  'failed_network_request',
  'network_transport_failure',
  'slow_network_request',
  'repeated_console_error',
  'repeated_console_warning',
  'long_task',
  'slow_resource',
  'large_resource',
  'repeated_resource',
  'slow_navigation'
]);

export function calculateSeveritySummary(findings: AIAnalysisFindingRecord[]): SeveritySummaryDto {
  const summary: SeveritySummaryDto = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  for (const f of findings) {
    const sev = f.severity.toLowerCase();
    if (sev in summary) {
      summary[sev as keyof SeveritySummaryDto]++;
    }
  }

  return summary;
}

export function calculateFindingTypeSummary(findings: AIAnalysisFindingRecord[]): FindingTypeSummaryDto {
  const summary: FindingTypeSummaryDto = {};
  for (const f of findings) {
    summary[f.findingType] = (summary[f.findingType] || 0) + 1;
  }
  return summary;
}

export function findingRecordToDto(record: AIAnalysisFindingRecord): FindingDto {
  return {
    findingId: record.findingId,
    batchId: record.batchId,
    sessionId: record.sessionId,
    websiteId: record.websiteId,
    pageId: record.pageId,
    findingType: record.findingType,
    category: record.category,
    severity: record.severity,
    title: record.title,
    observedFact: record.observedFact,
    possibleInterpretation: record.possibleInterpretation,
    requiredAdditionalContext: record.requiredAdditionalContext,
    analysis: record.analysis,
    confidence: record.confidence,
    likelyImpact: record.likelyImpact,
    evidence: record.evidence,
    createdAt: record.createdAt
  };
}

export class QueryService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly aiRepo: AIAnalysisRepository
  ) {}

  /**
   * Lists all sessions.
   */
  async listSessions(): Promise<SessionListItemDto[]> {
    const sessions = await this.sessionRepo.listSessions();
    return sessions.map((s) => ({
      sessionId: s.sessionId,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationMs: s.durationMs,
      rootUrl: s.rootUrl,
      activeTabId: s.activeTabId,
      persistedAt: s.persistedAt
    }));
  }

  /**
   * Retrieves single session overview with summary counts.
   */
  async getSessionOverview(sessionId: string): Promise<SessionOverviewDto> {
    const session = await this.sessionRepo.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found.`);
    }

    const websites = await this.sessionRepo.getWebsitesForSession(sessionId);
    let totalPages = 0;
    for (const w of websites) {
      const pages = await this.sessionRepo.getPagesForWebsite(sessionId, w.websiteId);
      totalPages += pages.length;
    }

    const findings = await this.aiRepo.getFindingsForSession(sessionId);

    return {
      session: {
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMs: session.durationMs,
        rootUrl: session.rootUrl,
        activeTabId: session.activeTabId,
        persistedAt: session.persistedAt
      },
      websiteCount: websites.length,
      pageCount: totalPages,
      totalFindings: findings.length,
      severitySummary: calculateSeveritySummary(findings),
      findingTypeSummary: calculateFindingTypeSummary(findings)
    };
  }

  /**
   * Lists all websites for a session with counts.
   */
  async getWebsitesForSession(sessionId: string): Promise<WebsiteDto[]> {
    const session = await this.sessionRepo.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found.`);
    }

    const websites = await this.sessionRepo.getWebsitesForSession(sessionId);
    const result: WebsiteDto[] = [];

    for (const w of websites) {
      const pages = await this.sessionRepo.getPagesForWebsite(sessionId, w.websiteId);
      const findings = await this.aiRepo.getFindingsForWebsite(sessionId, w.websiteId);
      result.push({
        websiteId: w.websiteId,
        sessionId: w.sessionId,
        origin: w.origin,
        firstSeenAt: w.firstSeenAt,
        lastSeenAt: w.lastSeenAt,
        pageCount: pages.length,
        findingCount: findings.length
      });
    }

    return result;
  }

  /**
   * Retrieves single website overview.
   */
  async getWebsiteOverview(sessionId: string, websiteId: string): Promise<WebsiteDto> {
    const website = await this.sessionRepo.getWebsite(sessionId, websiteId);
    if (!website) {
      throw new NotFoundError(`Website '${websiteId}' not found under session '${sessionId}'.`);
    }

    const pages = await this.sessionRepo.getPagesForWebsite(sessionId, websiteId);
    const findings = await this.aiRepo.getFindingsForWebsite(sessionId, websiteId);

    return {
      websiteId: website.websiteId,
      sessionId: website.sessionId,
      origin: website.origin,
      firstSeenAt: website.firstSeenAt,
      lastSeenAt: website.lastSeenAt,
      pageCount: pages.length,
      findingCount: findings.length
    };
  }

  /**
   * Lists all pages for a website with counts.
   */
  async getPagesForWebsite(sessionId: string, websiteId: string): Promise<PageListItemDto[]> {
    const website = await this.sessionRepo.getWebsite(sessionId, websiteId);
    if (!website) {
      throw new NotFoundError(`Website '${websiteId}' not found under session '${sessionId}'.`);
    }

    const pages = await this.sessionRepo.getPagesForWebsite(sessionId, websiteId);
    const result: PageListItemDto[] = [];

    for (const p of pages) {
      const routes = await this.sessionRepo.getRoutesForPage(sessionId, websiteId, p.pageId);
      const findings = (await this.aiRepo.getFindingsForBatch(
        (await this.aiRepo.getAnalysisBatchForPage(sessionId, websiteId, p.pageId))?.batchId || ''
      )) || [];

      result.push({
        pageId: p.pageId,
        sessionId: p.sessionId,
        websiteId: p.websiteId,
        websiteOrigin: p.websiteOrigin,
        tabId: p.tabId,
        url: p.url,
        title: p.title,
        createdAt: p.createdAt,
        routeCount: routes.length,
        findingCount: findings.length
      });
    }

    return result;
  }

  /**
   * Retrieves page overview.
   */
  async getPageOverview(sessionId: string, websiteId: string, pageId: string): Promise<PageOverviewDto> {
    const website = await this.sessionRepo.getWebsite(sessionId, websiteId);
    if (!website) {
      throw new NotFoundError(`Website '${websiteId}' not found under session '${sessionId}'.`);
    }

    const pages = await this.sessionRepo.getPagesForWebsite(sessionId, websiteId);
    const page = pages.find((p) => p.pageId === pageId);
    if (!page) {
      throw new NotFoundError(`Page '${pageId}' not found under website '${websiteId}'.`);
    }

    const routes = await this.sessionRepo.getRoutesForPage(sessionId, websiteId, pageId);
    const events = await this.sessionRepo.getEventsForPage(sessionId, websiteId, pageId);

    const batch = await this.aiRepo.getAnalysisBatchForPage(sessionId, websiteId, pageId);
    const findings = batch ? await this.aiRepo.getFindingsForBatch(batch.batchId) : [];

    return {
      page: {
        pageId: page.pageId,
        sessionId: page.sessionId,
        websiteId: page.websiteId,
        websiteOrigin: page.websiteOrigin,
        tabId: page.tabId,
        url: page.url,
        title: page.title,
        createdAt: page.createdAt,
        routeCount: routes.length,
        findingCount: findings.length
      },
      routeCount: routes.length,
      eventCount: events.length,
      findingCount: findings.length,
      severitySummary: calculateSeveritySummary(findings),
      findingTypeSummary: calculateFindingTypeSummary(findings)
    };
  }

  /**
   * Retrieves routes for a page.
   */
  async getRoutesForPage(sessionId: string, websiteId: string, pageId: string): Promise<RouteDto[]> {
    await this.getPageOverview(sessionId, websiteId, pageId); // Hierarchical existence check
    const routes = await this.sessionRepo.getRoutesForPage(sessionId, websiteId, pageId);
    return routes;
  }

  /**
   * Retrieves raw runtime events for a page.
   */
  async getEventsForPage(sessionId: string, websiteId: string, pageId: string): Promise<RuntimeEventDto[]> {
    await this.getPageOverview(sessionId, websiteId, pageId); // Hierarchical existence check
    const events = await this.sessionRepo.getEventsForPage(sessionId, websiteId, pageId);
    return events;
  }

  /**
   * Retrieves findings for a session with optional filters.
   */
  async getFindingsForSession(
    sessionId: string,
    filters: { severity?: string; findingType?: string } = {}
  ): Promise<FindingDto[]> {
    const session = await this.sessionRepo.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found.`);
    }

    if (filters.severity && !VALID_SEVERITIES.has(filters.severity.toLowerCase())) {
      throw new BadRequestError(`Invalid severity filter: '${filters.severity}'.`);
    }
    if (filters.findingType && !VALID_FINDING_TYPES.has(filters.findingType)) {
      throw new BadRequestError(`Invalid findingType filter: '${filters.findingType}'.`);
    }

    let findings = await this.aiRepo.getFindingsForSession(sessionId);

    if (filters.severity) {
      const sev = filters.severity.toLowerCase();
      findings = findings.filter((f) => f.severity.toLowerCase() === sev);
    }
    if (filters.findingType) {
      findings = findings.filter((f) => f.findingType === filters.findingType);
    }

    return findings.map(findingRecordToDto);
  }

  /**
   * Retrieves findings for a website with optional filters.
   */
  async getFindingsForWebsite(
    sessionId: string,
    websiteId: string,
    filters: { severity?: string; findingType?: string } = {}
  ): Promise<FindingDto[]> {
    const website = await this.sessionRepo.getWebsite(sessionId, websiteId);
    if (!website) {
      throw new NotFoundError(`Website '${websiteId}' not found under session '${sessionId}'.`);
    }

    if (filters.severity && !VALID_SEVERITIES.has(filters.severity.toLowerCase())) {
      throw new BadRequestError(`Invalid severity filter: '${filters.severity}'.`);
    }
    if (filters.findingType && !VALID_FINDING_TYPES.has(filters.findingType)) {
      throw new BadRequestError(`Invalid findingType filter: '${filters.findingType}'.`);
    }

    let findings = await this.aiRepo.getFindingsForWebsite(sessionId, websiteId);

    if (filters.severity) {
      const sev = filters.severity.toLowerCase();
      findings = findings.filter((f) => f.severity.toLowerCase() === sev);
    }
    if (filters.findingType) {
      findings = findings.filter((f) => f.findingType === filters.findingType);
    }

    return findings.map(findingRecordToDto);
  }

  /**
   * Retrieves findings for a page.
   */
  async getFindingsForPage(sessionId: string, websiteId: string, pageId: string): Promise<FindingDto[]> {
    await this.getPageOverview(sessionId, websiteId, pageId); // Hierarchical existence check

    const batch = await this.aiRepo.getAnalysisBatchForPage(sessionId, websiteId, pageId);
    if (!batch) {
      return [];
    }

    const findings = await this.aiRepo.getFindingsForBatch(batch.batchId);
    return findings.map(findingRecordToDto);
  }

  /**
   * Retrieves comprehensive page analysis.
   */
  async getPageAnalysis(sessionId: string, websiteId: string, pageId: string): Promise<PageAnalysisDto> {
    const session = await this.sessionRepo.getSession(sessionId);
    if (!session) {
      throw new NotFoundError(`Session '${sessionId}' not found.`);
    }

    const website = await this.sessionRepo.getWebsite(sessionId, websiteId);
    if (!website) {
      throw new NotFoundError(`Website '${websiteId}' not found under session '${sessionId}'.`);
    }

    const pages = await this.sessionRepo.getPagesForWebsite(sessionId, websiteId);
    const page = pages.find((p) => p.pageId === pageId);
    if (!page) {
      throw new NotFoundError(`Page '${pageId}' not found under website '${websiteId}'.`);
    }

    const routes = await this.sessionRepo.getRoutesForPage(sessionId, websiteId, pageId);
    const batch = await this.aiRepo.getAnalysisBatchForPage(sessionId, websiteId, pageId);
    const findings = batch ? await this.aiRepo.getFindingsForBatch(batch.batchId) : [];

    return {
      session: {
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMs: session.durationMs,
        rootUrl: session.rootUrl,
        activeTabId: session.activeTabId,
        persistedAt: session.persistedAt
      },
      website: {
        websiteId: website.websiteId,
        sessionId: website.sessionId,
        origin: website.origin,
        firstSeenAt: website.firstSeenAt,
        lastSeenAt: website.lastSeenAt
      },
      page: {
        pageId: page.pageId,
        sessionId: page.sessionId,
        websiteId: page.websiteId,
        websiteOrigin: page.websiteOrigin,
        tabId: page.tabId,
        url: page.url,
        title: page.title,
        createdAt: page.createdAt
      },
      routes,
      analysisSummary: batch?.summary || 'No AI analysis available for this page.',
      engineeringAssessment: batch?.engineeringAssessment || null,
      findings: findings.map(findingRecordToDto),
      totalFindings: findings.length,
      severitySummary: calculateSeveritySummary(findings),
      findingTypeSummary: calculateFindingTypeSummary(findings)
    };
  }
}
