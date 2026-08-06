import React from 'react';
import { StatusBadge, type BadgeVariant } from './StatusBadge';

export interface ScoreBadgeProps {
  score: number;
  maxScore?: number;
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  maxScore = 100,
  className = '',
}) => {
  let variant: BadgeVariant = 'success';
  const percentage = (score / maxScore) * 100;
  
  if (percentage < 50) variant = 'danger';
  else if (percentage < 75) variant = 'warning';
  else variant = 'success';

  return (
    <StatusBadge 
      status={`${score}/${maxScore}`} 
      variant={variant} 
      className={className} 
      aria-label={`Score: ${score} out of ${maxScore}`}
    />
  );
};
