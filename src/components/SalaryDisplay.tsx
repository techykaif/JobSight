import React from 'react';

export function SalaryDisplay({ 
  salaryMin, 
  salaryMax, 
  salaryCurrency, 
  salaryPeriod,
  salaryTextOriginal,
  opportunityScore = 0
}: {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
  salaryTextOriginal?: string | null;
  opportunityScore?: number;
}) {
  if (!salaryMin && !salaryMax && !salaryTextOriginal) {
    return <span className="salary-undisclosed">Undisclosed Salary</span>;
  }

  const formatNumber = (num?: number | null) => {
    if (!num) return '';
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`; // INR Crores
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`; // INR Lakhs
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`; // Thousands
    return num.toString();
  };

  const getHighlightClass = () => {
    if (opportunityScore >= 80) return 'salary-excellent';
    if (opportunityScore >= 60) return 'salary-above-target';
    if (opportunityScore >= 40) return 'salary-target';
    return 'salary-below-target';
  };

  const formattedDerived = (salaryMin || salaryMax) ? (
    <span>
      {salaryMin ? formatNumber(salaryMin) : ''}
      {salaryMin && salaryMax ? '–' : ''}
      {salaryMax ? formatNumber(salaryMax) : ''}
      {' '}{salaryCurrency || ''}/{salaryPeriod === 'YEAR' ? 'yr' : salaryPeriod === 'MONTH' ? 'mo' : salaryPeriod?.toLowerCase() || ''}
    </span>
  ) : null;

  return (
    <div className={`salary-display ${getHighlightClass()}`}>
      {formattedDerived && (
        <div className="salary-derived" style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
          {formattedDerived}
        </div>
      )}
      {salaryTextOriginal && (
        <div className="salary-original" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Original: {salaryTextOriginal}
        </div>
      )}
    </div>
  );
}
