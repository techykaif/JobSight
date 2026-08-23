"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { SalaryBadge } from './SalaryBadge';
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
  readiness?: string | undefined;
  companyOpportunity?: string | undefined;
  confidence?: number | undefined;
  eligibility?: string | undefined;
  hideDecisionBadge?: boolean | undefined;
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
  const normalized = c.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'very low') return 'success';
  if (normalized === 'medium') return 'warning';
  if (normalized === 'high' || normalized === 'very high') return 'danger';
  return 'neutral';
};

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

const companyInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (!first) return '?';
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  const last = words[words.length - 1];
  if (!last) return '?';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
};

const companyHue = (name: string): number => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
};

const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const tone = clamped >= 75 ? 'var(--success)' : clamped >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <span title={`Score: ${clamped}`} aria-label={`Score: ${clamped}`} style={{ position: 'relative', display: 'inline-flex', width: 40, height: 40, flexShrink: 0 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--border-default)" strokeWidth="3" />
        <circle cx="20" cy="20" r={radius} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
        {Math.round(clamped)}
      </span>
    </span>
  );
};

export const JobCard: React.FC<JobCardProps> = ({
  id, title, company, salaryMin, salaryMax, remote, score, competition, provider, age, decision, primaryReason,
  readiness, companyOpportunity, confidence, eligibility, hideDecisionBadge = false, onClick, className = '',
}) => {
  const router = useRouter();
  const handleCardClick = () => { if (onClick) onClick(); router.push(`/jobs/${id}`); };
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const initials = companyInitials(company);
  const hue = companyHue(company);
  const secondaryBadgeStyle: React.CSSProperties = { fontSize: '0.6875rem', opacity: 0.82, transform: 'scale(0.94)', transformOrigin: 'left center' };

  return (
    <Card className={`profile-card ${className}`} interactive onClick={handleCardClick} style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 'var(--space-4)' }} aria-label={`${title} at ${company}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0, display: 'grid', placeItems: 'center', background: `hsla(${hue}, 55%, 55%, 0.11)`, border: `1px solid hsla(${hue}, 55%, 65%, 0.22)`, color: `hsl(${hue}, 70%, 72%)`, fontFamily: 'var(--font-mono)', fontSize: '0.625rem', fontWeight: 600 }}>
            {initials}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.055em', textTransform: 'uppercase' }}>
            {company}
          </span>
        </div>
        {score !== undefined && <div onClick={stop} style={{ flexShrink: 0 }}><Link href={`/jobs?minScore=${score}`} style={{ textDecoration: 'none', display: 'inline-flex' }}><ScoreGauge score={score} /></Link></div>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
          {title}
        </h3>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        {decision && decision !== 'PENDING' && !hideDecisionBadge && (
          <div onClick={stop}>
            <Link href={`/jobs?decision=${encodeURIComponent(decision)}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={decisionLabel(decision)} variant={decisionVariant(decision)} />
            </Link>
          </div>
        )}
        {salaryMin !== undefined && salaryMax !== undefined && <div onClick={stop} style={secondaryBadgeStyle}><Link href={`/jobs?salaryMin=${salaryMin}&salaryMax=${salaryMax}`} style={{ textDecoration: 'none' }}><SalaryBadge min={salaryMin} max={salaryMax} /></Link></div>}
        {remote && <div onClick={stop} style={secondaryBadgeStyle}><Link href="/jobs?remote=REMOTE" style={{ textDecoration: 'none' }}><StatusBadge status={eligibility === 'ELIGIBLE' ? 'Remote (Eligible)' : eligibility === 'NOT_ELIGIBLE' ? 'Not Eligible' : eligibility === 'UNKNOWN' ? 'Remote (Unknown)' : 'Remote'} variant={eligibility === 'ELIGIBLE' ? 'success' : eligibility === 'NOT_ELIGIBLE' ? 'danger' : eligibility === 'UNKNOWN' ? 'warning' : 'info'} /></Link></div>}
        {competition && <div onClick={stop} style={secondaryBadgeStyle}><Link href={`/jobs?competition=${encodeURIComponent(competition)}`} style={{ textDecoration: 'none' }}><StatusBadge status={`${competition} Comp`} variant={competitionVariant(competition)} /></Link></div>}
        {readiness && <div onClick={stop} style={secondaryBadgeStyle}><Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}><StatusBadge status={readiness} variant={readinessVariant(readiness)} aria-label={`Readiness: ${readiness}`} /></Link></div>}
        {companyOpportunity && <div onClick={stop} style={secondaryBadgeStyle}><Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}><StatusBadge status={companyOpportunity} variant={companyOpportunityVariant(companyOpportunity)} aria-label={`Company opportunity: ${companyOpportunity}`} /></Link></div>}
      </div>

      {primaryReason && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--accent)', lineHeight: 1.5 }}><strong>Reason:</strong> {primaryReason}</div>}

      <div className="job-card-footer" style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {age && <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{age}</span>}
          {confidence != null && confidence > 0 && <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }} aria-label={`Confidence: ${confidence}%`}>{confidence}% conf</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}><div onClick={stop}><Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}><ActionButton size="small" variant="secondary">View Details</ActionButton></Link></div></div>
      </div>
    </Card>
  );
};
