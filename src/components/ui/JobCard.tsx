"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { SalaryBadge } from './SalaryBadge';
import { ScoreBadge } from './ScoreBadge';
import { ActionButton } from './ActionButton';

export interface JobCardProps {
  id: string;
  title: string;
  company: string;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  remote?: boolean | undefined;
  score?: number | undefined;
  competition?: string | undefined;
  provider?: string | undefined;
  age?: string | undefined;
  decision?: string | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

export const JobCard: React.FC<JobCardProps> = ({
  id,
  title,
  company,
  salaryMin,
  salaryMax,
  remote,
  score,
  competition,
  provider,
  age,
  decision,
  onClick,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handleCardClick = () => {
    if (onClick) onClick();
    router.push(`/jobs/${id}`);
  };

  const handleStopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className={className}
      interactive
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
      aria-label={`Job Post: ${title} at ${company}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company}</p>
          </div>
          {score !== undefined && (
            <div onClick={handleStopPropagation} style={{ flexShrink: 0 }}>
              <Link href={`/jobs?minScore=${score}`} style={{ textDecoration: 'none' }}>
                <ScoreBadge score={score} />
              </Link>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {salaryMin !== undefined && salaryMax !== undefined && (
            <div onClick={handleStopPropagation}>
              <Link href={`/jobs?salaryMin=${salaryMin}&salaryMax=${salaryMax}`} style={{ textDecoration: 'none' }}>
                <SalaryBadge min={salaryMin} max={salaryMax} />
              </Link>
            </div>
          )}
          {remote && (
            <div onClick={handleStopPropagation}>
              <Link href={`/jobs?remote=true`} style={{ textDecoration: 'none' }}>
                <StatusBadge status="Remote" variant="info" />
              </Link>
            </div>
          )}
          {competition && (
            <div onClick={handleStopPropagation}>
              <Link href={`/jobs?competition=${encodeURIComponent(competition)}`} style={{ textDecoration: 'none' }}>
                <StatusBadge status={`Comp: ${competition}`} variant="warning" />
              </Link>
            </div>
          )}
          {provider && (
            <div onClick={handleStopPropagation}>
              <Link href={`/jobs?provider=${encodeURIComponent(provider)}`} style={{ textDecoration: 'none' }}>
                <StatusBadge status={provider} variant="neutral" />
              </Link>
            </div>
          )}
          {age && <div onClick={handleStopPropagation}><StatusBadge status={age} variant="neutral" /></div>}
          {decision && (
            <div onClick={handleStopPropagation}>
              <Link href={`/jobs?decision=${encodeURIComponent(decision)}`} style={{ textDecoration: 'none' }}>
                <StatusBadge status={decision} variant={decision === 'Applied' ? 'success' : 'neutral'} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Action Bar - dedicated space, no overlap */}
      <div
        style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          transition: 'opacity 0.2s ease-in-out',
          opacity: isHovered ? 1 : 0.6,
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <div onClick={handleStopPropagation}>
            <Link href={`/jobs/${id}`} style={{ textDecoration: 'none' }}>
              <ActionButton size="small" variant="secondary">View Details</ActionButton>
            </Link>
          </div>
          <div onClick={handleStopPropagation}>
            <ActionButton size="small" variant="outline">Queue</ActionButton>
          </div>
        </div>
        <div onClick={handleStopPropagation}>
          <ActionButton size="small" variant="ghost" aria-label="More actions">⋮</ActionButton>
        </div>
      </div>
    </Card>
  );
};
