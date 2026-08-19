import {
  AnalysisOrchestrationResult,
  FindingDto,
  PageAnalysisDto,
  PageListItemDto,
  PageOverviewDto,
  RouteDto,
  RuntimeEventDto,
  SessionListItemDto,
  SessionOverviewDto,
  WebsiteDto
} from '../types/api.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    ...options
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status} ${res.statusText}`;
    try {
      const errObj = await res.json();
      if (errObj.message) errorMessage = errObj.message;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export const apiClient = {
  // Sessions
  getSessions: () => fetchJson<SessionListItemDto[]>('/api/sessions'),
  getSessionOverview: (sessionId: string) => fetchJson<SessionOverviewDto>(`/api/sessions/${sessionId}`),

  // Websites
  getWebsites: (sessionId: string) => fetchJson<WebsiteDto[]>(`/api/sessions/${sessionId}/websites`),
  getWebsiteOverview: (sessionId: string, websiteId: string) =>
    fetchJson<WebsiteDto>(`/api/sessions/${sessionId}/websites/${websiteId}`),

  // Pages
  getPages: (sessionId: string, websiteId: string) =>
    fetchJson<PageListItemDto[]>(`/api/sessions/${sessionId}/websites/${websiteId}/pages`),
  getPageOverview: (sessionId: string, websiteId: string, pageId: string) =>
    fetchJson<PageOverviewDto>(`/api/sessions/${sessionId}/websites/${websiteId}/pages/${pageId}`),

  // Details
  getRoutes: (sessionId: string, websiteId: string, pageId: string) =>
    fetchJson<RouteDto[]>(`/api/sessions/${sessionId}/websites/${websiteId}/pages/${pageId}/routes`),
  getEvents: (sessionId: string, websiteId: string, pageId: string) =>
    fetchJson<RuntimeEventDto[]>(`/api/sessions/${sessionId}/websites/${websiteId}/pages/${pageId}/events`),
  getFindings: (sessionId: string, websiteId: string, pageId: string) =>
    fetchJson<FindingDto[]>(`/api/sessions/${sessionId}/websites/${websiteId}/pages/${pageId}/findings`),

  // Analysis
  getPageAnalysis: (sessionId: string, websiteId: string, pageId: string) =>
    fetchJson<PageAnalysisDto>(`/api/sessions/${sessionId}/websites/${websiteId}/pages/${pageId}/analysis`),

  // Start AI Analysis (User Controlled)
  startAIAnalysis: (sessionId: string, pageIds: string[]) =>
    fetchJson<AnalysisOrchestrationResult>(`/api/sessions/${sessionId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ pageIds })
    }),

  // System Health & Status
  getSystemStatus: () => fetchJson<import('../types/api.js').SystemStatusDto>('/api/system/status')
};
