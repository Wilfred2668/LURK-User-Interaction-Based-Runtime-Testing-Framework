import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { PageListItemDto, WebsiteDto } from '../types/api.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  FileText,
  Sparkles
} from 'lucide-react';

interface WebsiteDetailPageProps {
  sessionId: string;
  websiteId: string;
  onNavigate: (path: string) => void;
}

export const WebsiteDetailPage: React.FC<WebsiteDetailPageProps> = ({
  sessionId,
  websiteId,
  onNavigate
}) => {
  const [website, setWebsite] = useState<WebsiteDto | null>(null);
  const [pages, setPages] = useState<PageListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.getWebsiteOverview(sessionId, websiteId),
      apiClient.getPages(sessionId, websiteId)
    ])
      .then(([web, pgs]) => {
        setWebsite(web);
        setPages(pgs);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId, websiteId]);

  if (loading) {
    return <Card style={{ padding: '3rem', textAlign: 'center', color: '#737373' }}>Loading website details...</Card>;
  }

  if (error || !website) {
    return (
      <Card style={{ padding: '2rem', borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', color: '#991B1B' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load website</div>
        <div style={{ fontSize: '0.8125rem' }}>{error || 'Website not found'}</div>
        <Button style={{ marginTop: '1rem' }} onClick={() => onNavigate(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </Card>
    );
  }

  return (
    <div>
      {/* Navigation Back */}
      <button
        onClick={() => onNavigate(`/sessions/${sessionId}`)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          background: 'none',
          border: 'none',
          color: '#737373',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          marginBottom: '1rem'
        }}
      >
        <ArrowLeft size={14} /> Back to Session Overview
      </button>

      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4F46E5'
            }}
          >
            <Globe size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#171717', marginBottom: '0.125rem' }}>
              {website.origin}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#737373' }}>
              First seen: {new Date(website.firstSeenAt).toLocaleString()}
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => onNavigate(`/sessions/${sessionId}/websites/${websiteId}/analyze`)}
        >
          Analyze Pages
        </Button>
      </div>

      {/* Pages Section */}
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#171717', marginBottom: '0.25rem' }}>
          Monitored Pages ({pages.length})
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#737373', marginBottom: '1rem' }}>
          Select a page to view route transitions, raw events, and AI engineering analysis.
        </p>

        {pages.length === 0 ? (
          <EmptyState
            title="No pages monitored"
            description="No pages were visited under this origin during the recorded session."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {pages.map((p) => (
              <Card
                key={p.pageId}
                interactive
                onClick={() =>
                  onNavigate(`/sessions/${sessionId}/websites/${websiteId}/pages/${p.pageId}`)
                }
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748B'
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#171717' }}>
                      {p.title || p.url}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#737373', fontFamily: 'var(--font-mono)' }}>
                      {p.url}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ fontSize: '0.8125rem', color: '#737373' }}>
                    {p.routeCount || 0} routes · {p.findingCount || 0} findings
                  </div>
                  <ArrowRight size={16} color="#9CA3AF" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
