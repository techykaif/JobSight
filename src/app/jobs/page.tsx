import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';

export default async function JobsPage() {
  // Fetch all jobs along with their decisions and scores
  const jobs = await db.select().from(schema.jobs).orderBy(desc(schema.jobs.firstSeenAt));
  const decisions = await db.select().from(schema.decisions);
  const scores = await db.select().from(schema.scores);
  const companies = await db.select().from(schema.companies);

  const getDecisionBadgeClass = (decision: string) => {
    switch(decision) {
      case 'APPLY': return 'badge-apply';
      case 'CONSIDER': return 'badge-consider';
      case 'SKIP': return 'badge-skip';
      case 'RESEARCH_REQUIRED': return 'badge-research';
      default: return '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Jobs Explorer</h2>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Location</th>
              <th>Salary</th>
              <th>Opp V2</th>
              <th>Priority</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No jobs found.</td>
              </tr>
            )}
            {jobs.map(job => {
              const decision = decisions.find(d => d.jobId === job.id);
              const jobScores = scores.filter(s => s.jobId === job.id);
              const oppV2 = jobScores.find(s => s.scoreType === 'OPPORTUNITY_V2')?.scoreValue;
              const priority = jobScores.find(s => s.scoreType === 'APPLICATION_PRIORITY')?.scoreValue;
              const company = companies.find(c => c.id === job.companyId);
              
              let salaryText = 'Unknown';
              if (job.salaryMin && job.salaryMax && job.salaryCurrency) {
                salaryText = `${job.salaryCurrency} ${job.salaryMin} - ${job.salaryMax} / ${job.salaryPeriod || 'YR'}`;
              } else if (job.salaryMin && job.salaryCurrency) {
                salaryText = `${job.salaryCurrency} ${job.salaryMin}+ / ${job.salaryPeriod || 'YR'}`;
              }
              
              if (job.salaryTextOriginal && salaryText === 'Unknown') {
                salaryText = job.salaryTextOriginal;
              }
              
              const decisionText = decision?.decision || 'PENDING';
              
              return (
                <tr key={job.id}>
                  <td>{company?.displayName || 'Unknown Company'}</td>
                  <td><Link href={`/jobs/${job.id}`}>{job.canonicalTitle || job.normalizedTitle || 'Unknown Role'}</Link></td>
                  <td>{job.location || job.remoteType || 'Unknown'}</td>
                  <td>{salaryText}</td>
                  <td>{oppV2 !== undefined ? oppV2 : 'N/A'}</td>
                  <td>{priority !== undefined ? priority : 'N/A'}</td>
                  <td><span className={`badge ${getDecisionBadgeClass(decisionText)}`}>{decisionText}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
