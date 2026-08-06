import React from 'react';
import styles from './ui.module.css';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`${styles.sectionHeader} ${className}`}>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description && <p className={styles.sectionDescription}>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
