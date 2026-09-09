import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, eq, and, inArray, sql, asc } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { getActiveRun } from '@/lib/pipeline/active-run';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jobs Explorer — JobSight',
  description: 'Explore, filter, and evaluate every opportunity discovered by your hunts.',
};

// ─── Filter select/input helpers ─────────────────────────────────────────────

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={`filter-${name}`}
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        defaultValue={defaultValue}
        style={{
          width: '100%',
          padding: '7px 10px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234f5666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '14px',
          paddingRight: 28,
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterInput({
  name,
  label,
  placeholder,
  defaultValue,
  type = 'text',
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number | undefined;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={`filter-${name}`}
        style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <input
        id={`filter-${name}`}
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue || ''}
        style={{
          width: '100%',
          padding: '7px 10px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />
    </div>
  );
}

// ─── Dashboard filter metadata ────────────────────────────────────────────────

const FILTER_META: Record<string, { title: string; description: string; icon: string }> = {
  'apply-now':       { title: 'Apply Now',               description: 'Jobs with a final decision of APPLY in the active hunt. Act on these immediately.',                              icon: '✅' },
  'apply-this-week': { title: 'Apply This Week',          description: 'Jobs with a final decision of REVIEW (Apply This Week) in the active hunt.',                                    icon: '📅' },
  'monitor':         { title: 'Monitor',                  description: 'Jobs still being evaluated (decision pending) in the active hunt. Keep an eye on these.',                       icon: '👁️' },
  'research':        { title: 'Research Required',        description: 'Jobs with insufficient evidence to make a final decision in the active hunt.',                                  icon: '🔍' },
  'favorable':       { title: 'Favorable Opportunities',  description: 'Jobs classified as FAVORABLE by canonical Opportunity Quality in the active hunt.',                             icon: '⭐' },
  'low-competition': { title: 'Low Competition',          description: 'Jobs with verified LOW competition level in the active hunt. UNKNOWN is excluded.',                             icon: '⚡' },
  'highest-salary':  { title: 'Highest Salary',           description: 'Jobs in the active hunt with disclosed salary information, sorted highest to lowest.',                          icon: '💰' },
  'qualified':       { title: 'Qualified Jobs',           description: 'Jobs observed in the active hunt that passed the initial qualification filter (not SKIPped).',                  icon: '🎯' },
  'jobs-found':      { title: 'All Jobs Found',           description: 'All jobs discovered across all hunts in the system.',                                                           icon: '🔭' },
};

// ─── Job type ─────────────────────────────────────────────────────────────────

type JobRow = {
  id: string;
  title: string | null;
  company: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  remote: boolean;
  competition: string | null | undefined;
  opportunity: string | null | undefined;
  decision: string | null | undefined;
  firstSeenAt: string;
};

// ─── Run-scoped filter query helpers ─────────────────────────────────────────

async function getJobsByFilter(filter: string, runId: string): Promise<JobRow[]> {
  // All queries are scoped to the given runId.
  // candidateDecisions is the canonical source for decision categories.
  // marketIntelligence is the canonical source for opportunity quality and competition.

  if (filter === 'apply-now' || filter === 'apply-this-week' || filter === 'monitor' || filter === 'research') {
    const decisionEnum =
      filter === 'apply-now'       ? 'APPLY' :
      filter === 'apply-this-week' ? 'REVIEW' :
      filter === 'monitor'         ? 'PENDING' :
      /* research */                 'INSUFFICIENT_EVIDENCE';

    const rows = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.canonicalTitle,
        company: schema.companies.displayName,
        salaryMin: schema.jobs.salaryMin,
        salaryMax: schema.jobs.salaryMax,
        remoteType: schema.jobs.remoteType,
        competition: schema.marketIntelligence.competitionLevel,
        opportunity: schema.marketIntelligence.opportunityIntelligence,
        decision: schema.candidateDecisions.finalDecision,
        firstSeenAt: schema.jobs.firstSeenAt,
      })
      .from(schema.candidateDecisions)
      .innerJoin(schema.jobs, eq(schema.candidateDecisions.jobId, schema.jobs.id))
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .leftJoin(
        schema.marketIntelligence,
        and(
          eq(schema.marketIntelligence.jobId, schema.jobs.id),
          eq(schema.marketIntelligence.runId, runId)
        )
      )
      .where(and(
        eq(schema.candidateDecisions.runId, runId),
        eq(schema.candidateDecisions.finalDecision, decisionEnum)
      ))
      .orderBy(desc(schema.jobs.firstSeenAt));

    return rows.map(r => ({
      ...r,
      remote: r.remoteType === 'REMOTE' || r.remoteType === 'FULLY_REMOTE',
    }));
  }

  if (filter === 'favorable') {
    const rows = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.canonicalTitle,
        company: schema.companies.displayName,
        salaryMin: schema.jobs.salaryMin,
        salaryMax: schema.jobs.salaryMax,
        remoteType: schema.jobs.remoteType,
        competition: schema.marketIntelligence.competitionLevel,
        opportunity: schema.marketIntelligence.opportunityIntelligence,
        firstSeenAt: schema.jobs.firstSeenAt,
      })
      .from(schema.marketIntelligence)
      .innerJoin(schema.jobs, eq(schema.marketIntelligence.jobId, schema.jobs.id))
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(and(
        eq(schema.marketIntelligence.runId, runId),
        eq(schema.marketIntelligence.opportunityIntelligence, 'FAVORABLE')
      ))
      .orderBy(desc(schema.jobs.firstSeenAt));

    return rows.map(r => ({
      ...r,
      remote: r.remoteType === 'REMOTE' || r.remoteType === 'FULLY_REMOTE',
      decision: undefined,
    }));
  }

  if (filter === 'low-competition') {
    // Explicitly only LOW — UNKNOWN is excluded per spec.
    const rows = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.canonicalTitle,
        company: schema.companies.displayName,
        salaryMin: schema.jobs.salaryMin,
        salaryMax: schema.jobs.salaryMax,
        remoteType: schema.jobs.remoteType,
        competition: schema.marketIntelligence.competitionLevel,
        opportunity: schema.marketIntelligence.opportunityIntelligence,
        firstSeenAt: schema.jobs.firstSeenAt,
      })
      .from(schema.marketIntelligence)
      .innerJoin(schema.jobs, eq(schema.marketIntelligence.jobId, schema.jobs.id))
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(and(
        eq(schema.marketIntelligence.runId, runId),
        eq(schema.marketIntelligence.competitionLevel, 'LOW')
        // UNKNOWN is NOT included — verified per spec Part D
      ))
      .orderBy(desc(schema.jobs.firstSeenAt));

    return rows.map(r => ({
      ...r,
      remote: r.remoteType === 'REMOTE' || r.remoteType === 'FULLY_REMOTE',
      decision: undefined,
    }));
  }

  if (filter === 'highest-salary') {
    // Scoped to run via jobObservations, excludes null/zero salary.
    // Sorted deterministically: salaryMax DESC, then jobId ASC as tiebreaker.
    const rows = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.canonicalTitle,
        company: schema.companies.displayName,
        salaryMin: schema.jobs.salaryMin,
        salaryMax: schema.jobs.salaryMax,
        remoteType: schema.jobs.remoteType,
        firstSeenAt: schema.jobs.firstSeenAt,
      })
      .from(schema.jobs)
      .innerJoin(
        schema.jobObservations,
        and(
          eq(schema.jobObservations.jobId, schema.jobs.id),
          eq(schema.jobObservations.runId, runId)
        )
      )
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(sql`${schema.jobs.salaryMax} IS NOT NULL AND ${schema.jobs.salaryMax} > 0`)
      .orderBy(desc(schema.jobs.salaryMax), asc(schema.jobs.id));

    return rows.map(r => ({
      ...r,
      remote: r.remoteType === 'REMOTE' || r.remoteType === 'FULLY_REMOTE',
      competition: undefined,
      opportunity: undefined,
      decision: undefined,
    }));
  }

  if (filter === 'qualified') {
    // Qualified = observed in run, NOT SKIPped in decisions table.
    const skipRows = await db
      .select({ jobId: schema.decisions.jobId })
      .from(schema.decisions)
      .where(and(
        eq(schema.decisions.runId, runId),
        eq(schema.decisions.decision, 'SKIP')
      ));
    const skippedIds = new Set(skipRows.map(r => r.jobId));

    const rows = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.canonicalTitle,
        company: schema.companies.displayName,
        salaryMin: schema.jobs.salaryMin,
        salaryMax: schema.jobs.salaryMax,
        remoteType: schema.jobs.remoteType,
        firstSeenAt: schema.jobs.firstSeenAt,
      })
      .from(schema.jobObservations)
      .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(eq(schema.jobObservations.runId, runId))
      .orderBy(desc(schema.jobs.firstSeenAt));

    // Deduplicate and filter out skipped
    const seen = new Set<string>();
    return rows
      .filter(r => {
        if (skippedIds.has(r.id) || seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .map(r => ({
        ...r,
        remote: r.remoteType === 'REMOTE' || r.remoteType === 'FULLY_REMOTE',
        competition: undefined,
        opportunity: undefined,
        decision: undefined,
      }));
  }

  // Default: jobs-found — all jobs across all runs
  const rows = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.canonicalTitle,
      company: schema.companies.displayName,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      remoteType: schema.jobs.remoteType,
      firstSeenAt: schema.jobs.firstSeenAt,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .orderBy(desc(schema.jobs.firstSeenAt));

  return rows.map(r => ({
    ...r,
    remote: r.remoteType === 'REMOTE' || r.remoteType === 'FULLY_REMOTE',
    competition: undefined,
    opportunity: undefined,
    decision: undefined,
  }));
}

// ─── Legacy sidebar filter (for non-dashboard navigation) ────────────────────

async function getLegacyFilteredJobs(params: {
  decisionFilter: string | undefined;
  minSalaryFilter: number | undefined;
  currencyFilter: string | undefined;
  remoteFilter: string | undefined;
  countryFilter: string | undefined;
  companyFilter: string | undefined;
  competitionFilter: string | undefined;
  postingAgeFilter: number | undefined;
}) {
  const jobs = await db.select().from(schema.jobs).orderBy(desc(schema.jobs.firstSeenAt));
  const decisions = await db.select().from(schema.decisions);
  const companies = await db.select().from(schema.companies);

  const filteredJobs = jobs.filter(job => {
    const decision = decisions.find(d => d.jobId === job.id);
    const decisionText = decision?.decision || 'PENDING';
    const company = companies.find(c => c.id === job.companyId);
    const companyName = company?.displayName || '';
    const ageDays = (Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);

    if (params.decisionFilter && params.decisionFilter !== 'ALL' && decisionText !== params.decisionFilter) return false;
    if (params.minSalaryFilter && (!job.salaryMin || job.salaryMin < params.minSalaryFilter)) return false;
    if (params.currencyFilter && params.currencyFilter !== 'ALL' && job.salaryCurrency !== params.currencyFilter) return false;
    if (params.remoteFilter && params.remoteFilter !== 'ALL' && job.remoteType !== params.remoteFilter) return false;
    if (params.countryFilter && !job.location?.toLowerCase().includes(params.countryFilter.toLowerCase())) return false;
    if (params.companyFilter && !companyName.toLowerCase().includes(params.companyFilter.toLowerCase())) return false;
    if (params.postingAgeFilter && ageDays > params.postingAgeFilter) return false;

    return true;
  });

  return filteredJobs.map(job => {
    const decision = decisions.find(d => d.jobId === job.id);
    const company = companies.find(c => c.id === job.companyId);
    const ageDays = Math.floor((Date.now() - new Date(job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: job.id,
      title: job.canonicalTitle || job.normalizedTitle || 'Unknown Role',
      company: company?.displayName || 'Unknown Company',
      salaryMin: job.salaryMin || undefined,
      salaryMax: job.salaryMax || undefined,
      remote: job.remoteType === 'REMOTE' || job.remoteType === 'FULLY_REMOTE',
      competition: undefined as string | undefined,
      opportunity: undefined as string | undefined,
      decision: decision?.decision || 'PENDING',
      firstSeenAt: job.firstSeenAt,
      ageDays,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const dashboardFilter = sp.filter as string | undefined;

  // Legacy sidebar filters (only active when no dashboard filter is set)
  const decisionFilter    = sp.decision as string | undefined;
  const minSalaryFilter   = sp.salary ? parseInt(sp.salary as string) : undefined;
  const currencyFilter    = sp.currency as string | undefined;
  const remoteFilter      = sp.remote as string | undefined;
  const countryFilter     = sp.country as string | undefined;
  const companyFilter     = sp.company as string | undefined;
  const competitionFilter = sp.competition as string | undefined;
  const postingAgeFilter  = sp.postingAge ? parseInt(sp.postingAge as string) : undefined;

  const latestRun = await getActiveRun();

  // ── Dashboard filter mode ─────────────────────────────────────────────────
  if (dashboardFilter) {
    const meta = FILTER_META[dashboardFilter] ?? {
      title: 'Filtered Jobs',
      description: 'Jobs matching the selected filter.',
      icon: '📋',
    };

    let filteredJobs: JobRow[] = [];
    let noRunError = false;

    if (!latestRun && dashboardFilter !== 'jobs-found') {
      noRunError = true;
    } else {
      filteredJobs = await getJobsByFilter(dashboardFilter, latestRun?.id ?? '');
    }

    // Deduplicate by job ID (safety net for join-multiplied rows)
    const seen = new Set<string>();
    const dedupedJobs = filteredJobs.filter(j => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });

    function jobAge(firstSeenAt: string): string {
      const days = Math.floor((Date.now() - new Date(firstSeenAt).getTime()) / 86_400_000);
      if (days < 1) return 'Today';
      if (days === 1) return '1d ago';
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return `${Math.floor(days / 30)}mo ago`;
    }

    return (
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Dashboard', href: '/' }, { label: meta.title }]} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: '1.5rem' }}>{meta.icon}</span>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                  {meta.title}
                </h1>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 560 }}>
                {meta.description}
              </p>
              {!noRunError && (
                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {dedupedJobs.length} {dedupedJobs.length === 1 ? 'job' : 'jobs'}
                  {latestRun && dashboardFilter !== 'jobs-found' ? ` · Hunt #${latestRun.id.slice(0, 8)}` : ''}
                </p>
              )}
            </div>
            <Link href="/" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: '0.8125rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', textDecoration: 'none', background: 'var(--bg-card)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Content */}
        {noRunError ? (
          <EmptyState
            title="No active hunt"
            description="Start a hunt first to see results for this filter."
            icon="🔭"
            action={
              <Link href="/hunts/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Start a Hunt
              </Link>
            }
          />
        ) : dedupedJobs.length === 0 ? (
          <EmptyState
            title={`No ${meta.title.toLowerCase()} found`}
            description="No jobs match this filter for the active hunt."
            icon={meta.icon}
            action={
              <Link href="/" className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Back to Dashboard
              </Link>
            }
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 14,
            animation: 'fadeIn 0.3s ease-out',
          }}>
            {dedupedJobs.map(job => (
              <JobCard
                key={job.id}
                id={job.id}
                title={job.title ?? 'Unknown Role'}
                company={job.company ?? 'Unknown Company'}
                salaryMin={job.salaryMin ?? undefined}
                salaryMax={job.salaryMax ?? undefined}
                remote={job.remote}
                competition={job.competition ?? undefined}
                opportunityQuality={job.opportunity ?? undefined}
                decision={job.decision ?? undefined}
                age={jobAge(job.firstSeenAt)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy sidebar filter mode ────────────────────────────────────────────
  const hasActiveFilters = !!(decisionFilter || minSalaryFilter || currencyFilter ||
    remoteFilter || countryFilter || companyFilter || competitionFilter || postingAgeFilter);

  const legacyJobs = await getLegacyFilteredJobs({
    decisionFilter,
    minSalaryFilter,
    currencyFilter,
    remoteFilter,
    countryFilter,
    companyFilter,
    competitionFilter,
    postingAgeFilter,
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Jobs Explorer' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 16, gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Jobs Explorer
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {legacyJobs.length} {legacyJobs.length === 1 ? 'opportunity' : 'opportunities'}{hasActiveFilters ? ' matching filters' : ' discovered'}
            </p>
          </div>
          {hasActiveFilters && (
            <Link href="/jobs" className="btn" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear filters
            </Link>
          )}
        </div>
      </div>

      {/* Layout: filter sidebar + jobs grid */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Filter sidebar */}
        <aside
          aria-label="Job filters"
          style={{
            flexShrink: 0,
            width: 256,
            position: 'sticky',
            top: 24,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filters
            </h2>
            {hasActiveFilters && (
              <span style={{
                background: 'var(--accent-glow)',
                color: 'var(--info)',
                border: '1px solid var(--info-border)',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '1px 7px',
              }}>Active</span>
            )}
          </div>

          <form method="GET" style={{ display: 'flex', flexDirection: 'column' }}>
            <FilterSelect
              name="decision"
              label="Decision"
              defaultValue={decisionFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'All Decisions' },
                { value: 'APPLY', label: '✓ Apply' },
                { value: 'CONSIDER', label: '◷ Consider' },
                { value: 'RESEARCH_REQUIRED', label: '⎋ Research' },
                { value: 'SKIP', label: '✕ Skip' },
                { value: 'PENDING', label: '· Pending' },
              ]}
            />

            <FilterInput
              name="salary"
              label="Min Salary"
              placeholder="e.g. 100000"
              defaultValue={minSalaryFilter}
              type="number"
            />

            <FilterSelect
              name="currency"
              label="Currency"
              defaultValue={currencyFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any Currency' },
                { value: 'USD', label: 'USD' },
                { value: 'EUR', label: 'EUR' },
                { value: 'GBP', label: 'GBP' },
                { value: 'INR', label: 'INR' },
              ]}
            />

            <FilterSelect
              name="remote"
              label="Remote Status"
              defaultValue={remoteFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any' },
                { value: 'REMOTE', label: 'Remote' },
                { value: 'HYBRID', label: 'Hybrid' },
                { value: 'ONSITE', label: 'On-site' },
              ]}
            />

            <FilterInput
              name="country"
              label="Country / Location"
              placeholder="e.g. US, India..."
              defaultValue={countryFilter}
            />

            <FilterInput
              name="company"
              label="Company"
              placeholder="Search company..."
              defaultValue={companyFilter}
            />

            <FilterSelect
              name="competition"
              label="Competition"
              defaultValue={competitionFilter || 'ALL'}
              options={[
                { value: 'ALL', label: 'Any' },
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
              ]}
            />

            <FilterInput
              name="postingAge"
              label="Max Posting Age (days)"
              placeholder="e.g. 7"
              defaultValue={postingAgeFilter}
              type="number"
            />

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.875rem', padding: '9px 0' }}
            >
              Apply Filters
            </button>

            {hasActiveFilters && (
              <Link
                href="/jobs"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  marginTop: 10,
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  transition: 'color 0.15s',
                }}
              >
                Clear all filters
              </Link>
            )}
          </form>
        </aside>

        {/* Jobs grid */}
        <main
          aria-label="Job listings"
          style={{ flex: 1, minWidth: 0 }}
        >
          {legacyJobs.length === 0 ? (
            <EmptyState
              title="No jobs match your filters"
              description="Try adjusting your filters to discover more opportunities, or start a new hunt to find fresh roles."
              icon="📭"
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 14,
              animation: 'fadeIn 0.3s ease-out',
            }}>
              {legacyJobs.map(job => (
                <JobCard
                  key={job.id}
                  id={job.id}
                  title={job.title}
                  company={job.company}
                  salaryMin={job.salaryMin}
                  salaryMax={job.salaryMax}
                  remote={job.remote}
                  competition={job.competition}
                  age={job.ageDays === 0 ? 'Today' : `${job.ageDays}d ago`}
                  decision={job.decision}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
