import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { PageListItemDto, WebsiteDto } from '../types/api.js';
import { PageSelectorTree } from '../components/analysis/PageSelectorTree.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { ArrowLeft, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface AnalysisSelectionPageProps {
  sessionId: string;
  websiteId?: string;
  onNavigate: (path: string) => void;
}

interface TreeItem {
  website: WebsiteDto;
  pages: PageListItemDto[];
}

type ProgressStep = 'idle' | 'preparing' | 'inferencing' | 'saving' | 'completed';

export const AnalysisSelectionPage: React.FC<AnalysisSelectionPageProps> = ({
  sessionId,
  websiteId,
  onNavigate
}) => {
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressStep, setProgressStep] = useState<ProgressStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [focusedWebsite, setFocusedWebsite] = useState<WebsiteDto | null>(null);

  useEffect(() => {
    apiClient
      .getWebsites(sessionId)
      .then(async (websites) => {
        const treeItems: TreeItem[] = [];
        const initialSelected: string[] = [];

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

  const allPageIds = tree.flatMap((t) => t.pages.map((p) => p.pageId));

  const handleSelectAll = () => {
    setSelectedPageIds(allPageIds);
  };

  const handleDeselectAll = () => {
    setSelectedPageIds([]);
  };

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
    if (selectedPageIds.length === 0 || progressStep !== 'idle') return;

    setError(null);
    setProgressStep('preparing');

    // Simulate realistic progress feedback across execution stages
    const stepTimer1 = setTimeout(() => setProgressStep('inferencing'), 400);
    const stepTimer2 = setTimeout(() => setProgressStep('saving'), 1200);

    try {
      await apiClient.startAIAnalysis(sessionId, selectedPageIds);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setProgressStep('completed');

      setTimeout(() => {
        if (websiteId) {
          onNavigate(`/website?sessionId=${sessionId}&websiteId=${websiteId}`);
        } else {
          onNavigate(`/session?id=${sessionId}`);
        }
      }, 1200);
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setProgressStep('idle');
      setError(err.message || 'Failed to complete AI analysis');
    }
  };

  if (loading) {
    return <Card style={{ padding: '3.5rem', textAlign: 'center', color: '#71717A' }}>Loading available pages...</Card>;
  }

  const totalAvailablePages = allPageIds.length;
  const totalFindingsInSelection = tree.reduce((acc, t) => {
    return (
      acc +
      t.pages
        .filter((p) => selectedPageIds.includes(p.pageId))
        .reduce((sum, p) => sum + (p.findingCount || 0), 0)
    );
  }, 0);

  const backUrl = websiteId
    ? `/website?sessionId=${sessionId}&websiteId=${websiteId}`
    : `/session?id=${sessionId}`;

  const backLabel = focusedWebsite
    ? `Back to ${focusedWebsite.origin}`
    : 'Back to Session Overview';

  const isBusy = progressStep !== 'idle';

  const getProgressLabel = () => {
    switch (progressStep) {
      case 'preparing':
        return 'Preparing telemetry batches...';
      case 'inferencing':
        return 'Running AI inference (Python/Groq)...';
      case 'saving':
        return 'Saving analysis results to Supabase...';
      case 'completed':
        return 'Analysis complete!';
      default:
        return 'Start AI Analysis';
    }
  };

  return (
    <div>
      {/* Navigation Back */}
      <button
        onClick={() => onNavigate(backUrl)}
        disabled={isBusy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          background: 'none',
          border: 'none',
          color: '#71717A',
          fontSize: '0.8125rem',
          cursor: isBusy ? 'not-allowed' : 'pointer',
          marginBottom: '1rem',
          fontWeight: 500,
          opacity: isBusy ? 0.5 : 1
        }}
      >
        <ArrowLeft size={14} /> {backLabel}
      </button>

      {/* Header & Quick Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#09090B', marginBottom: '0.2rem', letterSpacing: '-0.02em' }}>
            {focusedWebsite ? `Analyze Pages — ${focusedWebsite.origin}` : 'Analyze Session with AI'}
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#71717A' }}>
            Select specific pages to send to the AI Analysis Engine. Only selected pages will be analyzed.
          </p>
        </div>

        {/* Bulk Select/Deselect Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleSelectAll}
            disabled={isBusy || selectedPageIds.length === totalAvailablePages}
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '0.35rem 0.65rem',
              borderRadius: '4px',
              border: '1px solid #E4E4E7',
              backgroundColor: '#FFFFFF',
              color: '#09090B',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.5 : 1
            }}
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={isBusy || selectedPageIds.length === 0}
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '0.35rem 0.65rem',
              borderRadius: '4px',
              border: '1px solid #E4E4E7',
              backgroundColor: '#FFFFFF',
              color: '#71717A',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              opacity: isBusy ? 0.5 : 1
            }}
          >
            Deselect All
          </button>
        </div>
      </div>

      {error && (
        <Card style={{ padding: '1rem 1.25rem', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#991B1B', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
              <AlertCircle size={16} /> Error starting AI analysis
            </div>
            <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>{error}</div>
          </div>
          <Button variant="secondary" onClick={handleStartAnalysis} icon={<RefreshCw size={13} />}>
            Retry
          </Button>
        </Card>
      )}

      {progressStep === 'completed' && (
        <Card style={{ padding: '1.25rem', borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', color: '#166534', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <CheckCircle2 size={18} color="#16A34A" /> AI Analysis Completed Successfully!
          </div>
          <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
            Persisted structured findings to Supabase. Redirecting...
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
          isLoading={isBusy && progressStep !== 'completed'}
          disabled={selectedPageIds.length === 0 || isBusy}
          onClick={handleStartAnalysis}
          style={{ minWidth: '175px' }}
        >
          {getProgressLabel()}
        </Button>
      </Card>
    </div>
  );
};
