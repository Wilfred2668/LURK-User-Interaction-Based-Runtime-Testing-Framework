export interface SeveritySummaryDto {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export type FindingTypeSummaryDto = Record<string, number>;

export interface SessionListItemDto {
  sessionId: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  rootUrl: string | null;
  activeTabId: number | null;
  persistedAt: string;
}

export interface SessionOverviewDto {
  session: SessionListItemDto;
  websiteCount: number;
  pageCount: number;
  totalFindings: number;
  severitySummary: SeveritySummaryDto;
  findingTypeSummary: FindingTypeSummaryDto;
}

export interface WebsiteDto {
  websiteId: string;
  sessionId: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  pageCount?: number;
  findingCount?: number;
}

export interface PageListItemDto {
  pageId: string;
  sessionId: string;
  websiteId: string;
  websiteOrigin: string;
  tabId: number;
  url: string;
  title: string;
  createdAt: string;
  routeCount?: number;
  findingCount?: number;
}

export interface PageOverviewDto {
  page: PageListItemDto;
  routeCount: number;
  eventCount: number;
  findingCount: number;
  severitySummary: SeveritySummaryDto;
  findingTypeSummary: FindingTypeSummaryDto;
}

export interface RouteDto {
  routeId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  tabId: number;
  url: string;
  path: string;
  hash: string;
  timestamp: string;
  navigationType: string;
}

export interface RuntimeEventDto {
  eventId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  routeId: string | null;
  tabId: number | null;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FindingDto {
  findingId: string;
  batchId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  findingType: string;
  category: string;
  severity: string;
  title: string;
  observedFact: string;
  possibleInterpretation: string;
  requiredAdditionalContext: string;
  analysis: string;
  confidence: number | null;
  likelyImpact: string | null;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface PageAnalysisDto {
  session: SessionListItemDto;
  website: WebsiteDto;
  page: PageListItemDto;
  routes: RouteDto[];
  analysisSummary: string;
  engineeringAssessment: string | null;
  findings: FindingDto[];
  totalFindings: number;
  severitySummary: SeveritySummaryDto;
  findingTypeSummary: FindingTypeSummaryDto;
}

export interface AnalysisOrchestrationResult {
  success: boolean;
  sessionId: string;
  processedPages: string[];
  batches: string[];
}
