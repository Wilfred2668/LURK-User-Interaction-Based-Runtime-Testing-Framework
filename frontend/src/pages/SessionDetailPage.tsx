import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { SessionOverviewDto, WebsiteDto } from '../types/api.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Sparkles,
  Database,
  Layers,
  FileCode2
} from 'lucide-react';

interface SessionDetailPageProps {
  sessionId: string;
  onNavigate: (path: string) => void;
}

export const SessionDetailPage: React.FC<SessionDetailPageProps> = ({
  sessionId,
  onNavigate
}) => {
  const [overview, setOverview] = useState<SessionOverviewDto | null>(null);
  const [websites, setWebsites] = useState<WebsiteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.getSessionOverview(sessionId),
      apiClient.getWebsites(sessionId)
    ])
      .then(([ov, webs]) => {
        setOverview(ov);
        setWebsites(webs);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return <Card style={{ padding: '3.5rem', textAlign: 'center', color: '#71717A' }}>Loading session details...</Card>;
  }

  if (error || !overview) {
    return (
      <Card style={{ padding: '2rem', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#991B1B' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load session</div>
        <div style={{ fontSize: '0.8125rem' }}>{error || 'Session not found'}</div>
        <Button style={{ marginTop: '1rem' }} onClick={() => onNavigate('/sessions')}>
          Back to Sessions
        </Button>
      </Card>
    );
  }

  const durationSec = Math.round(overview.session.durationMs / 1000);
  const durationStr = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

  return (
    <div>
      {/* Navigation Back */}
      <button
        onClick={() => onNavigate('/sessions')}
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
        <ArrowLeft size={14} /> Back to Sessions
      </button>

      {/* Header Banner with Subtle Grid Texture */}
      <div
        style={{
          position: 'relative',
          padding: '1.75rem 2rem',
          borderRadius: '12px',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
          border: '1px solid #E4E4E7',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          marginBottom: '2rem'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '260px',
            height: '100%',
            backgroundImage: `
              linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '16px 16px',
            maskImage: 'radial-gradient(circle at 100% 0%, black 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(circle at 100% 0%, black 40%, transparent 80%)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.03em' }}>
                Session Overview
              </h1>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', backgroundColor: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                {overview.session.sessionId}
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: '#71717A' }}>
              Captured from {overview.session.rootUrl || 'browser'} on{' '}
              {new Date(overview.session.startedAt).toLocaleString()}
            </p>
          </div>

          {/* Primary User Action: Start AI Analysis */}
          <Button
            variant="primary"
            onClick={() => onNavigate(`/sessions/${sessionId}/analyze`)}
          >
            Analyze Session with AI
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2.5rem'
        }}
      >
        <Card textured>
          <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
            Duration
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
            {durationStr}
          </div>
        </Card>

        <Card textured>
          <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
            Websites Monitored
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.02em' }}>
            {overview.websiteCount}
          </div>
        </Card>

        <Card textured>
          <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
            Pages Captured
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.02em' }}>
            {overview.pageCount}
          </div>
        </Card>

        <Card textured>
          <div style={{ fontSize: '0.75rem', color: '#71717A', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '0.375rem' }}>
            AI Findings
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: overview.totalFindings > 0 ? '#D97706' : '#10B981', letterSpacing: '-0.02em' }}>
            {overview.totalFindings}
          </div>
        </Card>
      </div>

      {/* Monitored Websites Section */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#09090B', marginBottom: '0.25rem' }}>
          Monitored Origins & Websites
        </h2>
        <p style={{ fontSize: '0.8125rem', color: '#71717A', marginBottom: '1.25rem' }}>
          Each origin is isolated with its own pages, route transitions, and technical findings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {websites.map((web) => (
            <Card
              key={web.websiteId}
              interactive
              onClick={() => onNavigate(`/sessions/${sessionId}/websites/${web.websiteId}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: '#F4F4F5',
                    border: '1px solid #E4E4E7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4F46E5'
                  }}
                >
                  <Globe size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
                    {web.origin}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#71717A' }}>
                    First seen: {new Date(web.firstSeenAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>
                  {web.pageCount || 0} {web.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                  {web.findingCount || 0} {web.findingCount === 1 ? 'finding' : 'findings'}
                </div>
                <ArrowRight size={16} color="#A1A1AA" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
