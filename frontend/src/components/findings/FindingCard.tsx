import React, { useState } from 'react';
import { FindingDto } from '../../types/api.js';
import {
  ChevronDown,
  ChevronUp,
  MousePointerClick,
} from 'lucide-react';

interface FindingCardProps {
  finding: FindingDto;
  defaultExpanded?: boolean;
}

// ── Severity dot color ─────────────────────────────────────────
function getSevDot(sev: string): string {
  switch (sev.toLowerCase()) {
    case 'critical': return '#E11D48';
    case 'high':     return '#EA580C';
    case 'medium':   return '#D97706';
    default:         return '#A1A1AA';
  }
}

// ── Severity pill background ────────────────────────────────────
function getSevPill(sev: string): { bg: string; color: string } {
  switch (sev.toLowerCase()) {
    case 'critical': return { bg: '#FFF1F2', color: '#9F1239' };
    case 'high':     return { bg: '#FFF7ED', color: '#9A3412' };
    case 'medium':   return { bg: '#FEFCE8', color: '#854D0E' };
    default:         return { bg: '#F4F4F5', color: '#52525B' };
  }
}

// ── Category pill colour ───────────────────────────────────────
function getCatPill(cat: string): { bg: string; color: string } {
  switch ((cat || '').toLowerCase()) {
    case 'error':       return { bg: '#FFF1F2', color: '#9F1239' };
    case 'network':     return { bg: '#EFF6FF', color: '#1D4ED8' };
    case 'performance': return { bg: '#F0FDF4', color: '#166534' };
    default:            return { bg: '#F4F4F5', color: '#52525B' };
  }
}

export const FindingCard: React.FC<FindingCardProps> = ({ finding, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sev = (finding.severity || 'info').toLowerCase();
  const evidence = (finding.evidence || {}) as Record<string, any>;
  const isPerfDegradation = finding.findingType === 'main_thread_performance_degradation';
  const interactionTrigger = evidence['interactionTrigger'];

  const sevDot = getSevDot(sev);
  const sevPill = getSevPill(sev);
  const catPill = getCatPill(finding.category || '');

  // ── Primary identifier badge ───────────────────────────────
  let url = evidence['url'] as string | undefined;
  let path = evidence['path'] as string | undefined;
  let method = evidence['method'] as string | undefined;
  const status = evidence['status'];

  if (url && !path) {
    try { path = new URL(url).pathname; } catch { path = url; }
  }

  const sourceUrl = evidence['sourceUrl'] as string | undefined;
  const lineNumber = evidence['lineNumber'];
  let sourceLabel = '';
  if (sourceUrl) {
    try {
      const fname = new URL(sourceUrl).pathname.split('/').pop() || sourceUrl;
      sourceLabel = `${fname}${lineNumber ? `:${lineNumber}` : ''}`;
    } catch {
      sourceLabel = `${sourceUrl}${lineNumber ? `:${lineNumber}` : ''}`;
    }
  }

  let primaryBadge = '';
  if (method && path)       primaryBadge = `${method} ${path}`;
  else if (sourceLabel)     primaryBadge = sourceLabel;
  else if (isPerfDegradation && evidence.maxDurationMs)
    primaryBadge = `${(evidence.maxDurationMs / 1000).toFixed(2)}s worst`;

  // (severity communicated through the pill + dot — no extra strip needed)

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E4E4E7',
        marginBottom: '0.5rem',
        overflow: 'hidden',
        transition: 'box-shadow 150ms ease'
      }}
    >
      {/* ── Collapsed Header ─────────────────────────────── */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '0.75rem 1rem 0.75rem 0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: isExpanded ? '#FAFAFA' : '#FFFFFF',
          borderBottom: isExpanded ? '1px solid #F0F0F2' : 'none'
        }}
      >
        {/* Left: badges + title */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          {/* Severity pill */}
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              backgroundColor: sevPill.bg,
              color: sevPill.color,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: sevDot, flexShrink: 0 }} />
            {finding.severity.toUpperCase()}
          </span>

          {/* Category pill */}
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              letterSpacing: '0.03em',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              backgroundColor: catPill.bg,
              color: catPill.color,
              flexShrink: 0
            }}
          >
            {finding.category || 'runtime'}
          </span>

          {/* Primary badge (endpoint / source) */}
          {primaryBadge && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#09090B',
                backgroundColor: '#F4F4F5',
                border: '1px solid #E4E4E7',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                flexShrink: 0
              }}
            >
              {primaryBadge}
            </span>
          )}

          {/* HTTP status */}
          {status !== undefined && status !== null && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                fontWeight: 700,
                padding: '0.2rem 0.4rem',
                borderRadius: '4px',
                backgroundColor: Number(status) >= 500 ? '#FFF1F2' : Number(status) >= 400 ? '#FFF7ED' : '#F0FDF4',
                color: Number(status) >= 500 ? '#9F1239' : Number(status) >= 400 ? '#9A3412' : '#166534',
                flexShrink: 0
              }}
            >
              {status}
            </span>
          )}

          {/* Title */}
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#09090B',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}
          >
            {finding.title}
          </span>
        </div>

        {/* Chevron */}
        <span style={{ color: '#A1A1AA', flexShrink: 0 }}>
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* ── Expanded Body ─────────────────────────────────── */}
      {isExpanded && (
        <div style={{ padding: '1rem 1rem 0.875rem', backgroundColor: '#FFFFFF' }}>

          {/* Observed — compact single line */}
          {finding.observedFact && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#52525B',
                lineHeight: '1.45',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#F8F8F9',
                borderRadius: '5px',
                marginBottom: '0.75rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'baseline'
              }}
            >
              <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A1A1AA', flexShrink: 0, paddingTop: '1px' }}>
                Observed
              </span>
              <span>{finding.observedFact}</span>
            </div>
          )}

          {/* Performance mini-stats — compact inline row */}
          {isPerfDegradation && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap'
              }}
            >
              {[
                { label: 'Worst Task',    value: evidence.maxDurationMs ? `${(evidence.maxDurationMs / 1000).toFixed(2)}s` : '—' },
                { label: 'Tasks > 1s',   value: String(evidence.tasksOver1000ms ?? 0) },
                { label: 'Tasks > 500ms', value: String(evidence.tasksOver500ms ?? 0) },
                { label: 'Total Blocked', value: evidence.totalBlockedTimeMs ? `${(evidence.totalBlockedTimeMs / 1000).toFixed(2)}s` : '—' }
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.3rem',
                    padding: '0.3rem 0.625rem',
                    backgroundColor: '#F4F4F5',
                    borderRadius: '5px',
                    border: '1px solid #E4E4E7'
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: '#09090B' }}>{m.value}</span>
                  <span style={{ fontSize: '0.6rem', color: '#A1A1AA', fontWeight: 500 }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* 3-column: Interpretation | Likely Impact | Next Steps */}
          {(finding.possibleInterpretation || finding.likelyImpact || finding.requiredAdditionalContext) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: [
                  finding.possibleInterpretation,
                  finding.likelyImpact,
                  finding.requiredAdditionalContext
                ].filter(Boolean).length === 1 ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '0.875rem 1.25rem',
                borderTop: finding.observedFact ? '1px solid #F0F0F2' : 'none',
                paddingTop: finding.observedFact ? '0.75rem' : 0,
              }}
            >
              {finding.possibleInterpretation && (
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A1A1AA', marginBottom: '0.3rem' }}>
                    Interpretation
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#27272A', lineHeight: '1.55', margin: 0 }}>
                    {finding.possibleInterpretation}
                  </p>
                </div>
              )}

              {finding.likelyImpact && (
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A1A1AA', marginBottom: '0.3rem' }}>
                    Likely Impact
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#27272A', lineHeight: '1.55', margin: 0 }}>
                    {finding.likelyImpact}
                  </p>
                </div>
              )}

              {finding.requiredAdditionalContext && (
                <div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A1A1AA', marginBottom: '0.3rem' }}>
                    Next Steps
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#52525B', lineHeight: '1.55', margin: 0, fontStyle: 'italic' }}>
                    {finding.requiredAdditionalContext}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Interaction trigger */}
          {interactionTrigger && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.6875rem',
                color: '#71717A',
                backgroundColor: '#F4F4F5',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                marginTop: '0.625rem'
              }}
            >
              <MousePointerClick size={11} />
              Triggered shortly after clicking "{interactionTrigger.textPreview || interactionTrigger.elementTag}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
