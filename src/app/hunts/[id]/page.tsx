import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc, asc, count } from 'drizzle-orm';
import Link from 'next/link';

import RunControls from '@/components/RunControls';
import LiveEventFeed from '@/components/LiveEventFeed';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionButton } from '@/components/ui/ActionButton';
import { Timeline, type TimelineItem } from '@/components/ui/Timeline';

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

  const timelineItems: TimelineItem[] = Object.entries(stageTimings).map(([stage, timing]) => {
    const s = timing.start.getTime();
    const e = timing.end?.getTime() || s;
    const diffSecs = Math.max(0, Math.floor((e - s) / 1000));
    return {
      id: stage,
      title: stage,
      description: `Duration: ${diffSecs}s`,
      date: timing.start.toLocaleTimeString(),
      isActive: !isCompleted && stage === run.currentStage
    };
  });

  const statusVariant = run.status === 'RUNNING' ? 'info' : run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'danger' : 'neutral';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Hunts', href: '/hunts' }, { label: `Hunt #${run.id.slice(0, 8)}` }]} />
      </div>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: 0 }}>
            Hunt History 
            <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>#{run.id.slice(0, 8)}</span>
            <StatusBadge status={run.status} variant={statusVariant} />
          </h2>
        </div>
        <Link href="/hunts" className="btn">Back to Hunts</Link>
      </div>

      {!isCompleted && <RunControls runId={run.id} initialStatus={run.status} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <MetricCard label="Duration" value={duration} />
        <MetricCard label="Providers Used" value={providersSet.size.toString()} />
        <MetricCard label="Jobs Found" value={observationsCount.c.toString()} />
        <MetricCard label="Company Research" value={(companyResearchCount.c + researchCount).toString()} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <MetricCard label="Qualified & Accepted" value={accepted.toString()} trend={{ value: 100, isPositive: true }} />
        <MetricCard label="Rejected" value={rejected.toString()} trend={{ value: 100, isPositive: false }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Stage Timings (Telemetry)</h3>
          {timelineItems.length > 0 ? (
            <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              <Timeline items={timelineItems} />
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No telemetry data available</p>
          )}
        </div>

        <div>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Configuration</h3>
            <p><strong>Target Roles:</strong><br/><span style={{ color: 'var(--text-secondary)' }}>{config?.targetRoles ? (config.targetRoles as string[]).join(', ') : 'None'}</span></p>
            <p><strong>Required Skills:</strong><br/><span style={{ color: 'var(--text-secondary)' }}>{config?.requiredSkills ? (config.requiredSkills as string[]).join(', ') : 'None'}</span></p>
            <p><strong>Remote:</strong><br/>
              <Link href={`/jobs?remote=${config?.remoteRequirement || 'Any'}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                {config?.remoteRequirement || 'Any'}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {failuresData.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Failures ({failuresData.length})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Job/Unit</th>
                  <th>Failure Category</th>
                  <th>Attempt</th>
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
                      <td>{f.attempt}{f.retryable ? '' : ' (Final)'}</td>
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
      <LiveEventFeed runId={run.id} />
    </div>
  );
}
