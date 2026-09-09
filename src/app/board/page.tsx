import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { getActiveRun } from '@/lib/pipeline/active-run';
import { toUICategory } from '@/lib/candidate-decision/mapping';
import { safeJobAge } from '@/lib/utils/safe-number';
import { eq, desc, inArray, and } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decision Board — JobSight',
  description: 'Your personal Kanban board for managing active job opportunities.',
};

function getAgeInDays(dateString: string) {
  const diffTime = Math.abs(Date.now() - new Date(dateString).getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const COLUMNS = [
  { key: 'Apply Now', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>, color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
  { key: 'Apply This Week', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, color: 'var(--warning-text)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
  { key: 'Monitor', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, color: 'var(--info)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
  { key: 'Research', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  { key: 'Rejected', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
];

export default async function DecisionBoardPage() {
  const latestRun = await getActiveRun();

  if (!latestRun) {
    return <div style={{ padding: '2rem' }}><EmptyState title="No active runs" description="Start a hunt to see your board." icon="📋" /></div>;
  }

  const jobsData = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.canonicalTitle,
      companyId: schema.jobs.companyId,
      company: schema.companies.displayName,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      firstSeenAt: schema.jobs.firstSeenAt,
      decision: schema.decisions.decision,
      finalDecision: schema.candidateDecisions.finalDecision,
      opportunityQuality: schema.marketIntelligence.opportunityIntelligence,
      competition: schema.marketIntelligence.competitionLevel,
      sourceType: schema.jobSources.sourceType
    })
    .from(schema.jobObservations)
    .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
    .where(eq(schema.jobObservations.runId, latestRun.id))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .leftJoin(schema.decisions, and(eq(schema.jobs.id, schema.decisions.jobId), eq(schema.decisions.runId, latestRun.id)))
    .leftJoin(schema.candidateDecisions, and(eq(schema.jobs.id, schema.candidateDecisions.jobId), eq(schema.candidateDecisions.runId, latestRun.id)))
    .leftJoin(schema.marketIntelligence, and(eq(schema.jobs.id, schema.marketIntelligence.jobId), eq(schema.marketIntelligence.runId, latestRun.id)))
    .leftJoin(schema.jobSources, eq(schema.jobs.id, schema.jobSources.jobId))
    .orderBy(desc(schema.jobs.firstSeenAt));

  const uniqueJobsMap = new Map();
  jobsData.forEach(job => { if (!uniqueJobsMap.has(job.id)) uniqueJobsMap.set(job.id, job); });
  const uniqueJobs = Array.from(uniqueJobsMap.values());
  const jobIds = uniqueJobs.map(j => j.id);
  const companyIds = [...new Set(uniqueJobs.map(j => j.companyId).filter((id): id is string => !!id))];

  function chunk<T>(arr: T[], size = 100): T[][] { const out: T[][] = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; }
  function latestByKey<T extends { createdAt: string }>(rows: T[], keyOf: (row: T) => string): Map<string, T> {
    const out = new Map<string, T>();
    for (const row of rows) { const key = keyOf(row); const existing = out.get(key); if (!existing || row.createdAt > existing.createdAt) out.set(key, row); }
    return out;
  }

  const competitionRows: (typeof schema.competitionResults.$inferSelect)[] = [];
  const applicationRows: (typeof schema.applicationResults.$inferSelect)[] = [];
  const decisionResultRows: (typeof schema.decisionResults.$inferSelect)[] = [];
  for (const idChunk of chunk(jobIds)) {
    if (idChunk.length === 0) continue;
    competitionRows.push(...await db.select().from(schema.competitionResults).where(and(inArray(schema.competitionResults.jobId, idChunk), eq(schema.competitionResults.runId, latestRun.id))));
    applicationRows.push(...await db.select().from(schema.applicationResults).where(and(inArray(schema.applicationResults.jobId, idChunk), eq(schema.applicationResults.runId, latestRun.id))));
    decisionResultRows.push(...await db.select().from(schema.decisionResults).where(and(inArray(schema.decisionResults.jobId, idChunk), eq(schema.decisionResults.runId, latestRun.id))));
  }
  const companyOpportunityRows: (typeof schema.companyOpportunity.$inferSelect)[] = [];
  for (const idChunk of chunk(companyIds)) {
    if (idChunk.length === 0) continue;
    companyOpportunityRows.push(...await db.select().from(schema.companyOpportunity).where(and(inArray(schema.companyOpportunity.companyId, idChunk), eq(schema.companyOpportunity.runId, latestRun.id))));
  }

  const competitionByJobId = latestByKey(competitionRows, r => r.jobId);
  const applicationByJobId = latestByKey(applicationRows, r => r.jobId);
  const decisionConfidenceByJobId = latestByKey(decisionResultRows, r => r.jobId);
  const companyOpportunityByCompanyId = latestByKey(companyOpportunityRows, r => r.companyId);

  // Bucket jobs using the AUTHORITATIVE mapping (shared with Dashboard counts).
  // toUICategory handles null/undefined finalDecision → 'Monitor'.
  const buckets: Record<string, typeof uniqueJobs> = {
    'Apply Now': [],
    'Apply This Week': [],
    'Monitor': [],
    'Research': [],
    'Rejected': [],
  };
  for (const j of uniqueJobs) {
    const category = toUICategory(j.finalDecision);
    (buckets[category] ??= []).push(j);
  }

  const totalActive = (buckets['Apply Now']?.length ?? 0) + (buckets['Apply This Week']?.length ?? 0) + (buckets['Monitor']?.length ?? 0);

  return (
    <div className="decision-board" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', margin: '-28px -32px', padding: '28px 32px' }}>
      <div className="decision-board-header" style={{ marginBottom: 24, flexShrink: 0 }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Decision Board' }]} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>Decision Board</h1>
            <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{totalActive} active opportunities <span style={{ color: 'var(--text-muted)' }}>— track your pipeline</span></p>
          </div>
          <Link href="/jobs" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Browse Jobs
          </Link>
        </div>
      </div>

      <div className="decision-board-columns" style={{ display: 'flex', gap: 14, overflowX: 'auto', flex: 1, paddingBottom: 12, alignItems: 'flex-start', scrollbarWidth: 'thin' }}>
        {COLUMNS.map(col => {
          const jobs = buckets[col.key] || [];
          return (
            <div key={col.key} role="region" aria-label={`${col.key} column`} className="decision-board-column" style={{ minWidth: 300, width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxHeight: '100%' }}>
              <div className="decision-board-column-header" style={{ padding: '13px 15px', borderBottom: `1px solid ${col.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--bg-elevated)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: col.color, display: 'flex', alignItems: 'center' }}>{col.icon}</span><h2 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>{col.key}</h2></div>
                <span style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'center' }}>{jobs.length}</span>
              </div>

              <div className="decision-board-column-list" style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: 8, scrollbarWidth: 'thin' }}>
                {jobs.length === 0 ? (
                  <div className="decision-board-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', textAlign: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', border: '1px dashed var(--border-default)', borderRadius: '50%', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>—</div>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No jobs here yet</p>
                  </div>
                ) : (
                  jobs.map(job => {
                    const competitionResult = competitionByJobId.get(job.id);
                    const applicationResult = applicationByJobId.get(job.id);
                    const decisionResult = decisionConfidenceByJobId.get(job.id);
                    const companyOpportunityResult = job.companyId ? companyOpportunityByCompanyId.get(job.companyId) : undefined;
                    return (
                      <JobCard
                        key={job.id}
                        id={job.id}
                        title={job.title || 'Unknown Role'}
                        company={job.company || 'Unknown Company'}
                        salaryMin={job.salaryMin ?? undefined}
                        salaryMax={job.salaryMax ?? undefined}
                        remote={job.remoteType === 'REMOTE' || job.remoteType === 'FULLY_REMOTE'}
                        opportunityQuality={job.opportunityQuality ?? undefined}
                        competition={competitionResult?.level ?? job.competition ?? undefined}
                        readiness={applicationResult?.readinessLevel}
                        companyOpportunity={companyOpportunityResult?.level}
                        confidence={decisionResult?.confidence ?? undefined}
                        age={safeJobAge(job.firstSeenAt) || undefined}
                        decision={job.decision ?? undefined}
                        hideDecisionBadge
                        className="board-card"
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
