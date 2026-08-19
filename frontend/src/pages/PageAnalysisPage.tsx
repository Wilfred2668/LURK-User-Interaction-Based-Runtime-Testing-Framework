import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { PageAnalysisDto } from '../types/api.js';
import { FindingCard } from '../components/findings/FindingCard.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import {
  ArrowLeft,
  Activity,
  Terminal,
  Globe,
  Zap,
  RefreshCw,
} from 'lucide-react';

interface PageAnalysisPageProps {
  sessionId: string;
  websiteId: string;
  pageId: string;
  onNavigate: (path: string) => void;
}

const SEV_FILTERS = [
  { key: 'all',    label: 'All',    dot: null },
  { key: 'high',   label: 'High',   dot: '#EA580C' },
  { key: 'medium', label: 'Med',    dot: '#D97706' },
  { key: 'low',    label: 'Low',    dot: '#A1A1AA' },
] as const;

export const PageAnalysisPage: React.FC<PageAnalysisPageProps> = ({
  sessionId,
  websiteId,
  pageId,
  onNavigate
}) => {
  const [analysis, setAnalysis] = useState<PageAnalysisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryTab, setCategoryTab] = useState<'all' | 'console' | 'network' | 'performance'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const headerRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState('520px');

  useEffect(() => {
    apiClient
      .getPageAnalysis(sessionId, websiteId, pageId)
      .then((data) => { setAnalysis(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [sessionId, websiteId, pageId]);

  // Compute available height for the two-panel section after headers render
  useEffect(() => {
    const update = () => {
      const headerH = headerRef.current?.offsetHeight ?? 0;
      const available = window.innerHeight - headerH - 64 - 36;
      setPanelHeight(`${Math.max(320, available)}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [loading]);

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#71717A' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>Loading page diagnostics...</span>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <Card style={{ padding: '2rem', borderColor: '#E4E4E7', backgroundColor: '#FFFFFF', color: '#09090B' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load page analysis</div>
        <div style={{ fontSize: '0.8125rem', color: '#71717A' }}>{error || 'Page not found'}</div>
        <Button style={{ marginTop: '1rem' }} onClick={() => onNavigate(`/website?sessionId=${sessionId}&websiteId=${websiteId}`)}>
          Back to Website
        </Button>
      </Card>
    );
  }

  // ── Category counts ────────────────────────────────────────────
  const consoleCount = analysis.findings.filter(
    (f) => f.category === 'error' || f.findingType.includes('console') || f.findingType.includes('runtime_error')
  ).length;

  const networkCount = analysis.findings.filter(
    (f) => f.category === 'network' || f.findingType.includes('network')
  ).length;

  const performanceCount = analysis.findings.filter(
    (f) => f.category === 'performance' || f.findingType.includes('performance') || f.findingType.includes('long_task')
  ).length;

  const TABS = [
    { id: 'all'        , label: 'All'        , count: analysis.findings.length, Icon: Activity  },
    { id: 'console'    , label: 'Errors'     , count: consoleCount             , Icon: Terminal  },
    { id: 'network'    , label: 'Network'    , count: networkCount             , Icon: Globe     },
    { id: 'performance', label: 'Performance', count: performanceCount         , Icon: Zap       },
  ] as const;

  // ── Filter findings ────────────────────────────────────────────
  const filteredFindings = analysis.findings.filter((f) => {
    if (categoryTab === 'console') {
      if (!(f.category === 'error' || f.findingType.includes('console') || f.findingType.includes('runtime_error'))) return false;
    } else if (categoryTab === 'network') {
      if (!(f.category === 'network' || f.findingType.includes('network'))) return false;
    } else if (categoryTab === 'performance') {
      if (!(f.category === 'performance' || f.findingType.includes('performance') || f.findingType.includes('long_task'))) return false;
    }
    if (severityFilter === 'all') return true;
    if (severityFilter === 'high') return f.severity === 'high' || f.severity === 'critical';
    return f.severity.toLowerCase() === severityFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Fixed top zone ─────────────────────────────────────── */}
      <div ref={headerRef} style={{ marginBottom: '1.25rem' }}>
        {/* Breadcrumb Back Button (matching other pages) */}
        <button
          onClick={() => onNavigate(`/website?sessionId=${sessionId}&websiteId=${websiteId}`)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'none',
            border: 'none',
            color: '#71717A',
            fontSize: '0.8125rem',
            cursor: 'pointer',
            marginBottom: '0.875rem',
            fontWeight: 500,
            padding: 0
          }}
        >
          <ArrowLeft size={13} /> Back to {analysis.website.origin}
        </button>

        {/* Header Row: Title & Re-run Action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: analysis.engineeringAssessment ? '1rem' : '0',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#09090B', letterSpacing: '-0.025em', margin: 0 }}>
              {analysis.page.title || analysis.page.url}
            </h1>
            <div style={{ fontSize: '0.75rem', color: '#71717A', fontFamily: 'var(--font-mono)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {analysis.page.url}
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => onNavigate(`/analyze?sessionId=${sessionId}&websiteId=${websiteId}`)}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}
          >
            <RefreshCw size={13} />
            <span>Re-run Analysis</span>
          </Button>
        </div>

        {/* AI Engineering Assessment — Clean Neutral Style, No Logo */}
        {analysis.engineeringAssessment && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E4E4E7',
              padding: '0.875rem 1rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#71717A', marginBottom: '0.35rem' }}>
              AI Engineering Assessment
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#27272A', lineHeight: '1.6', margin: 0 }}>
              {analysis.engineeringAssessment}
            </p>
          </div>
        )}
      </div>

      {/* ── Two-panel findings zone ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          flex: 1,
          minHeight: 0,
          border: '1px solid #E4E4E7',
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* ── LEFT: Vertical folder tabs ─────────────────────── */}
        <div
          style={{
            width: '148px',
            flexShrink: 0,
            backgroundColor: '#F6F6F7',
            borderRight: '1px solid #E4E4E7',
            display: 'flex',
            flexDirection: 'column',
            padding: '0.75rem 0',
          }}
        >
          {/* Panel label */}
          <div
            style={{
              fontSize: '0.5625rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#A1A1AA',
              padding: '0 0.875rem',
              marginBottom: '0.5rem',
            }}
          >
            Category
          </div>

          {TABS.map((tab) => {
            const active = categoryTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.625rem 0.875rem',
                  margin: '0 0.5rem 0.125rem',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: 'calc(100% - 1rem)',
                  transition: 'background 120ms ease, color 120ms ease',
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  position: 'relative',
                }}
              >
                {/* Active tab right-edge flush */}
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '-0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '2px',
                      height: '60%',
                      backgroundColor: '#09090B',
                      borderRadius: '2px 0 0 2px',
                    }}
                  />
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                  <tab.Icon size={13} color={active ? '#09090B' : '#71717A'} />
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: active ? 600 : 400,
                      color: active ? '#09090B' : '#71717A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {tab.label}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    minWidth: '18px',
                    textAlign: 'center',
                    padding: '0.1rem 0.3rem',
                    borderRadius: '4px',
                    backgroundColor: active ? '#09090B' : '#E4E4E7',
                    color: active ? '#FFFFFF' : '#71717A',
                    flexShrink: 0,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Severity filter at bottom of left panel */}
          <div style={{ padding: '0 0.875rem', borderTop: '1px solid #E4E4E7', paddingTop: '0.75rem' }}>
            <div
              style={{
                fontSize: '0.5625rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#A1A1AA',
                marginBottom: '0.4rem',
              }}
            >
              Severity
            </div>
            {SEV_FILTERS.map(({ key, label, dot }) => {
              const active = severityFilter === key;
              return (
                <button
                  key={key}
                  aria-label={key}
                  onClick={() => setSeverityFilter(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    width: '100%',
                    padding: '0.3rem 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#09090B' : '#71717A',
                  }}
                >
                  {dot
                    ? <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
                    : <span style={{ width: '6px', height: '6px', borderRadius: '50%', border: '1px solid #D4D4D8', flexShrink: 0 }} />
                  }
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Scrollable findings list ────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Right panel header */}
          <div
            style={{
              padding: '0.625rem 0.875rem',
              borderBottom: '1px solid #E4E4E7',
              backgroundColor: '#FAFAFA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#09090B' }}>
              {TABS.find(t => t.id === categoryTab)?.label ?? 'All'}
              <span style={{ fontWeight: 400, color: '#71717A', marginLeft: '0.375rem' }}>
                · {filteredFindings.length} finding{filteredFindings.length !== 1 ? 's' : ''}
              </span>
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#A1A1AA' }}>
              {severityFilter !== 'all' ? `Severity: ${severityFilter}` : 'All severities'}
            </span>
          </div>

          {/* Scrollable findings */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.625rem' }}>
            {filteredFindings.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#A1A1AA', fontSize: '0.875rem' }}>
                No matching findings for this filter
              </div>
            ) : (
              filteredFindings.map((finding) => (
                <FindingCard key={finding.findingId} finding={finding} defaultExpanded={false} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
