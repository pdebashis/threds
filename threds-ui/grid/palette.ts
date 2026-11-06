import type { GridCellColor, GridCellFormat } from './types.ts';

export interface GridColorOption {
  key: GridCellColor | 'none';
  label: string;
  /** Background applied to a grid cell. Empty for "no fill". */
  cellClass: string;
  /** Background applied to the palette swatch button. */
  swatchClass: string;
}

// A finite palette is the only thing the API accepts. Cells store the key, not
// a CSS value, so a hostile value can never become styling.
export const GRID_COLOR_OPTIONS: readonly GridColorOption[] = [
  {
    key: 'none',
    label: 'No fill',
    cellClass: '',
    swatchClass: 'bg-white dark:bg-gray-800',
  },
  {
    key: 'slate',
    label: 'Slate',
    cellClass: 'bg-slate-100 dark:bg-slate-700',
    swatchClass: 'bg-slate-300 dark:bg-slate-600',
  },
  {
    key: 'rose',
    label: 'Rose',
    cellClass: 'bg-rose-100 dark:bg-rose-900/60',
    swatchClass: 'bg-rose-300 dark:bg-rose-700',
  },
  {
    key: 'amber',
    label: 'Amber',
    cellClass: 'bg-amber-100 dark:bg-amber-900/60',
    swatchClass: 'bg-amber-300 dark:bg-amber-700',
  },
  {
    key: 'emerald',
    label: 'Emerald',
    cellClass: 'bg-emerald-100 dark:bg-emerald-900/60',
    swatchClass: 'bg-emerald-300 dark:bg-emerald-700',
  },
  {
    key: 'sky',
    label: 'Sky',
    cellClass: 'bg-sky-100 dark:bg-sky-900/60',
    swatchClass: 'bg-sky-300 dark:bg-sky-700',
  },
  {
    key: 'violet',
    label: 'Violet',
    cellClass: 'bg-violet-100 dark:bg-violet-900/60',
    swatchClass: 'bg-violet-300 dark:bg-violet-700',
  },
];

export const GRID_CELL_COLORS: readonly GridCellColor[] = ['slate', 'rose', 'amber', 'emerald', 'sky', 'violet'];

export const DEFAULT_CELL_FORMAT: GridCellFormat = { bold: false, color: null };

export const isGridCellColor = (value: unknown): value is GridCellColor =>
  typeof value === 'string' && (GRID_CELL_COLORS as readonly string[]).includes(value);

export const colorOption = (key: GridCellColor | 'none' | null | undefined): GridColorOption => {
  return GRID_COLOR_OPTIONS.find((option) => option.key === (key ?? 'none')) ?? GRID_COLOR_OPTIONS[0];
};

/**
 * Coerces anything the API (or a stale cache) can hand us into a valid format.
 * Unknown colors fall back to "no fill" instead of being rendered.
 */
export const normalizeCellFormat = (raw: unknown): GridCellFormat => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CELL_FORMAT };

  const source = raw as { bold?: unknown; color?: unknown; backgroundColor?: unknown };
  const colorValue = source.color ?? source.backgroundColor;

  return {
    bold: source.bold === true,
    color: isGridCellColor(colorValue) ? colorValue : null,
  };
};

export const isSameFormat = (a: GridCellFormat, b: GridCellFormat): boolean =>
  a.bold === b.bold && a.color === b.color;

export const isDefaultFormat = (format: GridCellFormat): boolean => !format.bold && format.color === null;

/** Tailwind class for a stored palette key; never inline CSS from the API. */
export const cellColorClass = (color: GridCellColor | null): string => colorOption(color).cellClass;
