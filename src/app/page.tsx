import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sql, eq, desc, and, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { JobCard } from '@/components/ui/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — JobSight',
  description: 'Your real-time intelligence dashboard. See what deserves attention today.',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSalary(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const HUNT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  RUNNING:   'info',
  COMPLETED: 'success',
  FAILED:    'danger',
  CANCELLED: 'neutral',
  PREFLIGHT: 'warning',
  CREATED:   'neutral',
};

const HUNT_DOT_COLOR: Record<string, string> = {
  RUNNING:   '#3b82f6',
  COMPLETED: '#10b981',
  FAILED:    '#ef4444',
  CANCELLED: '#6b7280',
  PREFLIGHT: '#f59e0b',
  CREATED:   '#6b7280',
};

// ─── page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // ── Core counts ────────────────────────────────────────────────────────────
  const jobsCountRes = await db.select({ count: sql<number>`count(*)` }).from(schema.jobs);
  const totalJobs = Number(jobsCountRes[0]?.count ?? 0);

  const decisionsRes = await db.select({
    decision: schema.decisions.decision,
    count:    sql<number>`count(*)`,
  }).from(schema.decisions).groupBy(schema.decisions.decision);

  const applyCount     = Number(decisionsRes.find(d => d.decision === 'APPLY')?.count     ?? 0);
  const considerCount  = Number(decisionsRes.find(d => d.decision === 'CONSIDER')?.count  ?? 0);
  const skipCount      = Number(decisionsRes.find(d => d.decision === 'SKIP')?.count      ?? 0);
  const qualifiedJobs  = totalJobs - skipCount;

  const watchlistsRes  = await db.select({ count: sql<number>`count(*)` }).from(schema.watchlists);
  const monitorCount   = Number(watchlistsRes[0]?.count ?? 0);

  // ── Discovery intelligence ──────────────────────────────────────────────────
  const hiddenGemsRes = await db.select({ count: sql<number>`count(*)` })
    .from(schema.discoveryIntelligence)
    .where(eq(schema.discoveryIntelligence.hiddenGem, true));
  const hiddenGems = Number(hiddenGemsRes[0]?.count ?? 0);

  const lowCompRes = await db.select({ count: sql<number>`count(*)` })
    .from(schema.discoveryIntelligence)
    .where(eq(schema.discoveryIntelligence.competition, 'LOW'));
  const lowestCompetition = Number(lowCompRes[0]?.count ?? 0);

  // ── Portfolio ───────────────────────────────────────────────────────────────
  const maxSalaryRes = await db.select({ maxSal: sql<number>`max(${schema.jobs.salaryMax})` }).from(schema.jobs);
  const highestSalary = Number(maxSalaryRes[0]?.maxSal ?? 0);
  const highestSalaryFormatted = highestSalary > 0 ? formatSalary(highestSalary) : 'N/A';

  const companiesRes = await db.select({ count: sql<number>`count(*)` }).from(schema.companies);
  const totalCompanies = Number(companiesRes[0]?.count ?? 0);

  const avgOppRes = await db.select({ avg: sql<number>`avg(${schema.opportunityIntelligence.opportunityScore})` })
    .from(schema.opportunityIntelligence);
  const avgOpportunityScore = Math.round(Number(avgOppRes[0]?.avg ?? 0));

  // ── Application intelligence (Phase B5) ────────────────────────────────────
  const readyNowRes = await db.select({ count: sql<number>`count(*)` })
    .from(schema.applicationResults)
    .where(eq(schema.applicationResults.readinessLevel, 'Ready Now'));
  const readyNowCount = Number(readyNowRes[0]?.count ?? 0);

  const needsWorkRes = await db.select({ count: sql<number>`count(*)` })
    .from(schema.applicationResults)
    .where(eq(schema.applicationResults.readinessLevel, 'Needs Improvement'));
  const needsWorkCount = Number(needsWorkRes[0]?.count ?? 0);

  const avgReadinessRes = await db.select({ avg: sql<number>`avg(${schema.applicationResults.score})` })
    .from(schema.applicationResults);
  const avgReadiness = Math.round(Number(avgReadinessRes[0]?.avg ?? 0));

  // ── Latest run (hunt status panel) ─────────────────────────────────────────
  const latestRunRes = await db.select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.createdAt))
    .limit(1);
  const latestRun = latestRunRes[0] ?? null;

  // ── Priority opportunities (top APPLY + CONSIDER jobs) ─────────────────────
  // We want the top 6 jobs that have APPLY or CONSIDER decision,
  // joined with their company name, and enriched with competition + decision data.
  // Because this is a server component using drizzle with SQLite we do a simpler
  // approach: fetch decisions for APPLY/CONSIDER, get their job IDs, then fetch jobs.

  const actionableDecisions = await db.select({
    jobId:    schema.decisions.jobId,
    decision: schema.decisions.decision,
  })
    .from(schema.decisions)
    .where(inArray(schema.decisions.decision, ['APPLY', 'CONSIDER']))
    .limit(6);

  const priorityJobIds = actionableDecisions.map(d => d.jobId);

  type PriorityJob = {
    id: string;
    title: string | null;
    company: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    remote: string | null;
    firstSeenAt: string;
    decision: string;
    competition: string | null;
    score: number | null;
  };

  let priorityJobs: PriorityJob[] = [];

  if (priorityJobIds.length > 0) {
    // Fetch jobs with company display names
    const jobRows = await db.select({
      id:          schema.jobs.id,
      title:       schema.jobs.canonicalTitle,
      company:     schema.companies.displayName,
      salaryMin:   schema.jobs.salaryMin,
      salaryMax:   schema.jobs.salaryMax,
      remote:      schema.jobs.remoteType,
      firstSeenAt: schema.jobs.firstSeenAt,
    })
      .from(schema.jobs)
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(inArray(schema.jobs.id, priorityJobIds));

    // Fetch competition for these jobs
    const compRows = await db.select({
      jobId: schema.discoveryIntelligence.jobId,
      competition: schema.discoveryIntelligence.competition,
    })
      .from(schema.discoveryIntelligence)
      .where(inArray(schema.discoveryIntelligence.jobId, priorityJobIds));

    // Fetch opportunity scores for these jobs
    const scoreRows = await db.select({
      jobId: schema.opportunityIntelligence.jobId,
      score: schema.opportunityIntelligence.opportunityScore,
    })
      .from(schema.opportunityIntelligence)
      .where(inArray(schema.opportunityIntelligence.jobId, priorityJobIds));

    const decisionMap = new Map(actionableDecisions.map(d => [d.jobId, d.decision]));
    const compMap     = new Map(compRows.map(c => [c.jobId, c.competition]));
    const scoreMap    = new Map(scoreRows.map(s => [s.jobId, s.score]));

    priorityJobs = jobRows.map(j => ({
      id:          j.id,
      title:       j.title,
      company:     j.company,
      salaryMin:   j.salaryMin,
      salaryMax:   j.salaryMax,
      remote:      j.remote,
      firstSeenAt: j.firstSeenAt,
      decision:    decisionMap.get(j.id) ?? 'CONSIDER',
      competition: compMap.get(j.id)    ?? null,
      score:       scoreMap.get(j.id)   ?? null,
    }));

    // Sort: APPLY first, then by score descending
    priorityJobs.sort((a, b) => {
      if (a.decision === 'APPLY' && b.decision !== 'APPLY') return -1;
      if (b.decision === 'APPLY' && a.decision !== 'APPLY') return 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
  }

  // ── Age helper for job cards ────────────────────────────────────────────────
  function jobAge(firstSeenAt: string): string {
    const days = Math.floor((Date.now() - new Date(firstSeenAt).getTime()) / 86_400_000);
    if (days < 1) return 'Today';
    if (days === 1) return '1d ago';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  // ── Data availability flags ─────────────────────────────────────────────────
  const hasApplicationIntelligence = readyNowCount > 0 || needsWorkCount > 0 || avgReadiness > 0;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, gap: 16 }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              Intelligence Dashboard
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              What deserves your attention today?
            </p>
          </div>
          <Link
            href="/hunts/new"
            className="btn btn-primary"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: '0.875rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Start New Hunt
          </Link>
        </div>
      </div>

      {/* ── Empty state: no jobs yet ─────────────────────────────────────── */}
      {totalJobs === 0 ? (
        <div style={{ maxWidth: 560, margin: '80px auto' }}>
          <EmptyState
            title="No opportunities discovered yet"
            description="Start your first hunt to scan job boards, research companies, and surface hidden opportunities matched to your profile."
            icon="🔭"
            action={
              <Link href="/hunts/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Launch First Hunt
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* ── Section 1: Action Required ────────────────────────────────── */}
          <section aria-label="Action required" style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{
                margin: 0,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                Action Required
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <MetricCard
                href="/board"
                label="Apply Now"
                value={applyCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                }
              />
              <MetricCard
                href="/board"
                label="Apply This Week"
                value={considerCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                }
              />
              <MetricCard
                href="/board"
                label="Monitor"
                value={monitorCount}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                }
              />
              {/* Application readiness — only if data exists */}
              {hasApplicationIntelligence && readyNowCount > 0 && (
                <MetricCard
                  href="/jobs?readiness=Ready+Now"
                  label="Resume Ready"
                  value={readyNowCount}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                  }
                />
              )}
              {hasApplicationIntelligence && needsWorkCount > 0 && (
                <MetricCard
                  href="/jobs?readiness=Needs+Improvement"
                  label="Resume Needs Work"
                  value={needsWorkCount}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  }
                />
              )}
            </div>
          </section>

          {/* ── Section 2: Intelligence Overview ──────────────────────────── */}
          <section aria-label="Intelligence overview" style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{
                margin: 0,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                Intelligence Overview
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <MetricCard
                href="/jobs"
                label="Jobs Found"
                value={totalJobs}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                }
              />
              <MetricCard
                href="/jobs"
                label="Qualified Jobs"
                value={qualifiedJobs}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                }
              />
              <MetricCard
                href="/radar"
                label="Hidden Gems"
                value={hiddenGems}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                }
              />
              <MetricCard
                href="/radar"
                label="Low Competition"
                value={lowestCompetition}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                }
              />
              {hasApplicationIntelligence && avgReadiness > 0 && (
                <MetricCard
                  href="/jobs"
                  label="Avg Readiness"
                  value={`${avgReadiness}/100`}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  }
                />
              )}
            </div>
          </section>

          {/* ── Section 3: Priority Opportunities ────────────────────────── */}
          {priorityJobs.length > 0 && (
            <section aria-label="Priority opportunities" style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  Priority Opportunities
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                <Link
                  href="/board"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                  aria-label="View all opportunities on the Decision Board"
                >
                  View all
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {priorityJobs.map(job => (
                  <JobCard
                    key={job.id}
                    id={job.id}
                    title={job.title ?? 'Untitled Role'}
                    company={job.company ?? 'Unknown Company'}
                    salaryMin={job.salaryMin ?? undefined}
                    salaryMax={job.salaryMax ?? undefined}
                    remote={job.remote === 'REMOTE' || job.remote === 'HYBRID' || undefined}
                    score={job.score ?? undefined}
                    competition={job.competition ?? undefined}
                    age={jobAge(job.firstSeenAt)}
                    decision={job.decision}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Section 4: Portfolio ──────────────────────────────────────── */}
          <section aria-label="Portfolio overview" style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h2 style={{
                margin: 0,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                Portfolio
              </h2>
              <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
            </div>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              <MetricCard
                href="/jobs?sort=salary_desc"
                label="Highest Salary"
                value={highestSalaryFormatted}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                  </svg>
                }
              />
              <MetricCard
                href="/companies"
                label="Companies Researched"
                value={totalCompanies}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                }
              />
              <MetricCard
                href="/radar"
                label="Avg Opportunity Score"
                value={avgOpportunityScore > 0 ? `${avgOpportunityScore}/100` : 'N/A'}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                }
              />
            </div>
          </section>

          {/* ── Section 5: Latest Hunt Status ─────────────────────────────── */}
          {latestRun && (
            <section aria-label="Latest hunt status" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  Latest Hunt
                </h2>
                <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                <Link
                  href="/hunts"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'color 0.15s ease',
                  }}
                  aria-label="View all hunts"
                >
                  View all hunts
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </div>

              {/* Hunt card */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Running shimmer bar */}
                {latestRun.status === 'RUNNING' && (
                  <div
                    aria-hidden="true"
                    style={{
                      height: 2,
                      background: `linear-gradient(90deg, transparent, ${HUNT_DOT_COLOR.RUNNING}, transparent)`,
                      animation: 'shimmer 2s infinite',
                      backgroundSize: '200% 100%',
                    }}
                  />
                )}

                <div style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    {/* Left: ID + stage */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Status dot */}
                      <div
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: HUNT_DOT_COLOR[latestRun.status] ?? '#6b7280',
                          marginTop: 6,
                          flexShrink: 0,
                          boxShadow: latestRun.status === 'RUNNING'
                            ? `0 0 6px ${HUNT_DOT_COLOR.RUNNING}`
                            : 'none',
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.8125rem',
                              color: 'var(--text-secondary)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            #{latestRun.id.slice(0, 8)}
                          </span>
                          <StatusBadge
                            status={latestRun.status}
                            variant={HUNT_STATUS_VARIANT[latestRun.status] ?? 'neutral'}
                          />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          {latestRun.currentStage
                            ? latestRun.currentStage.replace(/_/g, ' ')
                            : latestRun.status === 'COMPLETED'
                              ? 'Pipeline complete'
                              : 'Not started'}
                        </p>
                        {latestRun.errorSummary && (
                          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--danger-text)' }}>
                            {latestRun.errorSummary}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: timestamps + link */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {timeAgo(latestRun.createdAt)}
                      </span>
                      {latestRun.completedAt && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Completed {timeAgo(latestRun.completedAt)}
                        </span>
                      )}
                      <Link
                        href={`/hunts/${latestRun.id}`}
                        className="btn"
                        style={{ padding: '5px 12px', fontSize: '0.8125rem', marginTop: 4 }}
                        aria-label={`View details for hunt ${latestRun.id.slice(0, 8)}`}
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
