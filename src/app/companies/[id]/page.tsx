import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, id)).limit(1);
  const comp = compRec[0];

  if (!comp) {
    return <div>Company not found</div>;
  }

  const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.companyId, comp.id)).orderBy(desc(schema.jobs.firstSeenAt));
  const artifacts = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.entityId, comp.id)).orderBy(desc(schema.researchArtifacts.createdAt)).limit(1);
  const artifact = artifacts[0];

  let research: any = null;
  if (artifact && artifact.metadata) {
    try {
      const parsed = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
      research = parsed?.structuredData || null;
    } catch(e) {}
  }

  return (
    <div>
      <div className="page-header">
        <h2>{comp.displayName}</h2>
        <Link href="/companies" className="btn">Back to Companies</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Identity</h3>
          <p><strong>Name:</strong> {comp.displayName}</p>
          <p><strong>Website:</strong> {comp.website ? <a href={comp.website} target="_blank" rel="noopener noreferrer">{comp.website}</a> : 'Unknown'}</p>
          <p><strong>Careers URL:</strong> {comp.careersUrl ? <a href={comp.careersUrl} target="_blank" rel="noopener noreferrer">Careers</a> : 'Unknown'}</p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Research Artifacts</h3>
          {artifact ? (
            <>
              <p><strong>Last Researched:</strong> {new Date(artifact.createdAt).toLocaleString()}</p>
              {research && research.hiring ? (
                <>
                  <p><strong>Current Openings:</strong> {research.hiring.currentOpenings || 'Unknown'}</p>
                  <p><strong>Engineering Openings:</strong> {research.hiring.engineeringOpenings || 'Unknown'}</p>
                  <p><strong>Remote Friendly:</strong> {research.hiring.remoteOpenings ? 'Yes' : 'Unknown'}</p>
                </>
              ) : <p style={{ color: 'var(--warning-text)' }}>Research timed out or failed structuring.</p>}
            </>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No research performed yet.</p>
          )}
        </div>
      </div>

      <div>
        <h3>Jobs Observed</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Location</th>
                <th>First Seen</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>No jobs observed yet.</td>
                </tr>
              )}
              {jobs.map(job => (
                <tr key={job.id}>
                  <td><Link href={`/jobs/${job.id}`}>{job.canonicalTitle || job.normalizedTitle}</Link></td>
                  <td>{job.location || job.remoteType || 'Unknown'}</td>
                  <td>{new Date(job.firstSeenAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
