import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobRec = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).limit(1);
  const job = jobRec[0];

  if (!job) {
    return <div>Job not found</div>;
  }

  const decisionRec = await db.select().from(schema.decisions).where(eq(schema.decisions.jobId, job.id)).limit(1);
  const decision = decisionRec[0];

  const scores = await db.select().from(schema.scores).where(eq(schema.scores.jobId, job.id));
  const oppV1 = scores.find(s => s.scoreType === 'OPPORTUNITY')?.scoreValue;
  const oppV2 = scores.find(s => s.scoreType === 'OPPORTUNITY_V2')?.scoreValue;
  const resumeMatch = scores.find(s => s.scoreType === 'RESUME_MATCH')?.scoreValue;
  const reqMatch = scores.find(s => s.scoreType === 'REQUIREMENT_MATCH')?.scoreValue;
  const compScore = scores.find(s => s.scoreType === 'COMPANY_SCORE')?.scoreValue;
  const momentum = scores.find(s => s.scoreType === 'HIRING_MOMENTUM')?.scoreValue;

  let companyName = 'Unknown';
  if (job.companyId) {
    const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1);
    if (compRec[0]) companyName = compRec[0].displayName;
  }

  const getDecisionBadgeClass = (decision: string) => {
    switch(decision) {
      case 'APPLY': return 'badge-apply';
      case 'CONSIDER': return 'badge-consider';
      case 'SKIP': return 'badge-skip';
      case 'RESEARCH_REQUIRED': return 'badge-research';
      default: return '';
    }
  };

  const decisionText = decision?.decision || 'PENDING';

  const reasons = (decision?.reasons as string[]) || [];
  const unknowns = (decision?.unknowns as string[]) || [];

  return (
    <div>
      <div className="page-header">
        <h2>{job.canonicalTitle || job.normalizedTitle}</h2>
        <Link href="/jobs" className="btn">Back to Jobs</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Overview</h3>
            <p><strong>Company:</strong> {job.companyId ? <Link href={`/companies/${job.companyId}`}>{companyName}</Link> : companyName}</p>
            <p><strong>Location:</strong> {job.location || 'Unknown'}</p>
            <p><strong>Remote:</strong> {job.remoteType || 'Unknown'}</p>
            <p><strong>Eligibility:</strong> {job.candidateRemoteEligibility === 'ELIGIBLE' ? 'Eligible for candidate country' : (job.candidateRemoteEligibility === 'NOT_ELIGIBLE' ? 'Not eligible for candidate country' : 'Unknown')}</p>
            
            <p><strong>Original Salary:</strong> {job.salaryTextOriginal || 'Not disclosed'}</p>
            <p><strong>Normalized Min Salary:</strong> {job.salaryMin && job.salaryCurrency ? `${job.salaryCurrency} ${job.salaryMin} / ${job.salaryPeriod || 'YR'}` : 'Not available'}</p>
            
            <p><strong>Experience:</strong> {(() => {
              const min = job.experienceMin;
              const max = job.experienceMax;
              if (min !== null && max !== null) return `${min}–${max} years`;
              if (min !== null && max === null) return `${min}+ years`;
              if (min === null && max !== null) return `Up to ${max} years`;
              return 'Not specified';
            })()}</p>
            <p><strong>Source URL:</strong> {job.canonicalUrl ? <a href={job.canonicalUrl} target="_blank" rel="noopener noreferrer">Original Post</a> : 'N/A'}</p>
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Why</h3>
            
            {reasons.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ color: 'var(--success-text)', marginBottom: '0.5rem' }}>Positive Signals</h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                  {reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {unknowns.length > 0 && (
              <div>
                <h4 style={{ color: 'var(--warning-text)', marginBottom: '0.5rem' }}>Unknowns / Concerns</h4>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                  {unknowns.map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Qualification</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Decision:</strong>
                <span className={`badge ${getDecisionBadgeClass(decisionText)}`} style={{ fontSize: '1rem' }}>{decisionText}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Resume Match:</span>
                <strong>{resumeMatch !== undefined ? resumeMatch : 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Requirement Match:</span>
                <strong>{reqMatch !== undefined ? reqMatch : 'N/A'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Opportunity V1:</span>
                <strong>{oppV1 !== undefined ? oppV1 : 'N/A'}</strong>
              </div>
              {oppV2 !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <span>Opportunity V2:</span>
                  <strong>{oppV2}</strong>
                </div>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Company Intelligence</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Company Score:</span>
                <strong>{compScore !== undefined ? compScore : 'Research unavailable'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Hiring Momentum:</span>
                <strong>{momentum !== undefined ? momentum : 'Research unavailable'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
