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
  primaryReason?: string | undefined;
  // ── Intelligence extensions (D1.4) ──────────────────────────────
  /** Application readiness level from B5 applicationResults */
  readiness?: string | undefined;
  /** Company opportunity level from B3 companyOpportunity */
  companyOpportunity?: string | undefined;
  /** Decision confidence 0–100 from decisionResults */
  confidence?: number | undefined;
  /** Geographic eligibility from B6 candidateRemoteEligibility */
  eligibility?: string | undefined;
  // ────────────────────────────────────────────────────────────────
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

const decisionVariant = (d: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (d === 'APPLY' || d === 'APPLY_NOW') return 'success';
  if (d === 'CONSIDER' || d === 'APPLY_LATER' || d === 'REVIEW') return 'warning';
  if (d === 'SKIP' || d === 'REJECTED' || d === 'INELIGIBLE') return 'danger';
  if (d === 'RESEARCH_REQUIRED') return 'info';
  if (d === 'INSUFFICIENT_EVIDENCE') return 'neutral';
  return 'neutral';
};

const decisionLabel = (d: string): string => {
  if (d === 'APPLY' || d === 'APPLY_NOW') return 'Apply';
  if (d === 'CONSIDER' || d === 'APPLY_LATER') return 'Consider';
  if (d === 'SKIP' || d === 'REJECTED') return 'Skip';
  if (d === 'REVIEW') return 'Review';
  if (d === 'INELIGIBLE') return 'Ineligible';
  if (d === 'INSUFFICIENT_EVIDENCE') return 'Unknown Fit';
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
  primaryReason,
  readiness,
  companyOpportunity,
  confidence,
  eligibility,
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
      className={`profile-card ${className}`}
      interactive
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 'var(--space-4)' }}
      aria-label={`${title} at ${company}`}
    >
      {/* 1. Company & Score Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {company}
          </span>
        </div>
        {score !== undefined && (
          <div onClick={stop} style={{ flexShrink: 0 }}>
            <Link href={`/jobs?minScore=${score}`} style={{ textDecoration: 'none' }}>
              <ScoreBadge score={score} />
            </Link>
          </div>
        )}
      </div>

      {/* 2. Job Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          margin: 0,
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.4,
        }}>
          {title}
        </h3>
      </div>

      {/* 3, 4, 5. Badges Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {decision && decision !== 'PENDING' && (
          <div onClick={stop}>
            <Link href={`/jobs?decision=${encodeURIComponent(decision)}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={decisionLabel(decision)} variant={decisionVariant(decision)} />
            </Link>
          </div>
        )}
        
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
              <StatusBadge
                status={
                  eligibility === 'ELIGIBLE' ? 'Remote (Eligible)' :
                  eligibility === 'NOT_ELIGIBLE' ? 'Not Eligible' :
                  eligibility === 'UNKNOWN' ? 'Remote (Unknown)' :
                  'Remote'
                }
                variant={
                  eligibility === 'ELIGIBLE' ? 'success' :
                  eligibility === 'NOT_ELIGIBLE' ? 'danger' :
                  eligibility === 'UNKNOWN' ? 'warning' :
                  'info'
                }
              />
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

        {readiness && (
          <div onClick={stop}>
            <Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={readiness} variant={readinessVariant(readiness)} aria-label={`Readiness: ${readiness}`} />
            </Link>
          </div>
        )}

        {companyOpportunity && (
          <div onClick={stop}>
            <Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={companyOpportunity} variant={companyOpportunityVariant(companyOpportunity)} aria-label={`Company opportunity: ${companyOpportunity}`} />
            </Link>
          </div>
        )}
      </div>

      {/* 6. Candidate Decision Reason */}
      {primaryReason && (
        <div style={{ 
          fontSize: '0.8125rem', 
          color: 'var(--text-secondary)',
          background: 'var(--bg-subtle)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '2px solid var(--accent)',
          lineHeight: 1.5,
        }}>
          <strong>Reason:</strong> {primaryReason}
        </div>
      )}

      {/* 7 & 8. Footer row: Metadata & Actions */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 'var(--space-3)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--space-2)',
        opacity: isHovered ? 1 : 0.7,
        transition: 'var(--transition-fast)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {age && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {age}
            </span>
          )}
          {confidence != null && confidence > 0 && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500,
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