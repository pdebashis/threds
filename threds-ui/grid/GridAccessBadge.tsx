import React from 'react';

import type { GridAccess } from './types';

interface GridAccessBadgeProps {
  access: GridAccess;
  compact?: boolean;
}

/**
 * Grid access indicator. Deliberately separate from the Imageboard's
 * ProtectionBadge so Grid never has to borrow Imageboard types.
 */
export const GridAccessBadge: React.FC<GridAccessBadgeProps> = ({ access, compact = false }) => {
  const isKeyed = access === 'keyed';
  const label = isKeyed ? 'Keyed' : 'Open';
  const explanation = isKeyed
    ? 'Anyone can read this Grid. A key is needed to write.'
    : 'Anyone can read and write to this Grid.';

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

export const gridAccessExplanation = (access: GridAccess): string =>
  access === 'keyed'
    ? 'Anyone can read this Grid. Only a caller with the key can write to it.'
    : 'Anyone can read and write to this Grid.';
