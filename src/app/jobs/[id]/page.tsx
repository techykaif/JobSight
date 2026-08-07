import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';

function parseJsonArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch(e) {
      // If it's a comma-separated string or just a string
      return [val];
    }
  }
  return [];
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Data Fetching
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

  const companyRec = job.companyId ? await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1) : [];
  const companyName = companyRec[0]?.displayName || 'Unknown Company';

  const decisionRec = await db.select().from(schema.decisions).where(eq(schema.decisions.jobId, job.id)).limit(1);
  const decision = decisionRec[0];

  const decisionResultRec = await db.select().from(schema.decisionResults).where(eq(schema.decisionResults.jobId, job.id)).limit(1);
  const decisionResult = decisionResultRec[0];

  const analysisRec = await db.select().from(schema.jobAnalysis).where(eq(schema.jobAnalysis.jobId, job.id)).limit(1);
  const jobAnalysis = analysisRec[0];

  const compAnalysisRec = job.companyId ? await db.select().from(schema.companyAnalysis).where(eq(schema.companyAnalysis.companyId, job.companyId)).limit(1) : [];
  const compAnalysis = compAnalysisRec[0];

  const discIntelRec = await db.select().from(schema.discoveryIntelligence).where(eq(schema.discoveryIntelligence.jobId, job.id)).limit(1);
  const discoveryIntel = discIntelRec[0];

  const evidenceList = await db.select().from(schema.evidence).where(eq(schema.evidence.entityId, job.id));
  const scoresList = await db.select().from(schema.scores).where(eq(schema.scores.jobId, job.id));

  // Extract Scores
  const getScore = (type: string) => scoresList.find(s => s.scoreType === type)?.scoreValue;
  const scores = {
    opportunity: getScore('OPPORTUNITY') || getScore('OPPORTUNITY_V2'),
    resumeMatch: getScore('RESUME_MATCH'),
    reqMatch: getScore('REQUIREMENT_MATCH'),
    companyScore: getScore('COMPANY_SCORE'),
    momentum: getScore('HIRING_MOMENTUM')
  };

  // Extract Evidence
  const requiredSkillsEvidence = evidenceList.filter(e => e.field === 'requiredSkills' || e.field === 'skills');
  const preferredSkillsEvidence = evidenceList.filter(e => e.field === 'preferredSkills');
  const salaryEvidence = evidenceList.filter(e => e.field.toLowerCase().includes('salary'));

  // Helpers
  const formatSalary = (min: number | null, max: number | null, curr: string | null, period: string | null) => {
    if (!min && !max) return null;
    const currency = curr || '$';
    const p = period ? `/${period.toLowerCase()}` : '';
    if (min && max) return `${currency}${min.toLocaleString()} - ${currency}${max.toLocaleString()}${p}`;
    if (min) return `${currency}${min.toLocaleString()}+${p}`;
    if (max) return `Up to ${currency}${max.toLocaleString()}${p}`;
    return null;
  };

  const normalizedSalary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const originalSalary = job.salaryTextOriginal || formatSalary(job.salaryMinOriginal, job.salaryMaxOriginal, job.salaryCurrencyOriginal, job.salaryPeriodOriginal);

  const formatDecisionText = (dec?: string) => dec?.replace(/_/g, ' ') || 'PENDING';
  
  const decisionVal = decisionResult?.decision || decision?.decision || 'PENDING';

  const getUrgencyColor = (u: string | null) => {
    if (!u) return 'var(--text-secondary)';
    if (u.includes('HIGH')) return 'var(--error-color)';
    if (u.includes('MEDIUM')) return 'var(--warning-color)';
    return 'var(--success-color)';
  };

  // SVGs
  const IconOverview = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
  const IconSalary = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
  const IconBrain = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>;
  const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
  const IconTarget = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;

  // Common styles
  const titleStyle = {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)',
    margin: '0 0 1.2rem 0', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)'
  };
  const listStyle = { margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' };
  
  const title = job.canonicalTitle || job.normalizedTitle || 'Unknown Role';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', animation: 'fadeIn 0.35s ease-out' }}>
      
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Jobs', href: '/jobs' },
        { label: title }
      ]} />
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, marginTop: 20, gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>{title}</h1>
            <Link href={`/jobs?decision=${decisionVal}`} style={{ textDecoration: 'none' }}>
              <StatusBadge status={formatDecisionText(decisionVal)} variant={decisionVal === 'APPLY' ? 'success' : decisionVal === 'SKIP' ? 'danger' : 'neutral'} />
            </Link>
          </div>
          <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {job.companyId
              ? <Link href={`/jobs?company=${companyName}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{companyName}</Link>
              : companyName}
            {job.location && <><span style={{ opacity: 0.4 }}>·</span>{job.location}</>}
            {job.remoteType && <><span style={{ opacity: 0.4 }}>·</span><Link href={`/jobs?remote=${job.remoteType}`} style={{ textDecoration: 'none' }}><StatusBadge status={job.remoteType} variant="info" /></Link></>}
          </p>
        </div>
        <Link href="/jobs" className="btn" style={{ flexShrink: 0 }}>
          ← Back to Jobs
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Overview Section */}
          <Card>
            <h3 style={titleStyle}><IconOverview/> Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Employment Type</div>
                <div style={{ fontWeight: 500 }}>{job.employmentType || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Experience Required</div>
                <div style={{ fontWeight: 500 }}>
                  {job.experienceMin !== null && job.experienceMax !== null ? `${job.experienceMin} - ${job.experienceMax} years` : 
                   job.experienceMin !== null ? `${job.experienceMin}+ years` : 
                   job.experienceMax !== null ? `Up to ${job.experienceMax} years` : 'Not specified'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Candidate Eligibility</div>
                <div style={{ fontWeight: 500 }}>{job.candidateRemoteEligibility?.replace(/_/g, ' ') || 'Unknown'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>First Seen</div>
                <div style={{ fontWeight: 500 }}>{new Date(job.firstSeenAt).toLocaleDateString()}</div>
              </div>
            </div>
          </Card>

          {/* Salary Intelligence */}
          <Card>
            <h3 style={titleStyle}><IconSalary/> Salary Intelligence</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '1.5rem' }}>
              {normalizedSalary ? (
                <div style={{ flex: 1, minWidth: '250px', padding: '1rem', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Target Compensation</div>
                  <Link href={`/jobs?salary=${job.salaryMin}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-color)' }}>{normalizedSalary}</div>
                  </Link>
                </div>
              ) : (
                <div style={{ flex: 1, padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                  No standardized salary data available.
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: '250px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Original Posting Data</div>
                <div style={{ fontWeight: 500, padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {originalSalary || 'Not disclosed in original posting.'}
                </div>
              </div>
            </div>
            {salaryEvidence.length > 0 && (
              <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Evidence:</strong>
                <ul style={{ ...listStyle, marginTop: '0.5rem' }}>
                  {salaryEvidence.map((e, i) => (
                    <li key={i}>"{e.evidenceExcerpt}" <span style={{ opacity: 0.6 }}>({e.evidenceType}, Confidence: {e.confidence}%)</span></li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Hiring Criteria & Analysis */}
          {jobAnalysis && (
            <Card>
              <h3 style={titleStyle}><IconBrain/> Hiring Criteria & Analysis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div><strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Experience Flexibility:</strong> {jobAnalysis.experienceFlexibility || 'Unknown'}</div>
                <div><strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Seniority Assessment:</strong> {jobAnalysis.seniorityAssessment || 'Unknown'}</div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Requirement Difficulty:</strong> {jobAnalysis.requirementDifficulty || 'Unknown'}
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Competition Estimate:</strong> 
                  <Link href={`/jobs?competition=${jobAnalysis.competitionEstimate}`} style={{ textDecoration: 'none' }}>
                    <StatusBadge status={jobAnalysis.competitionEstimate || 'Unknown'} variant={jobAnalysis.competitionEstimate === 'HIGH' ? 'warning' : 'neutral'} />
                  </Link>
                </div>
              </div>
              {jobAnalysis.analysisReasoning && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Reasoning:</strong>
                  <p style={{ margin: 0, lineHeight: 1.5 }}>{jobAnalysis.analysisReasoning}</p>
                </div>
              )}
            </Card>
          )}

          {/* Skills Requirements */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <Card>
              <h3 style={titleStyle}><IconTarget/> Required Skills</h3>
              {requiredSkillsEvidence.length > 0 ? (
                <ul style={listStyle}>
                  {requiredSkillsEvidence.map((e, i) => <li key={i}>{e.valueRepresentation || e.evidenceExcerpt}</li>)}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No explicit required skills extracted.</div>
              )}
            </Card>
            
            <Card>
              <h3 style={titleStyle}><IconCheck/> Preferred Skills</h3>
              {preferredSkillsEvidence.length > 0 ? (
                <ul style={listStyle}>
                  {preferredSkillsEvidence.map((e, i) => <li key={i}>{e.valueRepresentation || e.evidenceExcerpt}</li>)}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No preferred skills extracted.</div>
              )}
            </Card>
          </div>

          {/* Original Job Posting */}
          <Card>
            <h3 style={titleStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> 
              Original Job Posting
            </h3>
            <div style={{ marginBottom: '1rem' }}>
              {job.canonicalUrl ? (
                <a href={job.canonicalUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500 }}>
                  View Original Posting <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>Original URL not available.</span>
              )}
            </div>
            {job.description && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {job.description}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Decision & Action */}
          <Card style={{ borderTop: decisionVal === 'APPLY' ? '4px solid var(--success-color)' : decisionVal === 'SKIP' ? '4px solid var(--error-color)' : '4px solid var(--accent-color)' }}>
            <h3 style={titleStyle}>Decision & Action</h3>
            
            {(decisionResult?.urgencyLevel as string) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Urgency:</span>
                <strong style={{ color: getUrgencyColor(decisionResult?.urgencyLevel as string) }}>{decisionResult?.urgencyLevel as string}</strong>
              </div>
            )}
            
            {(decisionResult?.roiLevel as string) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ROI Level:</span>
                <strong>{decisionResult?.roiLevel as string}</strong>
              </div>
            )}

            {/* Reasons */}
            {parseJsonArray(decisionResult?.reasons || decision?.reasons).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--success-color)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>Positive Signals</div>
                <ul style={listStyle}>
                  {parseJsonArray(decisionResult?.reasons || decision?.reasons).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {/* Unknowns / Risks */}
            {parseJsonArray(decisionResult?.unknowns || decision?.unknowns).length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--warning-color)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', fontWeight: 600 }}>Risks & Unknowns</div>
                <ul style={listStyle}>
                  {parseJsonArray(decisionResult?.unknowns || decision?.unknowns).map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </div>
            )}
          </Card>

          {/* Application Checklist */}
          {parseJsonArray(decisionResult?.requiredActions).length > 0 && (
            <Card>
              <h3 style={titleStyle}>Application Checklist</h3>
              <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {parseJsonArray(decisionResult?.requiredActions).map((action, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '2px solid var(--text-secondary)', marginTop: '2px', flexShrink: 0 }}></div>
                    <span style={{ fontSize: '0.95rem', lineHeight: 1.4 }}>{action}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Qualification Scores */}
          <Card>
            <h3 style={titleStyle}>Qualification</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Resume Match:</span>
                <strong style={{ fontSize: '1.1rem' }}>{scores.resumeMatch ?? '-'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Requirement Match:</span>
                <strong style={{ fontSize: '1.1rem' }}>{scores.reqMatch ?? '-'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Opportunity Score:</span>
                <Link href={scores.opportunity ? `/jobs?oppScore=${scores.opportunity}` : '#'} style={{ textDecoration: 'none' }}>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--accent-color)' }}>{scores.opportunity ?? '-'}</strong>
                </Link>
              </div>
            </div>
          </Card>

          {/* Company Intelligence */}
          {compAnalysis && (
            <Card>
              <h3 style={titleStyle}>Company Intelligence</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Company Score:</span>
                  <strong>{scores.companyScore ?? '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Hiring Momentum:</span>
                  <strong>{compAnalysis.hiringMomentum || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Remote Friendliness:</span>
                  <strong>{compAnalysis.remoteFriendliness || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Growth Signal:</span>
                  <strong>{compAnalysis.growthSignal || '-'}</strong>
                </div>
                {compAnalysis.layoffSignal && compAnalysis.layoffSignal !== 'NONE' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--error-color)' }}>
                    <span>Layoff Signal:</span>
                    <strong>{compAnalysis.layoffSignal}</strong>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Discovery Intelligence */}
          {discoveryIntel && (
            <Card>
              <h3 style={titleStyle}>Discovery Intelligence</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {discoveryIntel.hiddenGem && (
                  <Link href="/jobs?hiddenGem=true" style={{ textDecoration: 'none' }}>
                    <div style={{ display: 'inline-flex', width: '100%', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--accent-color)', borderRadius: '6px', border: '1px dashed var(--accent-color)', justifyContent: 'center', fontWeight: 600, marginBottom: '0.5rem' }}>
                      💎 Identified as Hidden Gem
                    </div>
                  </Link>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Visibility:</span>
                  <strong>{discoveryIntel.visibility || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Authenticity:</span>
                  <Link href={`/jobs?authenticity=${discoveryIntel.authenticity || 'ALL'}`} style={{ textDecoration: 'none' }}>
                    <strong>{discoveryIntel.authenticity || '-'}</strong>
                  </Link>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Freshness:</span>
                  <strong>{discoveryIntel.freshness || '-'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Source Trust:</span>
                  <strong>{discoveryIntel.sourceTrust || '-'}</strong>
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
