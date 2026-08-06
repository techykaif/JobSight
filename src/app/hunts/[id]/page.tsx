import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

import RunControls from '@/components/RunControls';
import LiveEventFeed from '@/components/LiveEventFeed';

export default async function HuntDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runRec = await db.select().from(schema.runs).where(eq(schema.runs.id, id)).limit(1);
  const run = runRec[0];

  if (!run) {
    return <div>Hunt not found</div>;
  }

  const configRec = await db.select().from(schema.huntConfigs).where(eq(schema.huntConfigs.id, run.configId)).limit(1);
  const config = configRec[0];

  const failuresData = await db.select({
    f: schema.failures,
    jobTitle: schema.jobs.canonicalTitle,
    companyName: schema.companies.displayName
  }).from(schema.failures)
    .leftJoin(schema.jobs, eq(schema.failures.entityId, schema.jobs.id))
    .leftJoin(schema.companies, eq(schema.failures.entityId, schema.companies.id))
    .where(eq(schema.failures.runId, run.id))
    .orderBy(desc(schema.failures.createdAt));

  return (
    <div>
      <div className="page-header">
        <h2>Hunt Details <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{run.id}</span></h2>
        <Link href="/hunts" className="btn">Back to Hunts</Link>
      </div>

      <RunControls runId={run.id} initialStatus={run.status} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Run Status</h3>
          <p><strong>Status:</strong> <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{run.status}</span></p>
          <p><strong>Stage:</strong> {run.currentStage}</p>
          <p><strong>Created:</strong> {new Date(run.createdAt).toLocaleString()}</p>
          {run.startedAt && <p><strong>Started:</strong> {new Date(run.startedAt).toLocaleString()}</p>}
          {run.completedAt && <p><strong>Completed:</strong> {new Date(run.completedAt).toLocaleString()}</p>}
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Configuration</h3>
          <p><strong>Target Roles:</strong> {config?.targetRoles ? (config.targetRoles as string[]).join(', ') : 'None'}</p>
          <p><strong>Required Skills:</strong> {config?.requiredSkills ? (config.requiredSkills as string[]).join(', ') : 'None'}</p>
          <p><strong>Min Salary:</strong> {config?.salaryMinimum || 'Any'}</p>
          <p><strong>Remote:</strong> {config?.remoteRequirement || 'Any'}</p>
        </div>
      </div>

      {failuresData.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--danger-text)' }}>Failures</h3>
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
                      <td>{f.stage}</td>
                      <td>{unit}</td>
                      <td>{f.failureCode}</td>
                      <td>{f.attempt}{f.retryable ? '' : ' (Final)'}</td>
                      <td style={{ color: 'var(--danger-text)' }}>{f.message}</td>
                      <td>{new Date(f.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LiveEventFeed runId={run.id} />
    </div>
  );
}
