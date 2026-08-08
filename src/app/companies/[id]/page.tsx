import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const rec = await db.select({ name: schema.companies.displayName }).from(schema.companies).where(eq(schema.companies.id, id)).limit(1);
  const name = rec[0]?.name ?? 'Company';
  return {
    title: `${name} — JobSight`,
    description: `Intelligence report for ${name}. Hiring trends, opportunity score, and open roles.`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch { return [val]; }
  }
  return [];
}

function trendVariant(trend: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!trend) return 'neutral';
  const t = trend.toLowerCase();
  if (t.includes('growing')) return 'success';
  if (t.includes('stable')) return 'neutral';
  if (t.includes('slowing')) return 'warning';
  return 'neutral';
}

function outlookVariant(level: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!level) return 'neutral';
  const l = level.toLowerCase();
  if (l.includes('excellent') || l.includes('strong')) return 'success';
  if (l.includes('good')) return 'info';
  if (l.includes('average')) return 'warning';
  if (l.includes('weak')) return 'danger';
  return 'neutral';
}

function stabilityVariant(s: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!s) return 'neutral';
  const v = s.toLowerCase();
  if (v === 'high') return 'success';
  if (v === 'medium') return 'warning';
  if (v === 'low') return 'danger';
  return 'neutral';
}

function decisionVariant(d: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!d) return 'neutral';
  if (d === 'APPLY' || d === 'APPLY_NOW') return 'success';
  if (d === 'CONSIDER' || d === 'APPLY_LATER') return 'warning';
  if (d === 'SKIP' || d === 'REJECTED') return 'danger';
  if (d === 'RESEARCH_REQUIRED') return 'info';
  return 'neutral';
}

function readinessVariant(level: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!level) return 'neutral';
  if (level === 'Ready Now') return 'success';
  if (level === 'Almost Ready') return 'info';
  if (level === 'Needs Improvement') return 'warning';
  if (level === 'Not Recommended') return 'danger';
  return 'neutral';
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

const DECISION_ORDER: Record<string, number> = {
  APPLY: 0, APPLY_NOW: 0,
  CONSIDER: 1, APPLY_LATER: 1,
  RESEARCH_REQUIRED: 2,
  MONITOR: 3,
  SKIP: 4, REJECTED: 4,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ── Company record ──────────────────────────────────────────────────────────
  const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, id)).limit(1);
  const comp = compRec[0];

  if (!comp) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
        <EmptyState
          title="Company Not Found"
          description="We couldn't locate the requested company profile."
          icon="🏢"
          action={<Link href="/companies"><ActionButton variant="primary">Back to Companies</ActionButton></Link>}
        />
      </div>
    );
  }

  // ── Jobs ────────────────────────────────────────────────────────────────────
  const jobs = await db.select().from(schema.jobs)
    .where(eq(schema.jobs.companyId, comp.id))
    .orderBy(desc(schema.jobs.firstSeenAt));

  // ── Research artifacts ──────────────────────────────────────────────────────
  const artifacts = await db.select()
    .from(schema.researchArtifacts)
    .where(eq(schema.researchArtifacts.entityId, comp.id))
    .orderBy(desc(schema.researchArtifacts.createdAt))
    .limit(1);
  const artifact = artifacts[0];

  // ── Basic company analysis (existing) ───────────────────────────────────────
  const analysisRecs = await db.select()
    .from(schema.companyAnalysis)
    .where(eq(schema.companyAnalysis.companyId, comp.id))
    .orderBy(desc(schema.companyAnalysis.researchTimestamp))
    .limit(1);
  const analysis = analysisRecs[0];

  // ── B3: Company Opportunity Intelligence ────────────────────────────────────
  const coOpportunityRec = await db.select()
    .from(schema.companyOpportunity)
    .where(eq(schema.companyOpportunity.companyId, comp.id))
    .limit(1);
  const coOpportunity = coOpportunityRec[0] ?? null;

  const coSummaryRec = await db.select()
    .from(schema.companySummary)
    .where(eq(schema.companySummary.companyId, comp.id))
    .limit(1);
  const coSummary = coSummaryRec[0] ?? null;

  const coOutlookRec = await db.select()
    .from(schema.companyOutlook)
    .where(eq(schema.companyOutlook.companyId, comp.id))
    .limit(1);
  const coOutlook = coOutlookRec[0] ?? null;

  const coSignalsRec = await db.select()
    .from(schema.companySignals)
    .where(eq(schema.companySignals.companyId, comp.id));
  const coSignals = coSignalsRec;

  // ── Parse research artifact ─────────────────────────────────────────────────
  let research: {
    companyInfo?: { funding?: string; size?: string };
    hiring?: { remoteOpenings?: boolean };
  } | null = null;
  if (artifact?.metadata) {
    try {
      const parsed = typeof artifact.metadata === 'string'
        ? JSON.parse(artifact.metadata)
        : artifact.metadata;
      research = parsed?.structuredData || null;
    } catch { /* ignore */ }
  }

  // ── Per-job batch fetching ──────────────────────────────────────────────────
  let jobIntel: typeof schema.discoveryIntelligence.$inferSelect[] = [];
  let jobSources: typeof schema.jobSources.$inferSelect[] = [];
  let jobDecisions: typeof schema.decisions.$inferSelect[] = [];
  let jobDecisionResults: typeof schema.decisionResults.$inferSelect[] = [];
  let jobAppResults: typeof schema.applicationResults.$inferSelect[] = [];
  let jobCompResults: typeof schema.competitionResults.$inferSelect[] = [];
  let jobOppDisc: typeof schema.oppDiscoveryResults.$inferSelect[] = [];

  if (jobs.length > 0) {
    const jobIds = jobs.map(j => j.id);

    // Chunk to avoid SQLite variable limit
    const chunks: string[][] = [];
    for (let i = 0; i < jobIds.length; i += 50) chunks.push(jobIds.slice(i, i + 50));

    for (const chunk of chunks) {
      const [intel, sources, decs, decRes, appRes, compRes, oppDisc] = await Promise.all([
        db.select().from(schema.discoveryIntelligence).where(inArray(schema.discoveryIntelligence.jobId, chunk)),
        db.select().from(schema.jobSources).where(inArray(schema.jobSources.jobId, chunk)),
        db.select().from(schema.decisions).where(inArray(schema.decisions.jobId, chunk)),
        db.select().from(schema.decisionResults).where(inArray(schema.decisionResults.jobId, chunk)),
        db.select().from(schema.applicationResults).where(inArray(schema.applicationResults.jobId, chunk)),
        db.select().from(schema.competitionResults).where(inArray(schema.competitionResults.jobId, chunk)),
        db.select().from(schema.oppDiscoveryResults).where(inArray(schema.oppDiscoveryResults.jobId, chunk)),
      ]);
      jobIntel.push(...intel);
      jobSources.push(...sources);
      jobDecisions.push(...decs);
      jobDecisionResults.push(...decRes);
      jobAppResults.push(...appRes);
      jobCompResults.push(...compRes);
      jobOppDisc.push(...oppDisc);
    }
  }

  // ── Process existing data ──────────────────────────────────────────────────
  const activeJobs = jobs.filter(j => j.status === 'ACTIVE').length;

  let avgAuthenticity = 0;
  let hiddenGemCount = 0;
  if (jobIntel.length > 0) {
    let authSum = 0, authCount = 0;
    jobIntel.forEach(intel => {
      if (intel.authenticity) {
        const val = parseInt(intel.authenticity.toString(), 10);
        if (!isNaN(val)) { authSum += val; authCount++; }
      }
      if (intel.hiddenGem) hiddenGemCount++;
    });
    if (authCount > 0) avgAuthenticity = Math.round(authSum / authCount);
  }

  // Source types
  const sourceTypes = jobSources.reduce((acc, src) => {
    acc[src.sourceType] = (acc[src.sourceType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Maps for per-job enrichment ─────────────────────────────────────────────
  const decisionMap = new Map(jobDecisionResults.map(d => [d.jobId, d]));
  // Fallback to basic decisions if no decisionResult
  const basicDecisionMap = new Map(jobDecisions.map(d => [d.jobId, d]));
  const appResultMap = new Map(jobAppResults.map(a => [a.jobId, a]));
  const compResultMap = new Map(jobCompResults.map(c => [c.jobId, c]));
  const oppDiscMap = new Map(jobOppDisc.map(o => [o.jobId, o]));

  // ── Company-level aggregates from job data (only if no B3 data) ────────────
  const hasB3 = !!(coOpportunity || coSummary || coOutlook);

  // Average competition score across jobs (only when no B3 company-level)
  let avgCompetitionScore: number | null = null;
  let dominantCompetitionLevel: string | null = null;
  if (!hasB3 && jobCompResults.length > 0) {
    const sum = jobCompResults.reduce((acc, r) => acc + r.score, 0);
    avgCompetitionScore = Math.round(sum / jobCompResults.length);
    // Most frequent level
    const levelCounts = jobCompResults.reduce((acc, r) => {
      acc[r.level] = (acc[r.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    dominantCompetitionLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  // Average discovery score across jobs
  let avgDiscoveryScore: number | null = null;
  if (jobOppDisc.length > 0) {
    const sum = jobOppDisc.reduce((acc, r) => acc + r.score, 0);
    avgDiscoveryScore = Math.round(sum / jobOppDisc.length);
  }

  // ── Sort jobs: APPLY first, then CONSIDER, then by date ────────────────────
  const sortedJobs = [...jobs].sort((a, b) => {
    const decA = decisionMap.get(a.id)?.decision ?? basicDecisionMap.get(a.id)?.decision;
    const decB = decisionMap.get(b.id)?.decision ?? basicDecisionMap.get(b.id)?.decision;
    const rankA = decA != null ? (DECISION_ORDER[decA] ?? 99) : 99;
    const rankB = decB != null ? (DECISION_ORDER[decB] ?? 99) : 99;
    if (rankA !== rankB) return rankA - rankB;
    // Same rank: newest first
    return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
  });

  // ── Effective hiring trend (B3 preferred, fallback basic) ──────────────────
  const effectiveHiringTrend = coSummary?.hiringTrend ?? coOutlook?.trend ?? analysis?.hiringMomentum ?? null;
  const effectiveRemote = coSummary?.remoteHiring ?? analysis?.remoteFriendliness ?? (research?.hiring?.remoteOpenings ? 'Remote Friendly' : null);
  const effectiveEngineering = coSummary?.engineeringHiring ?? analysis?.engineeringHiringActivity ?? null;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1rem', animation: 'fadeIn 0.35s ease-out' }}>

      {/* ── Breadcrumbs ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Companies', href: '/companies' },
          { label: comp.displayName },
        ]} />
      </div>

      {/* ── Hero Section (preserved) ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{comp.displayName}</h1>
            {avgAuthenticity > 80 && (
              <StatusBadge status="✓ Highly Authentic" variant="success" />
            )}
            {coOpportunity && (
              <StatusBadge
                status={coOpportunity.level}
                variant={outlookVariant(coOpportunity.level)}
                aria-label={`Company opportunity level: ${coOpportunity.level}`}
              />
            )}
            {effectiveHiringTrend && (
              <StatusBadge
                status={effectiveHiringTrend}
                variant={trendVariant(effectiveHiringTrend)}
                aria-label={`Hiring trend: ${effectiveHiringTrend}`}
              />
            )}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            {comp.website && (
              <a href={comp.website} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🌐 Website
              </a>
            )}
            {comp.careersUrl && (
              <a href={comp.careersUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💼 Careers Page
              </a>
            )}
          </div>
        </div>
        <Link href="/companies" className="btn" style={{ flexShrink: 0 }}>
          ← Back
        </Link>
      </div>

      {/* ── Overview Grid (enhanced MetricCards) ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: coOpportunity ? '1.5rem' : '3rem' }}>
        {/* Hiring Trend — enriched with B3 when available */}
        <MetricCard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
          label="Hiring Trend"
          value={effectiveHiringTrend ?? 'Unknown'}
        />
        <MetricCard
          href="/jobs"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>}
          label="Open Roles"
          value={activeJobs}
        />
        <MetricCard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>}
          label="Remote Hiring"
          value={effectiveRemote ?? 'Unknown'}
        />
        <MetricCard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 011.98-3A2.5 2.5 0 019.5 2z"/><path d="M14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-1.98-3A2.5 2.5 0 0014.5 2z"/></svg>}
          label="Eng. Hiring"
          value={effectiveEngineering ?? 'Unknown'}
        />
        <MetricCard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
          label="Funding"
          value={research?.companyInfo?.funding ?? 'Unknown'}
        />
        <MetricCard
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
          label="Company Size"
          value={research?.companyInfo?.size ?? 'Unknown'}
        />
        {hiddenGemCount > 0 && (
          <MetricCard
            href={`/jobs?hiddenGem=true`}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            label="Hidden Gems"
            value={hiddenGemCount}
          />
        )}
        {coOpportunity && (
          <MetricCard
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
            label="Opportunity Score"
            value={`${coOpportunity.score}/100`}
          />
        )}
      </div>

      {/* ── B3 Intelligence Summary Strip ─────────────────────────────────────── */}
      {(coOpportunity || coSummary || coOutlook) && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: '3rem',
            padding: '14px 18px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            alignItems: 'center',
          }}
          role="region"
          aria-label="Company intelligence summary"
        >
          {coOpportunity && (
            <IntelPill label="Opportunity" value={coOpportunity.level} variant={outlookVariant(coOpportunity.level)} />
          )}
          {coSummary?.hiringTrend && (
            <IntelPill label="Hiring Trend" value={coSummary.hiringTrend} variant={trendVariant(coSummary.hiringTrend)} />
          )}
          {coOutlook?.stability && (
            <IntelPill label="Stability" value={coOutlook.stability} variant={stabilityVariant(coOutlook.stability)} />
          )}
          {coSummary?.competition && (
            <IntelPill label="Competition" value={coSummary.competition} variant="neutral" />
          )}
          {coSummary?.authenticity && (
            <IntelPill label="Authenticity" value={coSummary.authenticity} variant="neutral" />
          )}
          {coSummary?.confidence != null && (
            <IntelPill label="Confidence" value={`${coSummary.confidence}%`} variant="neutral" />
          )}
          {coOutlook?.momentum != null && (
            <IntelPill label="Momentum" value={`${coOutlook.momentum}/100`} variant="neutral" />
          )}
        </div>
      )}

      {/* ── Main two-column layout ────────────────────────────────────────────── */}
      <div
        className="company-detail-grid"
        style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', marginBottom: '3rem' }}
      >

        {/* ═══════════════════════════════════════ */}
        {/* LEFT: Job Posting History               */}
        {/* ═══════════════════════════════════════ */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-hairline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Posting History</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {sortedJobs.length} {sortedJobs.length === 1 ? 'role' : 'roles'}
              {jobDecisions.length > 0 || jobDecisionResults.length > 0 ? ' · sorted by priority' : ' · sorted by latest'}
            </span>
          </div>

          {sortedJobs.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }} aria-hidden="true">📭</div>
              No jobs observed yet. Start your first hunt!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Role</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Location</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1.25rem' }}>Decision</th>
                    <th style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}>Readiness</th>
                    <th style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}>First Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.map(job => {
                    const decRes = decisionMap.get(job.id);
                    const basicDec = basicDecisionMap.get(job.id);
                    const jobDecision = decRes?.decision ?? basicDec?.decision ?? null;
                    const appResult = appResultMap.get(job.id);

                    return (
                      <tr key={job.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                        <td style={{ padding: '0.875rem 1.25rem', fontWeight: 500, maxWidth: '200px' }}>
                          <Link
                            href={`/jobs/${job.id}`}
                            style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9375rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {job.canonicalTitle || job.normalizedTitle || 'Untitled'}
                          </Link>
                        </td>
                        <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                          <Link
                            href={`/jobs?location=${job.location || job.remoteType || 'Unknown'}`}
                            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
                          >
                            {job.location || job.remoteType || '—'}
                          </Link>
                        </td>
                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          <StatusBadge
                            status={job.status}
                            variant={job.status === 'ACTIVE' ? 'success' : 'neutral'}
                          />
                        </td>
                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          {jobDecision ? (
                            <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                              <StatusBadge
                                status={jobDecision.replace(/_/g, ' ')}
                                variant={decisionVariant(jobDecision)}
                              />
                            </Link>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1.25rem' }}>
                          {appResult ? (
                            <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                              <StatusBadge
                                status={appResult.readinessLevel}
                                variant={readinessVariant(appResult.readinessLevel)}
                              />
                            </Link>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                          {new Date(job.firstSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* RIGHT: Sidebar Intelligence             */}
        {/* ═══════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── B3 Company Opportunity ─────────────────────────────────────── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-hairline)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Company Opportunity
            </h3>

            {coOpportunity ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Score + level prominent display */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <StatusBadge status={coOpportunity.level} variant={outlookVariant(coOpportunity.level)} />
                  <span style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    {coOpportunity.score}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                  </span>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <ProgressBar
                    progress={coOpportunity.score}
                    color={scoreColor(coOpportunity.score)}
                    height={5}
                  />
                </div>
                {coSummary && (
                  <>
                    <IntelRow label="Hiring Trend"        value={coSummary.hiringTrend} />
                    <IntelRow label="Remote Hiring"       value={coSummary.remoteHiring} />
                    <IntelRow label="Eng. Hiring"         value={coSummary.engineeringHiring} />
                    <IntelRow label="Competition"         value={coSummary.competition} />
                    <IntelRow label="Evidence Count"      value={`${coSummary.evidenceCount} signals`} />
                  </>
                )}
                {coOutlook && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <IntelRow label="Momentum" value={`${coOutlook.momentum}/100`} />
                    <IntelRow label="Stability" value={coOutlook.stability} />
                  </div>
                )}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-hairline)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Confidence</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{coOpportunity.confidence}%</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem', fontStyle: 'italic' }}>
                Company opportunity analysis not available yet.
              </p>
            )}
          </div>

          {/* ── Intelligence Snapshots (enhanced — B3 preferred, basic fallback) */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-hairline)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 011.98-3A2.5 2.5 0 019.5 2z"/><path d="M14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-1.98-3A2.5 2.5 0 0014.5 2z"/></svg>
              Intelligence Snapshots
            </h3>

            {analysis || coSummary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* B3 preferred fields, basic fallback */}
                <IntelRow label="Growth Signal"  value={analysis?.growthSignal  || 'N/A'} />
                <IntelRow label="Layoff Signal"  value={analysis?.layoffSignal  || 'N/A'} />
                <IntelRow label="Eng. Activity"  value={effectiveEngineering    || 'N/A'} />
                {coSignals.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-hairline)' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Key Signals ({coSignals.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {coSignals.slice(0, 5).map((sig, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', flex: 1 }}>
                            {sig.signalType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                          </span>
                          {sig.value && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                              {sig.value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  {analysis ? `Updated ${new Date(analysis.researchTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem', fontStyle: 'italic' }}>
                No deep analysis run yet.
              </p>
            )}
          </div>

          {/* ── Competition Overview ────────────────────────────────────────── */}
          {(avgCompetitionScore !== null || coSummary?.competition) && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-hairline)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Competition Overview
              </h3>
              {coSummary?.competition ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <IntelRow label="Overall Competition" value={coSummary.competition} />
                  {jobCompResults.length > 0 && (
                    <IntelRow label="Jobs Analyzed" value={`${jobCompResults.length}`} />
                  )}
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Based on B3 company intelligence.
                  </p>
                </div>
              ) : avgCompetitionScore !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {dominantCompetitionLevel && (
                    <div style={{ marginBottom: 10 }}>
                      <StatusBadge
                        status={dominantCompetitionLevel}
                        variant={dominantCompetitionLevel === 'Low' || dominantCompetitionLevel === 'Very Low' ? 'success' : dominantCompetitionLevel === 'High' || dominantCompetitionLevel === 'Very High' ? 'danger' : 'warning'}
                      />
                    </div>
                  )}
                  <div style={{ marginBottom: 10 }}>
                    <ProgressBar
                      progress={avgCompetitionScore}
                      color={avgCompetitionScore < 40 ? 'var(--success)' : avgCompetitionScore < 70 ? 'var(--warning)' : 'var(--danger)'}
                      height={5}
                    />
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Low competition</span><span>High competition</span>
                    </div>
                  </div>
                  <IntelRow label="Avg Score" value={`${avgCompetitionScore}/100`} />
                  <IntelRow label="Jobs Analyzed" value={`${jobCompResults.length}`} />
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Aggregated from {jobCompResults.length} job-level results.
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* ── Discovery / Source Quality ──────────────────────────────────── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-hairline)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Observed Sources
            </h3>

            {Object.keys(sourceTypes).length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(sourceTypes).map(([type, count]) => (
                  <li key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link
                      href={`/jobs?provider=${type}`}
                      style={{ fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', fontSize: '0.875rem' }}
                    >
                      {type.replace(/_/g, ' ')}
                    </Link>
                    <span style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-hairline)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>No sources recorded.</p>
            )}

            {/* Discovery Quality summary if available */}
            {(avgDiscoveryScore !== null || avgAuthenticity > 0 || hiddenGemCount > 0) && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Discovery Quality
                </div>
                {avgDiscoveryScore !== null && (
                  <>
                    <IntelRow label="Avg Discovery Score" value={`${avgDiscoveryScore}/100`} />
                    <div style={{ margin: '6px 0 10px' }}>
                      <ProgressBar progress={avgDiscoveryScore} color={scoreColor(avgDiscoveryScore)} height={4} />
                    </div>
                  </>
                )}
                {avgAuthenticity > 0 && (
                  <IntelRow label="Avg Authenticity" value={`${avgAuthenticity}/100`} />
                )}
                {hiddenGemCount > 0 && (
                  <IntelRow label="Hidden Gems" value={`${hiddenGemCount} ${hiddenGemCount === 1 ? 'role' : 'roles'}`} />
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Responsive collapse ─────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .company-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Local sub-components ─────────────────────────────────────────────────────

function IntelRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px dashed var(--border-hairline)',
      paddingBottom: '0.5rem',
      marginBottom: '0.5rem',
      gap: 8,
    }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{label}</span>
      <span style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.8125rem', color: 'var(--text-primary)', textAlign: 'right' }}>
        {value.toLowerCase()}
      </span>
    </div>
  );
}

function IntelPill({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      padding: '8px 12px',
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-md)',
      minWidth: 80,
    }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
        {label}
      </span>
      <StatusBadge status={value} variant={variant} />
    </div>
  );
}
