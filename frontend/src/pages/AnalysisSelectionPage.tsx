import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { PageListItemDto, WebsiteDto } from '../types/api.js';
import { PageSelectorTree } from '../components/analysis/PageSelectorTree.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AnalysisSelectionPageProps {
  sessionId: string;
  websiteId?: string;
  onNavigate: (path: string) => void;
}

interface TreeItem {
  website: WebsiteDto;
  pages: PageListItemDto[];
}

export const AnalysisSelectionPage: React.FC<AnalysisSelectionPageProps> = ({
  sessionId,
  websiteId,
  onNavigate
}) => {
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const [focusedWebsite, setFocusedWebsite] = useState<WebsiteDto | null>(null);

  useEffect(() => {
    apiClient
      .getWebsites(sessionId)
      .then(async (websites) => {
        const treeItems: TreeItem[] = [];
        const initialSelected: string[] = [];

        // If scoped to a specific website, filter only that website
        const targetWebsites = websiteId
          ? websites.filter((w) => w.websiteId === websiteId)
          : websites;

        if (websiteId) {
          const match = websites.find((w) => w.websiteId === websiteId);
          if (match) setFocusedWebsite(match);
        }

        for (const w of targetWebsites) {
          const pages = await apiClient.getPages(sessionId, w.websiteId);
          treeItems.push({ website: w, pages });
          for (const p of pages) {
            initialSelected.push(p.pageId);
          }
        }

        setTree(treeItems);
        setSelectedPageIds(initialSelected);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId, websiteId]);

  const handleTogglePage = (pageId: string) => {
    if (selectedPageIds.includes(pageId)) {
      setSelectedPageIds(selectedPageIds.filter((id) => id !== pageId));
    } else {
      setSelectedPageIds([...selectedPageIds, pageId]);
    }
  };

  const handleToggleWebsite = (targetWebId: string, selectAll: boolean) => {
    const targetItem = tree.find((t) => t.website.websiteId === targetWebId);
    if (!targetItem) return;

    const pageIds = targetItem.pages.map((p) => p.pageId);
    if (selectAll) {
      const next = new Set([...selectedPageIds, ...pageIds]);
      setSelectedPageIds(Array.from(next));
    } else {
      setSelectedPageIds(selectedPageIds.filter((id) => !pageIds.includes(id)));
    }
  };

  const handleStartAnalysis = async () => {
    if (selectedPageIds.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      await apiClient.startAIAnalysis(sessionId, selectedPageIds);
      setIsAnalyzing(false);
      setAnalysisSuccess(true);

      // Return to website page if scoped, else session page
      setTimeout(() => {
        if (websiteId) {
          onNavigate(`/sessions/${sessionId}/websites/${websiteId}`);
        } else {
          onNavigate(`/sessions/${sessionId}`);
        }
      }, 1200);
    } catch (err: any) {
      setIsAnalyzing(false);
      setError(err.message || 'Failed to complete AI analysis');
    }
  };

  if (loading) {
    return <Card style={{ padding: '3.5rem', textAlign: 'center', color: '#71717A' }}>Loading available pages...</Card>;
  }

  const totalAvailablePages = tree.reduce((acc, t) => acc + t.pages.length, 0);
  const totalFindingsInSelection = tree.reduce((acc, t) => {
    return (
      acc +
      t.pages
        .filter((p) => selectedPageIds.includes(p.pageId))
        .reduce((sum, p) => sum + (p.findingCount || 0), 0)
    );
  }, 0);

  const backUrl = websiteId
    ? `/sessions/${sessionId}/websites/${websiteId}`
    : `/sessions/${sessionId}`;

  const backLabel = focusedWebsite
    ? `Back to ${focusedWebsite.origin}`
    : 'Back to Session Overview';

  return (
    <div>
      {/* Navigation Back */}
      <button
        onClick={() => onNavigate(backUrl)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          background: 'none',
          border: 'none',
          color: '#71717A',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          marginBottom: '1rem',
          fontWeight: 500
        }}
      >
        <ArrowLeft size={14} /> {backLabel}
      </button>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090B', marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>
          {focusedWebsite ? `Analyze Pages — ${focusedWebsite.origin}` : 'Analyze Session with AI'}
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#71717A' }}>
          Select specific pages to send to the AI Analysis Engine. Only selected pages will be analyzed.
        </p>
      </div>

      {error && (
        <Card style={{ padding: '1rem', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#991B1B', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <AlertCircle size={16} /> Error starting AI analysis
          </div>
          <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>{error}</div>
        </Card>
      )}

      {analysisSuccess && (
        <Card style={{ padding: '1.25rem', borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', color: '#166534', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <CheckCircle2 size={18} color="#16A34A" /> AI Analysis Completed Successfully!
          </div>
          <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            Persisted analysis results to Supabase. Redirecting...
          </div>
        </Card>
      )}

      {/* Selection Tree */}
      <div style={{ marginBottom: '2rem' }}>
        <PageSelectorTree
          tree={tree}
          selectedPageIds={selectedPageIds}
          onTogglePage={handleTogglePage}
          onToggleWebsite={handleToggleWebsite}
        />
      </div>

      {/* Control Action Bar */}
      <Card
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          backgroundColor: '#FFFFFF',
          borderColor: '#E4E4E7',
          boxShadow: 'var(--shadow-subtle)'
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
            {selectedPageIds.length} of {totalAvailablePages} {totalAvailablePages === 1 ? 'page' : 'pages'} selected
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>
            {totalFindingsInSelection} deterministic findings will be submitted for structured interpretation.
          </div>
        </div>

        <Button
          variant="primary"
          isLoading={isAnalyzing}
          disabled={selectedPageIds.length === 0 || isAnalyzing || analysisSuccess}
          onClick={handleStartAnalysis}
          style={{ minWidth: '160px' }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Start AI Analysis'}
        </Button>
      </Card>
    </div>
  );
};
