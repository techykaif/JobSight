import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

export default async function HuntsPage() {
  const runs = await db.select().from(schema.runs).orderBy(desc(schema.runs.createdAt));

  return (
    <div>
      <div className="page-header">
        <h2>Hunts</h2>
        <Link href="/hunts/new" className="btn btn-primary">New Hunt</Link>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Stage</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hunts created yet.</td>
              </tr>
            )}
            {runs.map(run => (
              <tr key={run.id}>
                <td>
                  <span className="badge" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{run.status}</span>
                </td>
                <td>{run.currentStage || 'Unknown'}</td>
                <td>{new Date(run.createdAt).toLocaleString()}</td>
                <td>
                  <Link href={`/hunts/${run.id}`}>View Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
