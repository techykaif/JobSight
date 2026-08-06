import { describe, it, expect, vi } from 'vitest';
import DashboardPage from '../app/page';
import RadarPage from '../app/radar/page';
import BoardPage from '../app/board/page';
import JobDetailsPage from '../app/jobs/[id]/page';
import CompanyDetailsPage from '../app/companies/[id]/page';
import JobsPage from '../app/jobs/page';

// Mock DB Client
vi.mock('@/lib/db/client', () => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue([]),
    then: function(resolve: any) {
      resolve([]);
    }
  };
  return {
    db: queryBuilder
  };
});

describe('Page Components', () => {
  it('Dashboard renders without error', async () => {
    // The component is async, so we await it
    const el = await DashboardPage();
    expect(el).toBeDefined();
    expect(typeof el).toBe('object');
  });

  it('Discovery Radar renders without error', async () => {
    const el = await RadarPage();
    expect(el).toBeDefined();
  });

  it('Decision Board renders without error', async () => {
    const el = await BoardPage();
    expect(el).toBeDefined();
  });

  it('Job Details renders without error', async () => {
    // Mocking Next.js params
    const el = await JobDetailsPage({ params: Promise.resolve({ id: 'job_123' }) });
    expect(el).toBeDefined();
  });

  it('Company Details renders without error', async () => {
    const el = await CompanyDetailsPage({ params: Promise.resolve({ id: 'comp_123' }) });
    expect(el).toBeDefined();
  });

  it('Jobs Explorer (Search & Filters) renders without error', async () => {
    const el = await JobsPage({ searchParams: Promise.resolve({}) });
    expect(el).toBeDefined();
  });
});
