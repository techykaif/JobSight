import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc, asc, count, and } from 'drizzle-orm';
import Link from 'next/link';

import RunControls from '@/components/RunControls';
import LiveEventFeed from '@/components/LiveEventFeed';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';
import { Timeline, type TimelineItem } from '@/components/ui/Timeline';
import { JobCard } from '@/components/ui/JobCard';

function formatDuration(start: string | null, end: string | null) {
  if (!start) return 'N/A';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffSecs = Math.floor((endTime - startTime) / 1000);
  if (diffSecs < 60) return `${diffSecs}s`;
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  return `${mins}m ${secs}s`;
}

export default async function HuntDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, id)).limit(1);
  if (!run) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem' }}>
        <EmptyState 
          title="Hunt Not Found" 
          description="The requested hunt ID does not exist." 
          icon="❓" 
          action={<Link href="/hunts"><ActionButton variant="primary">Back to Hunts</ActionButton></Link>} 
        />
      </div>
    );
  }

  const [config] = await db.select().from(schema.huntConfigs).where(eq(schema.huntConfigs.id, run.configId)).limit(1);

  // Fetch Failures
  const failuresData = await db.select({
    f: schema.failures,
    jobTitle: schema.jobs.canonicalTitle,
    companyName: schema.companies.displayName
  }).from(schema.failures)
    .leftJoin(schema.jobs, eq(schema.failures.entityId, schema.jobs.id))
    .leftJoin(schema.companies, eq(schema.failures.entityId, schema.companies.id))
    .where(eq(schema.failures.runId, run.id))
    .orderBy(desc(schema.failures.createdAt));

  // Fetch telemetry / events
  const eventsData = await db.select()
    .from(schema.pipelineEvents)
    .where(eq(schema.pipelineEvents.runId, run.id))
    .orderBy(asc(schema.pipelineEvents.timestamp));

  // Fetch final decisions
  const finalDecisionsData = await db.select({
    decision: schema.candidateDecisions,
    job: schema.jobs,
    company: schema.companies
  }).from(schema.candidateDecisions)
    .innerJoin(schema.jobs, eq(schema.candidateDecisions.jobId, schema.jobs.id))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(eq(schema.candidateDecisions.runId, run.id))
    .orderBy(desc(schema.candidateDecisions.createdAt));

  // Aggregations
  const decisionCounts = await db.select({
    decision: schema.decisions.decision,
    count: count()
  }).from(schema.decisions)
    .where(eq(schema.decisions.runId, run.id))
    .groupBy(schema.decisions.decision);

  const accepted = decisionCounts.find(d => d.decision === 'APPLY' || d.decision === 'CONSIDER')?.count || 0;
  const rejected = decisionCounts.find(d => d.decision === 'SKIP')?.count || 0;
  const researchCount = decisionCounts.find(d => d.decision === 'RESEARCH_REQUIRED')?.count || 0;

  const [observationsCount = { c: 0 }] = await db.select({ c: count() })
    .from(schema.jobObservations).where(eq(schema.jobObservations.runId, run.id));

  const [companyResearchCount = { c: 0 }] = await db.select({ c: count() })
    .from(schema.companyAnalysis).where(eq(schema.companyAnalysis.runId, run.id));

  // Intelligence Health B1-B7
  const [b1CountRes = { c: 0 }] = await db.select({ c: count() }).from(schema.scores).where(and(eq(schema.scores.runId, run.id), eq(schema.scores.scoreType, 'RESUME_MATCH')));
  const [b2CountRes = { c: 0 }] = await db.select({ c: count() }).from(schema.competitionResults).where(eq(schema.competitionResults.runId, run.id));
  const [b3CountRes = { c: 0 }] = await db.select({ c: count() }).from(schema.companyOpportunity).where(eq(schema.companyOpportunity.runId, run.id));
  const [b4CountRes = { c: 0 }] = await db.select({ c: count() }).from(schema.discoveryIntelligence).where(eq(schema.discoveryIntelligence.runId, run.id));
  const [b5CountRes = { c: 0 }] = await db.select({ c: count() }).from(schema.applicationResults).where(eq(schema.applicationResults.runId, run.id));
  const [b7CountRes = { c: 0 }] = await db.select({ c: count() }).from(schema.decisionResults).where(eq(schema.decisionResults.runId, run.id));

  // Geographic Health B6
  const [b6EligibleRes = { count: 0 }] = await db.select({ count: count() }).from(schema.jobs).innerJoin(schema.jobObservations, eq(schema.jobs.id, schema.jobObservations.jobId)).where(and(eq(schema.jobObservations.runId, run.id), eq(schema.jobs.candidateRemoteEligibility, 'ELIGIBLE')));
  const [b6NotEligibleRes = { count: 0 }] = await db.select({ count: count() }).from(schema.jobs).innerJoin(schema.jobObservations, eq(schema.jobs.id, schema.jobObservations.jobId)).where(and(eq(schema.jobObservations.runId, run.id), eq(schema.jobs.candidateRemoteEligibility, 'NOT_ELIGIBLE')));
  const [b6UnknownRes = { count: 0 }] = await db.select({ count: count() }).from(schema.jobs).innerJoin(schema.jobObservations, eq(schema.jobs.id, schema.jobObservations.jobId)).where(and(eq(schema.jobObservations.runId, run.id), eq(schema.jobs.candidateRemoteEligibility, 'UNKNOWN')));

  const discoveryEvent = eventsData.find(e => e.eventType === 'DISCOVERY_BATCH_COMPLETED')?.payload as any;
  const stageBEvent = eventsData.find(e => e.eventType === 'STAGE_B_TELEMETRY')?.payload as any;

  const providersSet = new Set<string>();
  eventsData.forEach(ev => {
    if (ev.payload && typeof ev.payload === 'object' && 'provider' in (ev.payload as any)) {
      providersSet.add((ev.payload as any).provider);
    }
  });

  const duration = formatDuration(run.startedAt, run.completedAt);
  const isCompleted = run.status === 'COMPLETED' || run.status === 'FAILED' || run.status === 'CANCELLED';

  // Compute Stage Timings
  const stageTimings: Record<string, { start: Date; end: Date | null }> = {};
  eventsData.forEach(ev => {
    const stage = ev.stage;
    if (!stage) return;
    const t = new Date(ev.timestamp);
    if (!stageTimings[stage]) {
      stageTimings[stage] = { start: t, end: t };
    } else {
      stageTimings[stage]!.end = t;
    }
  });

  const humanizeStage = (s: string) => {
    const m: Record<string, string> = {
      'START': 'Initializing',
      'PREFLIGHT': 'Preflight',
      'DISCOVERY': 'Discovery',
      'STRUCTURING': 'Structuring',
      'QUALIFY': 'Qualification',
      'COMPANY': 'Company Insights',
      'FOUNDATION': 'Foundation',
      'COMPETITION': 'Competition',
      'COMPANY_OPPORTUNITY': 'Opportunity',
      'DISCOVERY_INTELLIGENCE': 'Discovery Intel',
      'APPLICATION_INTELLIGENCE': 'Application Intel',
      'LEARNING': 'Learning',
      'COMPLETED': 'Completed'
    };
    return m[s] || s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const timelineItems: TimelineItem[] = Object.entries(stageTimings).map(([stage, timing]) => {
    const s = timing.start.getTime();
    const e = timing.end?.getTime() || s;
    const diffSecs = Math.max(0, Math.floor((e - s) / 1000));
    return {
      id: stage,
      title: humanizeStage(stage),
      description: <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}><span style={{ color: 'var(--text-secondary)' }}>{diffSecs}s</span></span> as any,
      date: timing.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isActive: !isCompleted && stage === run.currentStage
    };
  });

  const statusVariant = run.status === 'RUNNING' ? 'info' : run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'neutral';

  const initialElapsed = run.startedAt && isCompleted && run.completedAt 
    ? Math.max(0, Math.floor((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))
    : run.startedAt && !isCompleted
      ? Math.max(0, Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 1000))
      : 0;

  // Candidate Decisions Aggregation
  const decisionWeights: Record<string, number> = {
    'APPLY': 1,
    'REVIEW': 2,
    'INSUFFICIENT_EVIDENCE': 3,
    'INELIGIBLE': 4,
    'SKIP': 5
  };

  const sortedDecisions = [...finalDecisionsData].sort((a, b) => {
    const wA = decisionWeights[a.decision.finalDecision] || 99;
    const wB = decisionWeights[b.decision.finalDecision] || 99;
    return wA - wB;
  });

  const decisionSummary = {
    apply: finalDecisionsData.filter(d => d.decision.finalDecision === 'APPLY').length,
    review: finalDecisionsData.filter(d => d.decision.finalDecision === 'REVIEW').length,
    insufficient: finalDecisionsData.filter(d => d.decision.finalDecision === 'INSUFFICIENT_EVIDENCE').length,
    ineligible: finalDecisionsData.filter(d => d.decision.finalDecision === 'INELIGIBLE').length,
    skip: finalDecisionsData.filter(d => d.decision.finalDecision === 'SKIP').length
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6) var(--space-5)' }}>
      <style dangerouslySetInnerHTML={{__html: `
        .timeline-container { padding: 0 !important; }
        .timeline-item { padding-bottom: 16px !important; }
        .timeline-title { font-size: 0.875rem !important; font-weight: 600 !important; }
      `}} />
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Hunts', href: '/hunts' }, { label: `Hunt #${run.id.slice(0, 8)}` }]} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)' }}>
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>Hunt History</div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 0, fontSize: '2rem', fontWeight: 700 }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>#{run.id.slice(0, 8)}</span>
            <StatusBadge status={run.status} variant={statusVariant} />
          </h1>
        </div>
        <Link href="/hunts" className="btn btn-secondary">Back to Hunts</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)', background: 'var(--bg-subtle)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Run Duration</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{duration}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Jobs Persisted</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{observationsCount.c}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Considered</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success-text)' }}>{accepted}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Skipped</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>{rejected}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {/* Discovery Health */}
        <div style={{ background: 'var(--bg-card)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>Discovery Health</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Discovered (Raw)</div><div style={{ fontSize: '1.25rem', fontWeight: 500 }}>{discoveryEvent?.discovered ?? '-'}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Structured</div><div style={{ fontSize: '1.25rem', fontWeight: 500 }}>{discoveryEvent?.structured ?? '-'}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Valid Schema</div><div style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--success-text)' }}>{discoveryEvent?.valid ?? '-'}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Failed</div><div style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--danger-text)' }}>{discoveryEvent?.failed ?? '-'}</div></div>
          </div>
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Stage B Processing: </span>
            {stageBEvent ? (
               <span style={{ color: stageBEvent.success ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 500 }}>
                 {stageBEvent.success ? `Success (${stageBEvent.latencyMs}ms)` : `Failed (${stageBEvent.error || 'Unknown'})`}
               </span>
            ) : <span style={{ color: 'var(--text-muted)' }}>Pending / Skipped</span>}
          </div>
        </div>

        {/* Intelligence Processing */}
        <div style={{ background: 'var(--bg-card)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>Intelligence Processing</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B1 Qualify</div><div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{b1CountRes.c}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B2 Compete</div><div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{b2CountRes.c}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B3 Opp</div><div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{b3CountRes.c}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B4 Discover</div><div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{b4CountRes.c}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B5 Apply</div><div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{b5CountRes.c}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B7 Learn</div><div style={{ fontSize: '1.125rem', fontWeight: 500 }}>{b7CountRes.c}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B6 Eligible</div><div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--success-text)' }}>{b6EligibleRes.count}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B6 Ineligible</div><div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--danger-text)' }}>{b6NotEligibleRes.count}</div></div>
            <div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>B6 Unknown</div><div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>{b6UnknownRes.count}</div></div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        {/* Mission Parameters */}
        <div style={{ background: 'var(--bg-card)', padding: 'var(--space-5)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 var(--space-4) 0', fontSize: '1rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>Mission Parameters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Target Roles</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, wordWrap: 'break-word' }}>
                {config?.targetRoles ? (config.targetRoles as string[]).join(', ') : 'None'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Required Skills</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, wordWrap: 'break-word' }}>
                {config?.requiredSkills ? (config.requiredSkills as string[]).join(', ') : 'None'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Remote Requirement</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {config?.remoteRequirement || 'Any'}
              </div>
            </div>
            {providersSet.size > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Discovered Providers</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, wordWrap: 'break-word' }}>
                  {Array.from(providersSet).join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        {/* Execution Timeline */}
        <div style={{ 
          background: 'rgba(15, 17, 21, 0.6)', 
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          width: '100%'
        }}>
          {/* Terminal Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '12px 16px', 
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', marginRight: '16px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }}></div>
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Execution Timeline</span>
            </div>
            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {run.status === 'RUNNING' ? 'RUNNING' : 'RUN LOG'}
            </div>
          </div>
          
          {/* Terminal Body */}
          <div style={{ padding: '20px 24px', maxHeight: '500px', overflowY: 'auto' }}>
            {Object.entries(stageTimings).length > 0 ? Object.entries(stageTimings).map(([stage, timing], idx, arr) => {
              const s = timing.start.getTime();
              const e = timing.end?.getTime() || s;
              const diffSecs = Math.max(0, Math.floor((e - s) / 1000));
              const isLast = idx === arr.length - 1;
              const isActive = !isCompleted && stage === run.currentStage;
              
              return (
                <div key={stage} style={{ display: 'flex', position: 'relative', paddingBottom: isLast ? '0' : '16px' }}>
                  {/* Timeline connector */}
                  {!isLast && <div style={{ position: 'absolute', left: '5px', top: '20px', bottom: '0', width: '2px', background: 'var(--border-subtle)' }}></div>}
                  
                  {/* Timeline node */}
                  <div style={{ position: 'relative', zIndex: 1, marginTop: '4px', marginRight: '16px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isActive ? 'var(--accent)' : 'var(--border-subtle)', border: '2px solid rgba(15, 17, 21, 1)', boxShadow: isActive ? '0 0 8px var(--accent)' : 'none' }}></div>
                  </div>
                  
                  {/* Timeline content row */}
                  <div style={{ display: 'flex', flex: 1, alignItems: 'center', minWidth: 0, gap: '16px' }}>
                    <div style={{ flexShrink: 0, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: '90px' }}>
                      {timing.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {humanizeStage(stage)}
                    </div>
                    <div style={{ flexShrink: 0, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: diffSecs > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {diffSecs}s
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>No telemetry data available.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path></svg>
            Candidate Decisions
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 16px 0' }}>Recommendations generated from hunt intelligence.</p>
          
          {finalDecisionsData.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {decisionSummary.apply > 0 && <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--success-text)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>APPLY ({decisionSummary.apply})</span>}
              {decisionSummary.review > 0 && <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'var(--warning-text)', border: '1px solid rgba(234, 179, 8, 0.2)' }}>REVIEW ({decisionSummary.review})</span>}
              {decisionSummary.insufficient > 0 && <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>INSUFFICIENT EVIDENCE ({decisionSummary.insufficient})</span>}
              {decisionSummary.ineligible > 0 && <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--danger-text)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>INELIGIBLE ({decisionSummary.ineligible})</span>}
              {decisionSummary.skip > 0 && <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>SKIP ({decisionSummary.skip})</span>}
            </div>
          )}
        </div>
        
        {finalDecisionsData.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
            {sortedDecisions.map(({ decision, job, company }) => (
              <JobCard
                key={decision.id}
                id={job.id}
                title={job.canonicalTitle || 'Unknown'}
                company={company?.displayName || 'Unknown'}
                salaryMin={job.salaryMin || undefined}
                salaryMax={job.salaryMax || undefined}
                remote={job.remoteType === 'REMOTE' || job.remoteType === 'HYBRID'}
                decision={decision.finalDecision}
                primaryReason={decision.primaryReason}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-8) var(--space-5)', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-subtle)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', display: 'inline-block' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No candidate recommendations yet</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>Run the hunt to generate job recommendations from your configured mission.</p>
          </div>
        )}
      </div>

      {failuresData.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--danger-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              Failures ({failuresData.length})
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Pipeline errors and terminal exceptions</p>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Job/Unit</th>
                  <th>Failure Category</th>
                  <th>Recovery State</th>
                  <th>Message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {failuresData.map(({ f, jobTitle, companyName }) => {
                  let unit = f.entityId?.slice(0, 8) || '-';
                  if (f.entityType === 'JOB' && jobTitle) unit = jobTitle;
                  if (f.entityType === 'COMPANY' && companyName) unit = companyName;

                  return (
                    <tr key={f.id}>
                      <td><StatusBadge status={f.stage || 'UNKNOWN'} variant="warning" /></td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {f.entityId ? <Link href={`/${f.entityType === 'JOB' ? 'jobs' : 'companies'}/${f.entityId}`} style={{ color: 'inherit' }}>{unit}</Link> : unit}
                      </td>
                      <td>{f.failureCode}</td>
                      <td>
                        <span style={{ color: f.retryable ? 'var(--warning-text)' : 'var(--danger-text)' }}>
                          {f.retryable ? `Retryable (Attempt ${f.attempt})` : `Terminal (Failed)`}
                        </span>
                      </td>
                      <td style={{ color: 'var(--danger-text)' }}>{f.message}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{new Date(f.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live Event Feed - Will handle the UI state if running or finished natively */}
      <LiveEventFeed 
        runId={run.id} 
        initialStatus={run.status} 
        initialElapsed={initialElapsed}
      />
    </div>
  );
}
