import { NextResponse } from 'next/server';
import { db } from '../../../lib/db/client';
import { jobs, companies, runs, providers } from '../../../lib/db/schema';
import { like, or } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const searchTerm = `%${q}%`;
  const results: any[] = [];

  try {
    // Search Jobs
    const matchingJobs = await db.select({
      id: jobs.id,
      title: jobs.canonicalTitle,
    })
    .from(jobs)
    .where(or(like(jobs.canonicalTitle, searchTerm), like(jobs.normalizedTitle, searchTerm)))
    .limit(5);

    matchingJobs.forEach(job => results.push({
      id: job.id,
      type: 'Job',
      title: job.title || 'Unknown Job',
      subtitle: 'Job Listing',
      url: `/jobs/${job.id}`
    }));

    // Search Companies
    const matchingCompanies = await db.select({
      id: companies.id,
      title: companies.displayName,
    })
    .from(companies)
    .where(like(companies.displayName, searchTerm))
    .limit(5);

    matchingCompanies.forEach(comp => results.push({
      id: comp.id,
      type: 'Company',
      title: comp.title,
      subtitle: 'Company',
      url: `/companies/${comp.id}`
    }));

    // Search Hunts (Runs)
    const matchingRuns = await db.select({
      id: runs.id,
      status: runs.status,
    })
    .from(runs)
    .where(like(runs.id, searchTerm))
    .limit(5);

    matchingRuns.forEach(r => results.push({
      id: r.id,
      type: 'Hunt',
      title: `Hunt ${r.id.substring(0, 8)}...`,
      subtitle: `Status: ${r.status}`,
      url: `/hunts/${r.id}`
    }));

    // Search Providers
    const matchingProviders = await db.select({
      id: providers.id,
      title: providers.name,
    })
    .from(providers)
    .where(like(providers.name, searchTerm))
    .limit(5);

    matchingProviders.forEach(p => results.push({
      id: p.id,
      type: 'Provider',
      title: p.title,
      subtitle: 'Data Provider',
      url: `/settings` // generic fallback for now
    }));

    // Mock search for Technologies
    const technologies = ['React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'Go', 'Rust'];
    const lowerQ = q.toLowerCase();
    const matchingTech = technologies.filter(t => t.toLowerCase().includes(lowerQ));
    matchingTech.forEach(t => results.push({
      id: `tech-${t}`,
      type: 'Technology',
      title: t,
      subtitle: 'Technology / Skill',
      url: `/jobs?q=${encodeURIComponent(t)}`
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 });
  }
}
