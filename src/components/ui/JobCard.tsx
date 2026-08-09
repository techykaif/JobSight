"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { SalaryBadge } from './SalaryBadge';
import { ScoreBadge } from './ScoreBadge';
import { ActionButton } from './ActionButton';

export interface JobCardProps {
  id: string;
  title: string;
  company: string;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  remote?: boolean | undefined;
  score?: number | undefined;
  competition?: string | undefined;
  provider?: string | undefined;
  age?: string | undefined;
  decision?: string | undefined;
  // ── Intelligence extensions (D1.4) ──────────────────────────────
  /** Application readiness level from B5 applicationResults */
  readiness?: string | undefined;
  /** Company opportunity level from B3 companyOpportunity */
  companyOpportunity?: string | undefined;
  /** Decision confidence 0–100 from decisionResults */
  confidence?: number | undefined;
  // ────────────────────────────────────────────────────────────────
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

const decisionVariant = (d: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (d === 'APPLY' || d === 'APPLY_NOW') return 'success';
  if (d === 'CONSIDER' || d === 'APPLY_LATER') return 'warning';
  if (d === 'SKIP' || d === 'REJECTED') return 'danger';
  if (d === 'RESEARCH_REQUIRED') return 'info';
  return 'neutral';
};

const decisionLabel = (d: string): string => {
  if (d === 'APPLY' || d === 'APPLY_NOW') return 'Apply';
  if (d === 'CONSIDER' || d === 'APPLY_LATER') return 'Consider';
  if (d === 'SKIP' || d === 'REJECTED') return 'Skip';
  if (d === 'RESEARCH_REQUIRED') return 'Research';
  return d.replace(/_/g, ' ');
};

const competitionVariant = (c: string): 'success' | 'warning' | 'danger' | 'neutral' => {
  // Handles both the older discoveryIntelligence vocabulary (LOW/MEDIUM/HIGH)
  // and the B2 competitionResults vocabulary (Very Low/Low/Medium/High/Very High).
  const normalized = c.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'very low') return 'success';
  if (normalized === 'medium') return 'warning';
  if (normalized === 'high' || normalized === 'very high') return 'danger';
  return 'neutral';
};

// ── Readiness variant helpers ────────────────────────────────────────────────
const readinessVariant = (r: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
  if (r === 'Ready Now') return 'success';
  if (r === 'Almost Ready') return 'info';
  if (r === 'Needs Improvement') return 'warning';
  if (r === 'Not Recommended') return 'danger';
  return 'neutral';
};

const companyOpportunityVariant = (l: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
  const lower = l.toLowerCase();
  if (lower.includes('excellent') || lower.includes('strong')) return 'success';
  if (lower.includes('good')) return 'info';
  if (lower.includes('average')) return 'warning';
  if (lower.includes('weak')) return 'danger';
  return 'neutral';
};

export const JobCard: React.FC<JobCardProps> = ({
  id,
  title,
  company,
  salaryMin,
  salaryMax,
  remote,
  score,
  competition,
  provider,
  age,
  decision,
  readiness,
  companyOpportunity,
  confidence,
  onClick,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handleCardClick = () => {
    if (onClick) onClick();
    router.push(`/jobs/${id}`);
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Card
      className={className}
      interactive
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      aria-label={`${title} at ${company}`}
    >
      {/* Top row: title + score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: '0 0 4px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.35,
          }}>
            {title}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {company}
            </span>
          </div>
        </div>

        {score !== undefined && (
          <div onClick={stop} style={{ flexShrink: 0 }}>
            <Link href={`/jobs?minScore=${score}`} style={{ textDecoration: 'none' }}>
              <ScoreBadge score={score} />
            </Link>
          </div>
        )}
      </div>

      {/* Badge row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {salaryMin !== undefined && salaryMax !== undefined && (
          <div onClick={stop}>
            <Link href={`/jobs?salaryMin=${salaryMin}&salaryMax=${salaryMax}`} style={{ textDecoration: 'none' }}>
              <SalaryBadge min={salaryMin} max={salaryMax} />
            </Link>
          </div>
        )}

        {remote && (
          <div onClick={stop}>
            <Link href="/jobs?remote=REMOTE" style={{ textDecoration: 'none' }}>
              <StatusBadge status="Remote" variant="info" />
            </Link>
          </div>
        )}

        {competition && (
          <div onClick={stop}>
            <Link href={`/jobs?competition=${encodeURIComponent(competition)}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={`${competition} Comp`} variant={competitionVariant(competition)} />
            </Link>
          </div>
        )}

        {decision && decision !== 'PENDING' && (
          <div onClick={stop}>
            <Link href={`/jobs?decision=${encodeURIComponent(decision)}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={decisionLabel(decision)} variant={decisionVariant(decision)} />
            </Link>
          </div>
        )}

        {/* Application Readiness — B5 (D1.4) */}
        {readiness && (
          <div onClick={stop}>
            <Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={readiness} variant={readinessVariant(readiness)} aria-label={`Readiness: ${readiness}`} />
            </Link>
          </div>
        )}

        {/* Company Opportunity — B3 (D1.4) */}
        {companyOpportunity && (
          <div onClick={stop}>
            <Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={companyOpportunity} variant={companyOpportunityVariant(companyOpportunity)} aria-label={`Company opportunity: ${companyOpportunity}`} />
            </Link>
          </div>
        )}
      </div>

      {/* Footer row */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid var(--border-hairline)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        opacity: isHovered ? 1 : 0.65,
        transition: 'opacity 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {age && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {age}
            </span>
          )}
          {/* Confidence — subtle footer signal (D1.4) */}
          {confidence != null && confidence > 0 && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
              aria-label={`Confidence: ${confidence}%`}
            >
              {confidence}% conf
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div onClick={stop}>
            <Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}>
              <ActionButton size="small" variant="secondary">View Details</ActionButton>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
};