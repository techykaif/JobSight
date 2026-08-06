import React from 'react';
import { StatusBadge } from './StatusBadge';

export interface SalaryBadgeProps {
  min: number;
  max: number;
  currency?: string;
  period?: string;
  className?: string;
}

export const SalaryBadge: React.FC<SalaryBadgeProps> = ({
  min,
  max,
  currency = '$',
  period = '/yr',
  className = '',
}) => {
  const formatSalary = (val: number) => {
    return val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toString();
  };

  const label = `${currency}${formatSalary(min)} - ${currency}${formatSalary(max)}${period}`;

  return <StatusBadge status={label} variant="success" className={className} aria-label={`Salary range: ${label}`} />;
};
