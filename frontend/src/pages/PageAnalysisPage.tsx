import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/api-client.js';
import { PageAnalysisDto } from '../types/api.js';
import { FindingCard } from '../components/findings/FindingCard.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import {
  ArrowLeft,
  Sparkles,
  Route as RouteIcon,
  Activity,
  Layers
} from 'lucide-react';

interface PageAnalysisPageProps {
  sessionId: string;
  websiteId: string;
  pageId: string;
  onNavigate: (path: string) => void;
}

export const PageAnalysisPage: React.FC<PageAnalysisPageProps> = ({
  sessionId,
  websiteId,
  pageId,
  onNavigate
}) => {
  const [analysis, setAnalysis] = useState<PageAnalysisDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  useEffect(() => {
    apiClient
      .getPageAnalysis(sessionId, websiteId, pageId)
      .then((data) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId, websiteId, pageId]);

  if (loading) {
    return <Card style={{ padding: '3.5rem', textAlign: 'center', color: '#71717A' }}>Loading page analysis...</Card>;
  }

  if (error || !analysis) {
    return (
      <Card style={{ padding: '2rem', borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#991B1B' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load page analysis</div>
        <div style={{ fontSize: '0.8125rem' }}>{error || 'Page not found'}</div>
        <Button style={{ marginTop: '1rem' }} onClick={() => onNavigate(`/sessions/${sessionId}/websites/${websiteId}`)}>
          Back to Website
        </Button>
      </Card>
    );
  }

  const filteredFindings = analysis.findings.filter((f) => {
    if (severityFilter === 'all') return true;
    if (severityFilter === 'high') return f.severity === 'high' || f.severity === 'critical';
    return f.severity.toLowerCase() === severityFilter;
  });

  return (
    <div>
      {/* Navigation Back */}
      <button
        onClick={() => onNavigate(`/sessions/${sessionId}/websites/${websiteId}`)}
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
        <ArrowLeft size={14} /> Back to {analysis.website.origin}
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
            width: '240px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#4F46E5', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                Page Diagnostics
              </span>
            </div>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#09090B', marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>
              {analysis.page.title || analysis.page.url}
            </h1>
            <div style={{ fontSize: '0.8125rem', color: '#71717A', fontFamily: 'var(--font-mono)' }}>
              {analysis.page.url}
            </div>

            {/* Quick Metadata Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#52525B', fontWeight: 500 }}>
                <RouteIcon size={14} color="#71717A" />
                <span>{analysis.routes.length} route transitions</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#52525B', fontWeight: 500 }}>
                <Activity size={14} color="#71717A" />
                <span>{analysis.totalFindings} engineering findings</span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => onNavigate(`/sessions/${sessionId}/websites/${websiteId}/analyze`)}
          >
            Re-run Analysis
          </Button>
        </div>
      </div>

      {/* Engineering Assessment Box with Texture */}
      {analysis.engineeringAssessment && (
        <div
          style={{
            position: 'relative',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E4E4E7',
            borderLeft: '4px solid #4F46E5',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem',
            boxShadow: 'var(--shadow-subtle)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '100%',
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)',
              backgroundSize: '10px 10px',
              pointerEvents: 'none'
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', position: 'relative', zIndex: 1 }}>
            <Sparkles size={16} color="#4F46E5" />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#09090B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Engineering Assessment
            </h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#27272A', lineHeight: '1.6', position: 'relative', zIndex: 1 }}>
            {analysis.engineeringAssessment}
          </p>
        </div>
      )}

      {/* Findings Section Header & Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#09090B' }}>
            Findings & Observations ({analysis.totalFindings})
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#71717A' }}>
            Structured interpretations generated from captured runtime events.
          </p>
        </div>

        {/* Severity Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#71717A', marginRight: '0.25rem', fontWeight: 500 }}>Filter:</span>
          {['all', 'high', 'medium', 'low'].map((sev) => {
            const active = severityFilter === sev;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: active ? 600 : 500,
                  padding: '0.25rem 0.625rem',
                  borderRadius: '4px',
                  border: `1px solid ${active ? '#09090B' : '#E4E4E7'}`,
                  backgroundColor: active ? '#09090B' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#71717A',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 150ms ease'
                }}
              >
                {sev}
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <EmptyState
          title={analysis.totalFindings === 0 ? 'No engineering findings detected' : 'No matching findings for this filter'}
          description={
            analysis.totalFindings === 0
              ? 'This page did not produce any abnormal runtime patterns during the captured session.'
              : 'Try selecting a different severity filter above.'
          }
        />
      ) : (
        <div>
          {filteredFindings.map((finding) => (
            <FindingCard key={finding.findingId} finding={finding} />
          ))}
        </div>
      )}
    </div>
  );
};
