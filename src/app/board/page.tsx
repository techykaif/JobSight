import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { JobCard } from '@/components/ui/JobCard';
import { EmptyState } from '@/components/ui/EmptyState';

// Helper to calculate age in days
function getAgeInDays(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default async function DecisionBoardPage() {
  // Fetch data
  const jobsData = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.canonicalTitle,
      company: schema.companies.displayName,
      salaryMin: schema.jobs.salaryMin,
      salaryMax: schema.jobs.salaryMax,
      salaryCurrency: schema.jobs.salaryCurrency,
      remoteType: schema.jobs.remoteType,
      firstSeenAt: schema.jobs.firstSeenAt,
      decision: schema.decisions.decision,
      opportunityScore: schema.opportunityIntelligence.opportunityScore,
      competition: schema.discoveryIntelligence.competition,
      sourceType: schema.jobSources.sourceType,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .leftJoin(schema.decisions, eq(schema.jobs.id, schema.decisions.jobId))
    .leftJoin(schema.opportunityIntelligence, eq(schema.jobs.id, schema.opportunityIntelligence.jobId))
    .leftJoin(schema.discoveryIntelligence, eq(schema.jobs.id, schema.discoveryIntelligence.jobId))
    .leftJoin(schema.jobSources, eq(schema.jobs.id, schema.jobSources.jobId))
    .orderBy(desc(schema.jobs.firstSeenAt));

  // Map to distinct jobs (handling multiple sources/joins potentially causing duplicates by taking the first one)
  const uniqueJobsMap = new Map();
  jobsData.forEach(job => {
    if (!uniqueJobsMap.has(job.id)) {
      uniqueJobsMap.set(job.id, job);
    }
  });
  const uniqueJobs = Array.from(uniqueJobsMap.values());

  // Group by columns
  // Assuming decisions from db map to our columns, or we just map them based on heuristics if missing.
  // Example decisions: APPLY, CONSIDER, SKIP, RESEARCH_REQUIRED
  // Columns: Apply Now, Apply This Week, Monitor, Research, Rejected
  
  const columns = {
    'Apply Now': uniqueJobs.filter(j => j.decision === 'APPLY' || j.decision === 'APPLY_NOW'),
    'Apply This Week': uniqueJobs.filter(j => j.decision === 'CONSIDER' || j.decision === 'APPLY_LATER'),
    'Monitor': uniqueJobs.filter(j => j.decision === 'MONITOR' || (!j.decision && j.opportunityScore && j.opportunityScore > 70)),
    'Research': uniqueJobs.filter(j => j.decision === 'RESEARCH_REQUIRED' || (!j.decision && (!j.opportunityScore || j.opportunityScore <= 70))),
    'Rejected': uniqueJobs.filter(j => j.decision === 'SKIP' || j.decision === 'REJECTED'),
  };

  return (
    <div style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Decision Board' }]} />
        </div>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, var(--accent-color), #8a2be2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Decision Board
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Track and manage your active job opportunities.</p>
      </header>

      <div style={{ 
        display: 'flex', 
        gap: '1.5rem', 
        overflowX: 'auto', 
        flex: 1,
        paddingBottom: '1rem',
        alignItems: 'flex-start'
      }}>
        {Object.entries(columns).map(([colName, jobs]) => (
          <div key={colName} style={{
            minWidth: '350px',
            width: '350px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            maxHeight: '100%',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                {colName}
              </h2>
              <span style={{ 
                backgroundColor: 'var(--accent-color-transparent, rgba(138, 43, 226, 0.1))', 
                color: 'var(--accent-color)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                {jobs.length}
              </span>
            </div>

            {jobs.length === 0 ? (
              <EmptyState 
                title="No jobs yet." 
                description="Start your first hunt." 
                icon="📭" 
              />
            ) : (
              jobs.map(job => (
                <JobCard
                  key={job.id}
                  id={job.id}
                  title={job.title || 'Unknown Role'}
                  company={job.company || 'Unknown Company'}
                  salaryMin={job.salaryMin ?? undefined}
                  salaryMax={job.salaryMax ?? undefined}
                  remote={!!job.remoteType}
                  score={job.opportunityScore ?? undefined}
                  competition={job.competition || 'Avg'}
                  provider={job.sourceType ? job.sourceType.replace(/_/g, ' ') : undefined}
                  age={job.firstSeenAt ? `${getAgeInDays(job.firstSeenAt)}d ago` : 'Unknown'}
                  decision={job.decision ?? undefined}
                />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
