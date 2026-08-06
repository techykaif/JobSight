import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function CompaniesPage() {
  const companies = await db.select().from(schema.companies).orderBy(desc(schema.companies.createdAt));
  const jobs = await db.select().from(schema.jobs);
  const artifacts = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.workerType, 'STRUCTURE_COMPANY_RESEARCH'));

  return (
    <div>
      <div className="page-header">
        <h2>Companies</h2>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Website</th>
              <th>Open Jobs Observed</th>
              <th>Research Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No companies found.</td>
              </tr>
            )}
            {companies.map(comp => {
              const compJobs = jobs.filter(j => j.companyId === comp.id);
              const compArtifact = artifacts.find(a => a.entityId === comp.id);
              
              return (
                <tr key={comp.id}>
                  <td><Link href={`/companies/${comp.id}`}>{comp.displayName}</Link></td>
                  <td>{comp.website ? <a href={comp.website} target="_blank" rel="noopener noreferrer">Website</a> : 'Unknown'}</td>
                  <td>{compJobs.length}</td>
                  <td>{compArtifact ? new Date(compArtifact.createdAt).toLocaleString() : 'Not researched'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
