import React from 'react';
import { Thread } from '../types';

interface ProtectionBadgeProps {
  status?: Thread['protectionStatus'];
  compact?: boolean;
}

export const ProtectionBadge: React.FC<ProtectionBadgeProps> = ({ status, compact = false }) => {
  const isKeyed = status === 'code_protected';
  const label = isKeyed ? 'Keyed' : 'Open';
  const explanation = isKeyed
    ? 'Anyone can read; a key is needed to add posts.'
    : 'Anyone can read and add posts.';

  return (
    <span
      title={explanation}
      aria-label={`${label}: ${explanation}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${
        compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs'
      } ${
        isKeyed
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      }`}
    >
      <i className={`fas ${isKeyed ? 'fa-key' : 'fa-door-open'}`} aria-hidden="true"></i>
      {label}
    </span>
  );
};
