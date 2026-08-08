import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Metadata } from 'next';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [val];
    }
  }
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const jobRec = await db.select({ title: schema.jobs.canonicalTitle }).from(schema.jobs).where(eq(schema.jobs.id, id)).limit(1);
  const title = jobRec[0]?.title ?? 'Job Details';
  return {
    title: `${title} — JobSight`,
    description: 'Full intelligence breakdown for this job opportunity.',
  };
}

// ─── Score colour helpers (from existing design tokens) ──────────────────────

function readinessVariant(level: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!level) return 'neutral';
  if (level === 'Ready Now') return 'success';
  if (level === 'Almost Ready') return 'info';
  if (level === 'Needs Improvement') return 'warning';
  if (level === 'Not Recommended') return 'danger';
  return 'neutral';
}

function competitionVariant(level: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (!level) return 'neutral';
  const l = level.toLowerCase();
  if (l.includes('very low') || l.includes('low')) return 'success';
  if (l.includes('medium')) return 'warning';
  if (l.includes('high')) return 'danger';
  return 'neutral';
}

function companyOutlookVariant(level: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (!level) return 'neutral';
  const l = level.toLowerCase();
  if (l.includes('excellent') || l.includes('strong')) return 'success';
  if (l.includes('good')) return 'info';
  if (l.includes('average')) return 'warning';
  if (l.includes('weak')) return 'danger';
  return 'neutral';
}

function discoveryVariant(level: string | null | undefined): 'success' | 'warning' | 'info' | 'neutral' {
  if (!level) return 'neutral';
  const l = level.toLowerCase();
  if (l.includes('exceptional') || l.includes('excellent')) return 'success';
  if (l.includes('strong')) return 'info';
  if (l.includes('standard')) return 'warning';
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

function scoreProgressColor(score: number): string {
  if (score >= 75) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ── Core job record ─────────────────────────────────────────────────────────
  const jobRec = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).limit(1);
  const job = jobRec[0];

  if (!job) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
        <EmptyState
          title="Job Not Found"
          description="The job you are looking for does not exist or has been removed."
          icon="❓"
          action={<Link href="/jobs"><ActionButton variant="primary">Back to Jobs</ActionButton></Link>}
        />
      </div>
    );
  }

  // ── Company ─────────────────────────────────────────────────────────────────
  const companyRec = job.companyId
    ? await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1)
    : [];
  const companyName = companyRec[0]?.displayName || 'Unknown Company';

  // ── Decisions ───────────────────────────────────────────────────────────────
  const decisionRec = await db.select().from(schema.decisions).where(eq(schema.decisions.jobId, job.id)).limit(1);
  const decision = decisionRec[0];

  const decisionResultRec = await db.select().from(schema.decisionResults).where(eq(schema.decisionResults.jobId, job.id)).limit(1);
  const decisionResult = decisionResultRec[0];

  // ── Job analysis ─────────────────────────────────────────────────────────────
  const analysisRec = await db.select().from(schema.jobAnalysis).where(eq(schema.jobAnalysis.jobId, job.id)).limit(1);
  const jobAnalysis = analysisRec[0];

  // ── Company analysis (basic) ────────────────────────────────────────────────
  const compAnalysisRec = job.companyId
    ? await db.select().from(schema.companyAnalysis).where(eq(schema.companyAnalysis.companyId, job.companyId)).limit(1)
    : [];
  const compAnalysis = compAnalysisRec[0];

  // ── Discovery intelligence (basic) ──────────────────────────────────────────
  const discIntelRec = await db.select().from(schema.discoveryIntelligence).where(eq(schema.discoveryIntelligence.jobId, job.id)).limit(1);
  const discoveryIntel = discIntelRec[0];

  // ── Evidence & scores ────────────────────────────────────────────────────────
  const evidenceList = await db.select().from(schema.evidence).where(eq(schema.evidence.entityId, job.id));
  const scoresList = await db.select().from(schema.scores).where(eq(schema.scores.jobId, job.id));

  const getScore = (type: string) => scoresList.find(s => s.scoreType === type)?.scoreValue;
  const scores = {
    opportunity: getScore('OPPORTUNITY') || getScore('OPPORTUNITY_V2'),
    resumeMatch: getScore('RESUME_MATCH'),
    reqMatch:    getScore('REQUIREMENT_MATCH'),
    companyScore: getScore('COMPANY_SCORE'),
    momentum:    getScore('HIRING_MOMENTUM'),
  };

  const requiredSkillsEvidence  = evidenceList.filter(e => e.field === 'requiredSkills' || e.field === 'skills');
  const preferredSkillsEvidence = evidenceList.filter(e => e.field === 'preferredSkills');
  const salaryEvidence          = evidenceList.filter(e => e.field.toLowerCase().includes('salary'));

  // ── APPLICATION INTELLIGENCE (B5) ───────────────────────────────────────────
  const appResultRec = await db.select().from(schema.applicationResults).where(eq(schema.applicationResults.jobId, job.id)).limit(1);
  const appResult = appResultRec[0] ?? null;

  const appSummaryRec = await db.select().from(schema.applicationSummary).where(eq(schema.applicationSummary.jobId, job.id)).limit(1);
  const appSummary = appSummaryRec[0] ?? null;

  const appRecommendationRec = await db.select().from(schema.applicationRecommendations).where(eq(schema.applicationRecommendations.jobId, job.id)).limit(1);
  const appRecommendation = appRecommendationRec[0] ?? null;

  // ── COMPETITION INTELLIGENCE (B2) ───────────────────────────────────────────
  const compResultRec = await db.select().from(schema.competitionResults).where(eq(schema.competitionResults.jobId, job.id)).limit(1);
  const compResult = compResultRec[0] ?? null;

  const compSummaryRec = await db.select().from(schema.competitionSummary).where(eq(schema.competitionSummary.jobId, job.id)).limit(1);
  const compSummaryData = compSummaryRec[0] ?? null;

  // ── COMPANY OPPORTUNITY INTELLIGENCE (B3) ───────────────────────────────────
  const coOpportunityRec = job.companyId
    ? await db.select().from(schema.companyOpportunity).where(eq(schema.companyOpportunity.companyId, job.companyId)).limit(1)
    : [];
  const coOpportunity = coOpportunityRec[0] ?? null;

  const coSummaryRec = job.companyId
    ? await db.select().from(schema.companySummary).where(eq(schema.companySummary.companyId, job.companyId)).limit(1)
    : [];
  const coSummary = coSummaryRec[0] ?? null;

  const coOutlookRec = job.companyId
    ? await db.select().from(schema.companyOutlook).where(eq(schema.companyOutlook.companyId, job.companyId)).limit(1)
    : [];
  const coOutlook = coOutlookRec[0] ?? null;

  // ── DISCOVERY INTELLIGENCE (B4) ─────────────────────────────────────────────
  const oppDiscResultRec = await db.select().from(schema.oppDiscoveryResults).where(eq(schema.oppDiscoveryResults.jobId, job.id)).limit(1);
  const oppDiscResult = oppDiscResultRec[0] ?? null;

  const oppDiscSummaryRec = await db.select().from(schema.oppDiscoverySummary).where(eq(schema.oppDiscoverySummary.jobId, job.id)).limit(1);
  const oppDiscSummary = oppDiscSummaryRec[0] ?? null;

  // ── Derived helpers ──────────────────────────────────────────────────────────
  const formatSalary = (min: number | null, max: number | null, curr: string | null, period: string | null) => {
    if (!min && !max) return null;
    const currency = curr || '$';
    const p = period ? `/${period.toLowerCase()}` : '';
    if (min && max) return `${currency}${min.toLocaleString()} – ${currency}${max.toLocaleString()}${p}`;
    if (min) return `${currency}${min.toLocaleString()}+${p}`;
    if (max) return `Up to ${currency}${max.toLocaleString()}${p}`;
    return null;
  };

  const normalizedSalary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const originalSalary   = job.salaryTextOriginal || formatSalary(job.salaryMinOriginal, job.salaryMaxOriginal, job.salaryCurrencyOriginal, job.salaryPeriodOriginal);

  const formatDecisionText = (dec?: string | null) => dec?.replace(/_/g, ' ') || 'PENDING';
  const decisionVal = decisionResult?.decision || decision?.decision || 'PENDING';

  const title = job.canonicalTitle || job.normalizedTitle || 'Unknown Role';

  // ── Shared inline style tokens (matching existing page) ──────────────────────
  const titleStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '1.0625rem', fontWeight: 600, color: 'var(--text-primary)',
    margin: '0 0 1.25rem 0', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-hairline)',
  };
  const listStyle: React.CSSProperties = {
    margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 0', borderBottom: '1px solid var(--border-hairline)',
  };

  // ── SVG icons (kept inline, matching existing pattern) ────────────────────────
  const IconOverview = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
  const IconSalary   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
  const IconBrain    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>;
  const IconCheck    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
  const IconTarget   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
  const IconShield   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  const IconBuilding = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  const IconStar     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  const IconZap      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
  const IconFile     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', animation: 'fadeIn 0.35s ease-out' }}>

      {/* ── Breadcrumbs ─────────────────────────────────────────────────────── */}
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Jobs', href: '/jobs' },
        { label: title },
      ]} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, marginTop: 20, gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              {title}
            </h1>
            <Link href={`/jobs?decision=${decisionVal}`} style={{ textDecoration: 'none' }}>
              <StatusBadge
                status={formatDecisionText(decisionVal)}
                variant={decisionVariant(decisionVal)}
              />
            </Link>
            {discoveryIntel?.hiddenGem && (
              <StatusBadge status="Hidden Gem" variant="info" aria-label="This is a hidden gem opportunity" />
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {job.companyId
              ? <Link href={`/jobs?company=${companyName}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{companyName}</Link>
              : companyName}
            {job.location && <><span style={{ opacity: 0.4 }}>·</span>{job.location}</>}
            {job.remoteType && (
              <><span style={{ opacity: 0.4 }}>·</span>
              <Link href={`/jobs?remote=${job.remoteType}`} style={{ textDecoration: 'none' }}>
                <StatusBadge status={job.remoteType} variant="info" />
              </Link></>
            )}
          </p>
        </div>
        <Link href="/jobs" className="btn" style={{ flexShrink: 0 }}>
          ← Back to Jobs
        </Link>
      </div>

      {/* ── Intelligence Summary Strip ───────────────────────────────────────── */}
      {/* Compact at-a-glance aggregation of existing intelligence outputs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 32,
          padding: '14px 18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          alignItems: 'center',
        }}
        role="region"
        aria-label="Intelligence summary"
      >
        {/* Decision */}
        <SummaryPill
          label="Decision"
          value={formatDecisionText(decisionVal)}
          variant={decisionVariant(decisionVal)}
        />

        {/* Application Readiness */}
        <SummaryPill
          label="Readiness"
          value={appResult?.readinessLevel ?? 'Unknown'}
          variant={appResult ? readinessVariant(appResult.readinessLevel) : 'neutral'}
          score={appResult?.score ?? null}
        />

        {/* Competition */}
        <SummaryPill
          label="Competition"
          value={compResult?.level ?? discoveryIntel?.competition ?? 'Unknown'}
          variant={compResult
            ? competitionVariant(compResult.level)
            : discoveryIntel?.competition
              ? (discoveryIntel.competition === 'LOW' ? 'success' : discoveryIntel.competition === 'HIGH' ? 'danger' : 'warning')
              : 'neutral'}
        />

        {/* Company */}
        <SummaryPill
          label="Company"
          value={coSummary?.hiringTrend ?? coOutlook?.trend ?? compAnalysis?.hiringMomentum ?? 'Unknown'}
          variant={coSummary
            ? (coSummary.hiringTrend === 'Growing' ? 'success' : coSummary.hiringTrend === 'Slowing' ? 'warning' : 'neutral')
            : 'neutral'}
        />

        {/* Discovery Quality */}
        <SummaryPill
          label="Discovery"
          value={oppDiscResult?.level ?? (discoveryIntel?.hiddenGem ? 'Hidden Gem' : 'Standard')}
          variant={discoveryVariant(oppDiscResult?.level ?? (discoveryIntel?.hiddenGem ? 'Exceptional' : null))}
        />

        {/* Confidence */}
        {(appResult?.confidence || decisionResult?.confidence) && (
          <SummaryPill
            label="Confidence"
            value={`${appResult?.confidence ?? decisionResult?.confidence}%`}
            variant="neutral"
          />
        )}
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div
        className="job-detail-grid"
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}
      >

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* LEFT COLUMN                                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Overview ──────────────────────────────────────────────────── */}
          <Card>
            <h2 style={titleStyle}><IconOverview/> Overview</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <OverviewField label="Employment Type" value={job.employmentType || 'Not specified'} />
              <OverviewField
                label="Experience Required"
                value={
                  job.experienceMin !== null && job.experienceMax !== null ? `${job.experienceMin} – ${job.experienceMax} years` :
                  job.experienceMin !== null ? `${job.experienceMin}+ years` :
                  job.experienceMax !== null ? `Up to ${job.experienceMax} years` : 'Not specified'
                }
              />
              <OverviewField label="Candidate Eligibility" value={job.candidateRemoteEligibility?.replace(/_/g, ' ') || 'Unknown'} />
              <OverviewField label="First Seen" value={new Date(job.firstSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
            </div>
          </Card>

          {/* ── Salary Intelligence ───────────────────────────────────────── */}
          <Card>
            <h2 style={titleStyle}><IconSalary/> Salary Intelligence</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '1.5rem' }}>
              {normalizedSalary ? (
                <div style={{ flex: 1, minWidth: '250px', padding: '1rem', backgroundColor: 'var(--accent-glow)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>Target Compensation</div>
                  <Link href={`/jobs?salary=${job.salaryMin}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{normalizedSalary}</div>
                  </Link>
                </div>
              ) : (
                <div style={{ flex: 1, padding: '1rem', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                  No standardized salary data available.
                </div>
              )}

              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>Original Posting Data</div>
                <div style={{ fontWeight: 500, padding: '1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)' }}>
                  {originalSalary || 'Not disclosed in original posting.'}
                </div>
              </div>
            </div>
            {salaryEvidence.length > 0 && (
              <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Evidence:</strong>
                <ul style={{ ...listStyle, marginTop: '0.5rem' }}>
                  {salaryEvidence.map((e, i) => (
                    <li key={i}>"{e.evidenceExcerpt}" <span style={{ opacity: 0.6 }}>({e.evidenceType}, Confidence: {e.confidence}%)</span></li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* ── Hiring Criteria & Analysis (existing) ─────────────────────── */}
          {jobAnalysis && (
            <Card>
              <h2 style={titleStyle}><IconBrain/> Hiring Criteria &amp; Analysis</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div><strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>Experience Flexibility:</strong> {jobAnalysis.experienceFlexibility || 'Unknown'}</div>
                <div><strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>Seniority Assessment:</strong> {jobAnalysis.seniorityAssessment || 'Unknown'}</div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>Requirement Difficulty:</strong>
                  {jobAnalysis.requirementDifficulty || 'Unknown'}
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>Competition Estimate:</strong>
                  <Link href={`/jobs?competition=${jobAnalysis.competitionEstimate}`} style={{ textDecoration: 'none' }}>
                    <StatusBadge
                      status={jobAnalysis.competitionEstimate || 'Unknown'}
                      variant={jobAnalysis.competitionEstimate === 'HIGH' ? 'warning' : 'neutral'}
                    />
                  </Link>
                </div>
              </div>
              {jobAnalysis.analysisReasoning && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)' }}>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontSize: '0.8125rem' }}>Reasoning:</strong>
                  <p style={{ margin: 0, lineHeight: 1.6, fontSize: '0.875rem' }}>{jobAnalysis.analysisReasoning}</p>
                </div>
              )}
            </Card>
          )}

          {/* ── Skills ────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <Card>
              <h2 style={titleStyle}><IconTarget/> Required Skills</h2>
              {requiredSkillsEvidence.length > 0 ? (
                <ul style={listStyle}>
                  {requiredSkillsEvidence.map((e, i) => <li key={i}>{e.valueRepresentation || e.evidenceExcerpt}</li>)}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>No explicit required skills extracted.</div>
              )}
            </Card>

            <Card>
              <h2 style={titleStyle}><IconCheck/> Preferred Skills</h2>
              {preferredSkillsEvidence.length > 0 ? (
                <ul style={listStyle}>
                  {preferredSkillsEvidence.map((e, i) => <li key={i}>{e.valueRepresentation || e.evidenceExcerpt}</li>)}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>No preferred skills extracted.</div>
              )}
            </Card>
          </div>

          {/* ── APPLICATION INTELLIGENCE (B5) — NEW ─────────────────────── */}
          <Card>
            <h2 style={titleStyle}><IconFile/> Application Readiness</h2>
            {appResult ? (
              <>
                {/* Readiness header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge
                      status={appResult.readinessLevel}
                      variant={readinessVariant(appResult.readinessLevel)}
                    />
                    {appRecommendation?.recommendation && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        → {appRecommendation.recommendation}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                      {appResult.score}<span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 20 }}>
                  <ProgressBar
                    progress={appResult.score}
                    color={scoreProgressColor(appResult.score)}
                    height={6}
                  />
                </div>

                {/* Strengths / Weaknesses */}
                {appSummary && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
                    {parseJsonArray(appSummary.strengths).length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--success-text)', marginBottom: 8 }}>
                          Strengths
                        </div>
                        <ul style={{ ...listStyle, gap: '0.4rem' }}>
                          {parseJsonArray(appSummary.strengths).map((s, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, listStyle: 'none' }}>
                              <span style={{ color: 'var(--success-text)', flexShrink: 0, marginTop: 2 }}>✓</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parseJsonArray(appSummary.weaknesses).length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warning-text)', marginBottom: 8 }}>
                          Weaknesses
                        </div>
                        <ul style={{ ...listStyle, gap: '0.4rem' }}>
                          {parseJsonArray(appSummary.weaknesses).map((w, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, listStyle: 'none' }}>
                              <span style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: 2 }}>!</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Skills */}
                {appSummary && parseJsonArray(appSummary.missingSkills).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Missing Skills
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {parseJsonArray(appSummary.missingSkills).map((skill, i) => (
                        <span key={i} style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '3px 10px',
                          background: 'var(--danger-bg)',
                          color: 'var(--danger-text)',
                          border: '1px solid var(--danger-border)',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Factors */}
                {appSummary && parseJsonArray(appSummary.riskFactors).length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--danger-text)', marginBottom: 8 }}>
                      Risk Factors
                    </div>
                    <ul style={{ ...listStyle, gap: '0.4rem' }}>
                      {parseJsonArray(appSummary.riskFactors).map((r, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, listStyle: 'none' }}>
                          <span style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 2 }}>⚠</span>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Confidence */}
                {appResult.confidence > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-hairline)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Analysis confidence</span>
                    <StatusBadge status={`${appResult.confidence}%`} variant="neutral" />
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8, opacity: 0.4 }} aria-hidden="true">📄</div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Application intelligence not yet analyzed for this job.
                </p>
              </div>
            )}
          </Card>

          {/* ── Original Job Posting ─────────────────────────────────────── */}
          <Card>
            <h2 style={titleStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>{' '}
              Original Job Posting
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              {job.canonicalUrl ? (
                <a
                  href={job.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
                >
                  View Original Posting{' '}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>Original URL not available.</span>
              )}
            </div>
            {job.description && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '1rem', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {job.description}
              </div>
            )}
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* RIGHT COLUMN                                                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Decision & Action ─────────────────────────────────────────── */}
          <Card style={{
            borderTop: `3px solid ${
              decisionVal === 'APPLY' ? 'var(--success)' :
              decisionVal === 'SKIP'  ? 'var(--danger)'  :
              decisionVal === 'CONSIDER' ? 'var(--warning)' :
              'var(--accent)'
            }`,
          }}>
            <h2 style={titleStyle}>Decision &amp; Action</h2>

            {/* Decision badge prominent */}
            <div style={{ marginBottom: 16 }}>
              <StatusBadge
                status={formatDecisionText(decisionVal)}
                variant={decisionVariant(decisionVal)}
              />
              {decisionResult?.priority && (
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Priority: {decisionResult.priority}
                </span>
              )}
            </div>

            {decisionResult?.urgencyLevel && (
              <div style={rowStyle}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Urgency:</span>
                <strong style={{ fontSize: '0.875rem' }}>{decisionResult.urgencyLevel}</strong>
              </div>
            )}

            {decisionResult?.roiLevel && (
              <div style={rowStyle}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>ROI Level:</span>
                <strong style={{ fontSize: '0.875rem' }}>{decisionResult.roiLevel}</strong>
              </div>
            )}

            {decisionResult?.confidence && (
              <div style={{ ...rowStyle, borderBottom: 'none', marginBottom: 12 }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Confidence:</span>
                <strong style={{ fontSize: '0.875rem' }}>{decisionResult.confidence}%</strong>
              </div>
            )}

            {/* Positive Signals */}
            {parseJsonArray(decisionResult?.reasons || decision?.reasons).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', fontWeight: 700 }}>
                  Positive Signals
                </div>
                <ul style={{ ...listStyle, gap: '0.35rem' }}>
                  {parseJsonArray(decisionResult?.reasons || decision?.reasons).map((r, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, listStyle: 'none' }}>
                      <span style={{ color: 'var(--success-text)', flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span style={{ fontSize: '0.875rem' }}>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks & Unknowns */}
            {parseJsonArray(decisionResult?.unknowns || decision?.unknowns).length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--warning-text)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', fontWeight: 700 }}>
                  Risks &amp; Unknowns
                </div>
                <ul style={{ ...listStyle, gap: '0.35rem' }}>
                  {parseJsonArray(decisionResult?.unknowns || decision?.unknowns).map((u, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, listStyle: 'none' }}>
                      <span style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: 1 }}>!</span>
                      <span style={{ fontSize: '0.875rem' }}>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Apply CTA */}
            {job.canonicalUrl && (decisionVal === 'APPLY' || decisionVal === 'APPLY_NOW') && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
                <a
                  href={job.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ display: 'flex', justifyContent: 'center', gap: 6, width: '100%' }}
                  aria-label={`Apply for ${title} at ${companyName}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Apply Now
                </a>
              </div>
            )}
          </Card>

          {/* ── Application Checklist (existing) ─────────────────────────── */}
          {parseJsonArray(decisionResult?.requiredActions).length > 0 && (
            <Card>
              <h2 style={titleStyle}>Application Checklist</h2>
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {parseJsonArray(decisionResult?.requiredActions).map((action, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-hairline)' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid var(--border-default)', marginTop: '2px', flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ fontSize: '0.9375rem', lineHeight: 1.4 }}>{action}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ── Qualification Scores (existing) ──────────────────────────── */}
          <Card>
            <h2 style={titleStyle}><IconTarget/> Qualification</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Resume Match:</span>
                <strong style={{ fontSize: '1rem' }}>{scores.resumeMatch ?? '—'}</strong>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Requirement Match:</span>
                <strong style={{ fontSize: '1rem' }}>{scores.reqMatch ?? '—'}</strong>
              </div>
              <div style={{ ...rowStyle, borderBottom: 'none' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Opportunity Score:</span>
                <Link href={scores.opportunity ? `/jobs?oppScore=${scores.opportunity}` : '#'} style={{ textDecoration: 'none' }}>
                  <strong style={{ fontSize: '1rem', color: 'var(--accent)' }}>{scores.opportunity ?? '—'}</strong>
                </Link>
              </div>
            </div>
          </Card>

          {/* ── COMPETITION INTELLIGENCE (B2) — ENHANCED ─────────────────── */}
          <Card>
            <h2 style={titleStyle}><IconShield/> Competition</h2>

            {compResult ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <StatusBadge
                    status={compResult.level}
                    variant={competitionVariant(compResult.level)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                      {compResult.score}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                    </span>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <ProgressBar
                    progress={compResult.score}
                    color={compResult.score < 40 ? 'var(--success)' : compResult.score < 70 ? 'var(--warning)' : 'var(--danger)'}
                    height={5}
                  />
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Low competition</span><span>High competition</span>
                  </div>
                </div>
                {compSummaryData && parseJsonArray(compSummaryData.reasons).length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Signals
                    </div>
                    <ul style={{ ...listStyle, gap: '0.35rem' }}>
                      {parseJsonArray(compSummaryData.reasons).map((r, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, listStyle: 'none' }}>
                          <span style={{ color: 'var(--success-text)', flexShrink: 0, marginTop: 1 }}>✓</span>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {compResult.confidence > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confidence</span>
                    <StatusBadge status={`${compResult.confidence}%`} variant="neutral" />
                  </div>
                )}
              </>
            ) : (
              /* Fall back to basic jobAnalysis estimate */
              jobAnalysis?.competitionEstimate ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={rowStyle}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Estimate:</span>
                    <Link href={`/jobs?competition=${jobAnalysis.competitionEstimate}`} style={{ textDecoration: 'none' }}>
                      <StatusBadge
                        status={jobAnalysis.competitionEstimate}
                        variant={jobAnalysis.competitionEstimate === 'HIGH' ? 'warning' : 'neutral'}
                      />
                    </Link>
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Deep competition analysis not yet run.</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Competition data unavailable.</div>
              )
            )}
          </Card>

          {/* ── COMPANY OPPORTUNITY INTELLIGENCE (B3) — ENHANCED ─────────── */}
          <Card>
            <h2 style={titleStyle}><IconBuilding/> Company Opportunity</h2>

            {coOpportunity ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <StatusBadge
                    status={coOpportunity.level}
                    variant={companyOutlookVariant(coOpportunity.level)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                      {coOpportunity.score}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                    </span>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <ProgressBar
                    progress={coOpportunity.score}
                    color={scoreProgressColor(coOpportunity.score)}
                    height={5}
                  />
                </div>
                {/* Company summary rows */}
                {coSummary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Hiring Trend:</span>
                      <StatusBadge
                        status={coSummary.hiringTrend}
                        variant={coSummary.hiringTrend === 'Growing' ? 'success' : coSummary.hiringTrend === 'Slowing' ? 'warning' : 'neutral'}
                      />
                    </div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Remote Hiring:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{coSummary.remoteHiring}</strong>
                    </div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Eng. Hiring:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{coSummary.engineeringHiring}</strong>
                    </div>
                    <div style={{ ...rowStyle, borderBottom: 'none' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Confidence:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{coSummary.confidence}%</strong>
                    </div>
                  </div>
                )}
                {coOutlook && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-hairline)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={`Trend: ${coOutlook.trend}`} variant={coOutlook.trend === 'Growing' ? 'success' : coOutlook.trend === 'Slowing' ? 'warning' : 'neutral'} />
                    <StatusBadge status={`Stability: ${coOutlook.stability}`} variant={coOutlook.stability === 'High' ? 'success' : coOutlook.stability === 'Low' ? 'danger' : 'warning'} />
                  </div>
                )}
              </>
            ) : compAnalysis ? (
              /* Fall back to basic companyAnalysis */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {scores.companyScore !== undefined && (
                  <div style={rowStyle}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Company Score:</span>
                    <strong style={{ fontSize: '0.875rem' }}>{scores.companyScore}</strong>
                  </div>
                )}
                <div style={rowStyle}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Hiring Momentum:</span>
                  <strong style={{ fontSize: '0.875rem' }}>{compAnalysis.hiringMomentum || '—'}</strong>
                </div>
                <div style={rowStyle}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Remote Friendliness:</span>
                  <strong style={{ fontSize: '0.875rem' }}>{compAnalysis.remoteFriendliness || '—'}</strong>
                </div>
                <div style={rowStyle}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Growth Signal:</span>
                  <strong style={{ fontSize: '0.875rem' }}>{compAnalysis.growthSignal || '—'}</strong>
                </div>
                {compAnalysis.layoffSignal && compAnalysis.layoffSignal !== 'NONE' && (
                  <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--danger-text)' }}>Layoff Signal:</span>
                    <strong style={{ fontSize: '0.875rem', color: 'var(--danger-text)' }}>{compAnalysis.layoffSignal}</strong>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Deep company opportunity analysis not yet run.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Company opportunity data unavailable.</div>
            )}
          </Card>

          {/* ── DISCOVERY INTELLIGENCE (B4) — ENHANCED ───────────────────── */}
          <Card>
            <h2 style={titleStyle}><IconStar/> Discovery Quality</h2>

            {oppDiscResult ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <StatusBadge
                    status={oppDiscResult.level}
                    variant={discoveryVariant(oppDiscResult.level)}
                  />
                  {discoveryIntel?.hiddenGem && (
                    <StatusBadge status="💎 Hidden Gem" variant="info" />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                      {oppDiscResult.score}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
                    </span>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <ProgressBar
                    progress={oppDiscResult.score}
                    color={scoreProgressColor(oppDiscResult.score)}
                    height={5}
                  />
                </div>
                {oppDiscSummary && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Quality:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{oppDiscSummary.quality}</strong>
                    </div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Visibility:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{oppDiscSummary.visibility}</strong>
                    </div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Authenticity:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{oppDiscSummary.authenticity}</strong>
                    </div>
                    <div style={rowStyle}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Uniqueness:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{oppDiscSummary.uniqueness}</strong>
                    </div>
                    <div style={{ ...rowStyle, borderBottom: 'none' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Confidence:</span>
                      <strong style={{ fontSize: '0.875rem' }}>{oppDiscSummary.confidence}%</strong>
                    </div>
                  </div>
                )}
                {oppDiscResult.confidence > 0 && !oppDiscSummary && (
                  <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    Confidence: {oppDiscResult.confidence}%
                  </div>
                )}
              </>
            ) : discoveryIntel ? (
              /* Fall back to basic discoveryIntelligence */
              <>
                {discoveryIntel.hiddenGem && (
                  <div style={{ marginBottom: 12 }}>
                    <StatusBadge status="💎 Hidden Gem" variant="info" />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={rowStyle}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Visibility:</span>
                    <strong style={{ fontSize: '0.875rem' }}>{discoveryIntel.visibility || '—'}</strong>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Authenticity:</span>
                    <Link href={`/jobs?authenticity=${discoveryIntel.authenticity || 'ALL'}`} style={{ textDecoration: 'none' }}>
                      <strong style={{ fontSize: '0.875rem' }}>{discoveryIntel.authenticity || '—'}</strong>
                    </Link>
                  </div>
                  <div style={rowStyle}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Freshness:</span>
                    <strong style={{ fontSize: '0.875rem' }}>{discoveryIntel.freshness || '—'}</strong>
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Source Trust:</span>
                    <strong style={{ fontSize: '0.875rem' }}>{discoveryIntel.sourceTrust || '—'}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Deep discovery analysis not yet run.
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Discovery data unavailable.</div>
            )}
          </Card>

          {/* ── Company link ─────────────────────────────────────────────── */}
          {job.companyId && (
            <Link href={`/companies/${job.companyId}`} className="btn" style={{ display: 'flex', justifyContent: 'center', gap: 6, width: '100%' }}>
              <IconBuilding />
              View {companyName} Profile
            </Link>
          )}

        </div>
      </div>

      {/* ── Responsive styles injected inline ───────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .job-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Small pure display sub-components used only within this page ─────────────
// (Not exported — local to this file to avoid component proliferation)

function OverviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  variant,
  score,
}: {
  label: string;
  value: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  score?: number | null;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusBadge status={value} variant={variant} />
        {score != null && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {score}
          </span>
        )}
      </div>
    </div>
  );
}
