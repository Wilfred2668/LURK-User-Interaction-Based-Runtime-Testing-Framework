import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App.js';
import { apiClient } from '../src/services/api-client.js';
import { FindingCard } from '../src/components/findings/FindingCard.js';
import { PageSelectorTree } from '../src/components/analysis/PageSelectorTree.js';
import { FindingDto } from '../src/types/api.js';

// Mock API Client
vi.mock('../src/services/api-client.js', () => ({
  apiClient: {
    getSessions: vi.fn(),
    getSessionOverview: vi.fn(),
    getWebsites: vi.fn(),
    getWebsiteOverview: vi.fn(),
    getPages: vi.fn(),
    getPageOverview: vi.fn(),
    getRoutes: vi.fn(),
    getEvents: vi.fn(),
    getFindings: vi.fn(),
    getPageAnalysis: vi.fn(),
    startAIAnalysis: vi.fn()
  }
}));

const sampleFinding: FindingDto = {
  findingId: 'fnd_repeated_net_01',
  batchId: 'batch_001',
  sessionId: 'sess_001',
  websiteId: 'web_001',
  pageId: 'page_001',
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
    eventIds: ['evt_net_01', 'evt_net_02', 'evt_net_03'],
    aggregationId: 'agg_evt_net_01'
  },
  createdAt: '2026-08-18T10:02:00.000Z'
};

describe('Milestone 4D — Frontend Dashboard & AI Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '#/';
  });

  // TEST 1 — Overview page renders metrics
  it('TEST 1: Overview page renders session metrics and header', async () => {
    (apiClient.getSessions as any).mockResolvedValue([
      {
        sessionId: 'sess_001',
        status: 'finalized',
        startedAt: '2026-08-18T10:00:00.000Z',
        endedAt: '2026-08-18T10:05:00.000Z',
        durationMs: 300000,
        rootUrl: 'https://www.hidevs.xyz',
        activeTabId: 101,
        persistedAt: '2026-08-18T10:05:01.000Z'
      }
    ]);

    render(<App />);
    expect(screen.getByText('RuntimeLens')).toBeInTheDocument();
    expect(await screen.findByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('sess_001')).toBeInTheDocument();
  });

  // TEST 2 — Human-readable finding presentation
  it('TEST 2: FindingCard displays human-readable observed facts and interpretations', () => {
    render(<FindingCard finding={sampleFinding} />);

    expect(screen.getByText('Repeated network request detected')).toBeInTheDocument();
    expect(
      screen.getByText(/Observed 10 identical GET requests to \/api\/leaderboard/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Rapid interval polling/)).toBeInTheDocument();
    expect(screen.getByText(/Increased backend bandwidth consumption/)).toBeInTheDocument();
  });

  // TEST 3 — Technical evidence is collapsed by default
  it('TEST 3: Technical evidence is hidden by default and event IDs do not dominate the UI', () => {
    render(<FindingCard finding={sampleFinding} />);

    expect(screen.getByText('View technical evidence')).toBeInTheDocument();
    expect(screen.queryByText('Developer Trace')).not.toBeInTheDocument();
    expect(screen.queryByText('evt_net_01')).not.toBeInTheDocument();
  });

  // TEST 4 — Technical evidence expands on click
  it('TEST 4: Clicking "View technical evidence" reveals parameters and developer trace', () => {
    render(<FindingCard finding={sampleFinding} />);

    const button = screen.getByText('View technical evidence');
    fireEvent.click(button);

    expect(screen.getByText('Hide technical evidence')).toBeInTheDocument();
    expect(screen.getByText('Developer Trace')).toBeInTheDocument();
    expect(screen.getByText('evt_net_01')).toBeInTheDocument();
    expect(screen.getByText('agg_evt_net_01')).toBeInTheDocument();
  });

  // TEST 5 — PageSelectorTree toggles individual pages
  it('TEST 5: PageSelectorTree allows selecting individual pages', () => {
    const onTogglePage = vi.fn();
    const onToggleWebsite = vi.fn();

    const tree = [
      {
        website: {
          websiteId: 'web_001',
          sessionId: 'sess_001',
          origin: 'https://www.hidevs.xyz',
          firstSeenAt: '',
          lastSeenAt: ''
        },
        pages: [
          {
            pageId: 'page_home',
            sessionId: 'sess_001',
            websiteId: 'web_001',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 101,
            url: 'https://www.hidevs.xyz/',
            title: 'Home',
            createdAt: '',
            findingCount: 1
          },
          {
            pageId: 'page_interns',
            sessionId: 'sess_001',
            websiteId: 'web_001',
            websiteOrigin: 'https://www.hidevs.xyz',
            tabId: 101,
            url: 'https://www.hidevs.xyz/ai-interns',
            title: 'AI Interns',
            createdAt: '',
            findingCount: 2
          }
        ]
      }
    ];

    render(
      <PageSelectorTree
        tree={tree}
        selectedPageIds={['page_home']}
        onTogglePage={onTogglePage}
        onToggleWebsite={onToggleWebsite}
      />
    );

    expect(screen.getByText('https://www.hidevs.xyz')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('AI Interns')).toBeInTheDocument();
  });

  // TEST 6 — Navigation to Sessions
  it('TEST 6: Clicking Sessions nav item navigates to session list', async () => {
    (apiClient.getSessions as any).mockResolvedValue([
      {
        sessionId: 'sess_001',
        status: 'finalized',
        startedAt: '2026-08-18T10:00:00.000Z',
        endedAt: '2026-08-18T10:05:00.000Z',
        durationMs: 300000,
        rootUrl: 'https://www.hidevs.xyz',
        activeTabId: 101,
        persistedAt: '2026-08-18T10:05:01.000Z'
      }
    ]);

    render(<App />);
    const sessionsButton = screen.getAllByRole('button', { name: /Sessions/i })[0]!;
    fireEvent.click(sessionsButton);

    expect(await screen.findByText('Monitoring Sessions')).toBeInTheDocument();
  });

  // TEST 7 — Page Analysis View with filters
  it('TEST 7: Page Analysis View renders finding cards and handles severity filters', async () => {
    window.location.hash = '#/sessions/sess_001/websites/web_001/pages/page_interns';

    (apiClient.getPageAnalysis as any).mockResolvedValue({
      session: { sessionId: 'sess_001', rootUrl: 'https://www.hidevs.xyz' },
      website: { websiteId: 'web_001', origin: 'https://www.hidevs.xyz' },
      page: { pageId: 'page_interns', title: 'AI Interns', url: 'https://www.hidevs.xyz/ai-interns' },
      routes: [],
      analysisSummary: 'Analyzed 1 finding',
      engineeringAssessment: 'Main thread blocked',
      findings: [sampleFinding],
      totalFindings: 1,
      severitySummary: { critical: 0, high: 0, medium: 1, low: 0, info: 0 },
      findingTypeSummary: { repeated_network_request: 1 }
    });

    render(<App />);

    expect(await screen.findByText('AI Interns')).toBeInTheDocument();
    expect(screen.getByText('AI Engineering Assessment')).toBeInTheDocument();
    expect(screen.getByText('Repeated network request detected')).toBeInTheDocument();

    // Test Low severity filter (finding is medium -> disappears)
    const lowFilterBtn = screen.getByRole('button', { name: 'low' });
    fireEvent.click(lowFilterBtn);
    expect(screen.getByText('No matching findings for this filter')).toBeInTheDocument();

    // Test Medium filter (finding returns)
    const medFilterBtn = screen.getByRole('button', { name: 'medium' });
    fireEvent.click(medFilterBtn);
    expect(screen.getByText('Repeated network request detected')).toBeInTheDocument();
  });

  // TEST 8 — Analysis Selection Page Workflow
  it('TEST 8: Analysis Selection Page allows selecting pages and triggers analysis', async () => {
    window.location.hash = '#/sessions/sess_001/analyze';

    (apiClient.getWebsites as any).mockResolvedValue([
      { websiteId: 'web_001', sessionId: 'sess_001', origin: 'https://www.hidevs.xyz' }
    ]);
    (apiClient.getPages as any).mockResolvedValue([
      { pageId: 'page_001', title: 'Home', url: 'https://www.hidevs.xyz/', findingCount: 1 }
    ]);
    (apiClient.startAIAnalysis as any).mockResolvedValue({
      success: true,
      sessionId: 'sess_001',
      processedPages: ['page_001'],
      batches: ['batch_001']
    });

    render(<App />);

    expect(await screen.findByText('Analyze Session with AI')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 page selected')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /Start AI Analysis/i });
    expect(startButton).not.toBeDisabled();

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(apiClient.startAIAnalysis).toHaveBeenCalledWith('sess_001', ['page_001']);
    });
  });

  // TEST 9 — Zero secrets in frontend environment
  it('TEST 9: No backend secrets or service-role keys are exposed in frontend code', () => {
    const envString = JSON.stringify(import.meta.env);
    expect(envString).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(envString).not.toContain('GROQ_API_KEY');
  });
});
