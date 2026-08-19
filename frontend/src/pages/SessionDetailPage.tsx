import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { SessionOverviewDto, WebsiteDto } from '../types/api.js';
import { Button } from '../components/ui/Button.js';
import { ArrowLeft, ArrowRight, Globe, Sparkles, Clock, FileText, AlertTriangle } from 'lucide-react';

interface SessionDetailPageProps {
  sessionId: string;
  onNavigate: (path: string) => void;
}

export const SessionDetailPage: React.FC<SessionDetailPageProps> = ({ sessionId, onNavigate }) => {
  const [overview, setOverview] = useState<SessionOverviewDto | null>(null);
  const [websites, setWebsites] = useState<WebsiteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.getSessionOverview(sessionId),
      apiClient.getWebsites(sessionId)
    ])
      .then(([ov, webs]) => { setOverview(ov); setWebsites(webs); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [sessionId]);

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#71717A', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
      Loading session details…
    </div>
  );

  if (error || !overview) return (
    <div style={{ padding: '1.25rem', background: '#fff', borderRadius: '8px', border: '1px solid #E4E4E7' }}>
      <strong style={{ color: '#09090B' }}>Unable to load session</strong>
      <p style={{ fontSize: '0.8125rem', color: '#71717A', marginTop: '0.25rem' }}>{error || 'Session not found'}</p>
      <Button style={{ marginTop: '0.875rem' }} onClick={() => onNavigate('/sessions')}>Back to Sessions</Button>
    </div>
  );

  const durationSec = Math.round(overview.session.durationMs / 1000);
  const durationStr = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Fixed Breadcrumb */}
      <button
        onClick={() => onNavigate('/sessions')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          background: 'none', border: 'none', color: '#71717A',
          fontSize: '0.8125rem', cursor: 'pointer', marginBottom: '0.875rem',
          fontWeight: 500, padding: 0, flexShrink: 0
        }}
      >
        <ArrowLeft size={13} /> Sessions
      </button>

      {/* Fixed Hero Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #09090B 0%, #18181B 100%)',
          borderRadius: '10px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <div>
          <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525B', fontWeight: 600, marginBottom: '0.25rem' }}>
            Session
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            {overview.session.rootUrl || 'Browser Session'}
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#52525B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={11} /> {durationStr} · {new Date(overview.session.startedAt).toLocaleString()}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: '#3F3F46', marginTop: '0.2rem' }}>
            {overview.session.sessionId}
          </div>
        </div>

        <Button
          variant="accent"
          onClick={() => onNavigate(`/analyze?sessionId=${sessionId}`)}
        >
          <Sparkles size={13} /> Analyze with AI
        </Button>
      </div>

      {/* Fixed Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem', flexShrink: 0 }}>
        <div className="stat-card">
          <div className="stat-label"><Clock size={11} /> Duration</div>
          <div className="stat-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem' }}>{durationStr}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Globe size={11} /> Websites</div>
          <div className="stat-value">{overview.websiteCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><FileText size={11} /> Pages</div>
          <div className="stat-value">{overview.pageCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><AlertTriangle size={11} /> Findings</div>
          <div className="stat-value" style={{ color: overview.totalFindings > 0 ? '#D97706' : '#09090B' }}>
            {overview.totalFindings}
          </div>
        </div>
      </div>

      {/* Fixed Section Header */}
      <div className="section-header" style={{ flexShrink: 0, marginBottom: '0.625rem' }}>
        <h2>Monitored Origins</h2>
        <span style={{ fontSize: '0.75rem', color: '#71717A' }}>Click to inspect pages</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
        {websites.map((web) => (
          <div
            key={web.websiteId}
            className="session-row"
            onClick={() => onNavigate(`/website?sessionId=${sessionId}&websiteId=${web.websiteId}`)}
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
              <Globe size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#09090B' }}>{web.origin}</div>
              <div style={{ fontSize: '0.6875rem', color: '#71717A' }}>
                First seen {new Date(web.firstSeenAt).toLocaleTimeString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', color: '#71717A' }}>
                {web.pageCount || 0} pages · {web.findingCount || 0} findings
              </span>
              <ArrowRight size={13} color="#A1A1AA" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
