import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { PageListItemDto, WebsiteDto } from '../types/api.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { ArrowLeft, ArrowRight, Globe, FileText, Sparkles, AlertTriangle } from 'lucide-react';

interface WebsiteDetailPageProps {
  sessionId: string;
  websiteId: string;
  onNavigate: (path: string) => void;
}

export const WebsiteDetailPage: React.FC<WebsiteDetailPageProps> = ({
  sessionId, websiteId, onNavigate
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
      .then(([web, pgs]) => { setWebsite(web); setPages(pgs); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [sessionId, websiteId]);

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#71717A', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
      Loading website details…
    </div>
  );

  if (error || !website) return (
    <div style={{ padding: '1.25rem', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
      <strong style={{ color: '#09090B' }}>Unable to load website</strong>
      <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.25rem' }}>{error || 'Website not found'}</p>
      <Button style={{ marginTop: '0.875rem' }} onClick={() => onNavigate(`/session?id=${sessionId}`)}>
        Back to Session
      </Button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Fixed Breadcrumb */}
      <button
        onClick={() => onNavigate(`/session?id=${sessionId}`)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          background: 'none', border: 'none', color: '#71717A',
          fontSize: '0.8125rem', cursor: 'pointer', marginBottom: '0.875rem',
          fontWeight: 500, padding: 0, flexShrink: 0
        }}
      >
        <ArrowLeft size={13} /> Session Overview
      </button>

      {/* Fixed Header with CTA */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E4E4E7',
          padding: '1.25rem 1.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              backgroundColor: '#09090B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', flexShrink: 0
            }}
          >
            <Globe size={16} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.02em' }}>
              {website.origin}
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#71717A' }}>
              First seen {new Date(website.firstSeenAt).toLocaleString()}
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => onNavigate(`/analyze?sessionId=${sessionId}&websiteId=${websiteId}`)}>
          <Sparkles size={13} /> Analyze Pages
        </Button>
      </div>

      {/* Fixed Section Header */}
      <div className="section-header" style={{ flexShrink: 0, marginBottom: '0.625rem' }}>
        <h2>Monitored Pages ({pages.length})</h2>
        <span style={{ fontSize: '0.75rem', color: '#71717A' }}>Click to view diagnostics</span>
      </div>

      {pages.length === 0 ? (
        <EmptyState
          title="No pages monitored"
          description="No pages were visited under this origin during the recorded session."
        />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
          {pages.map((p) => (
            <div
              key={p.pageId}
              className="session-row"
              onClick={() => onNavigate(`/page?sessionId=${sessionId}&websiteId=${websiteId}&pageId=${p.pageId}`)}
              role="button"
            >
              <div
                style={{
                  width: '30px', height: '30px', borderRadius: '6px',
                  backgroundColor: '#F4F4F5', border: '1px solid #E4E4E7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#52525B', flexShrink: 0
                }}
              >
                <FileText size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#09090B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.title || p.url}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#71717A', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.url}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexShrink: 0 }}>
                {(p.findingCount || 0) > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#D97706', fontWeight: 600 }}>
                    <AlertTriangle size={11} /> {p.findingCount} findings
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: '#71717A' }}>{p.routeCount || 0} routes</span>
                <ArrowRight size={13} color="#A1A1AA" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
