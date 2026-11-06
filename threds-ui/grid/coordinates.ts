import { GRID_DEFAULT_COLUMNS, GRID_DEFAULT_ROWS, GRID_MIN_COLUMN, GRID_MIN_ROW } from './constants.ts';
import type { GridCellPosition } from './types.ts';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * 1-based column index -> spreadsheet label (1 => A, 26 => Z, 27 => AA).
 * The Grid stores numbers; only the UI ever shows letters.
 */
export const columnIndexToLabel = (column: number): string => {
  if (!Number.isInteger(column) || column < 1) {
    throw new RangeError(`Column index must be a positive integer, received ${column}`);
  }

  let remaining = column;
  let label = '';
  while (remaining > 0) {
    const letterIndex = (remaining - 1) % 26;
    label = LETTERS[letterIndex] + label;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return label;
};

/**
 * Spreadsheet label -> 1-based column index ("AA" => 27). Throws on anything
 * that is not a plain A-Z label so a bad URL can never become a cell.
 */
export const columnLabelToIndex = (label: string): number => {
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]{1,4}$/.test(normalized)) {
    throw new RangeError(`Invalid column label: ${label}`);
  }

  let index = 0;
  for (const char of normalized) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
};

export const cellKey = (row: number, column: number): string => `${row}:${column}`;

export const parseCellKey = (key: string): GridCellPosition | null => {
  const match = /^(\d+):(\d+)$/.exec(key);
  if (!match) return null;

  const row = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  return { row, column };
};

export const clampRow = (row: number, maxRows: number = GRID_DEFAULT_ROWS): number => {
  if (!Number.isFinite(row)) return GRID_MIN_ROW;
  const rounded = Math.trunc(row);
  return Math.min(Math.max(maxRows, GRID_MIN_ROW), Math.max(GRID_MIN_ROW, rounded));
};

export const clampColumn = (column: number, maxColumns: number = GRID_DEFAULT_COLUMNS): number => {
  if (!Number.isFinite(column)) return GRID_MIN_COLUMN;
  const rounded = Math.trunc(column);
  return Math.min(Math.max(maxColumns, GRID_MIN_COLUMN), Math.max(GRID_MIN_COLUMN, rounded));
};

export const clampPosition = (
  position: GridCellPosition,
  maxRows: number = GRID_DEFAULT_ROWS,
  maxColumns: number = GRID_DEFAULT_COLUMNS,
): GridCellPosition => ({
  row: clampRow(position.row, maxRows),
  column: clampColumn(position.column, maxColumns),
});

export const isCellWithinBounds = (
  position: GridCellPosition,
  maxRows: number = GRID_DEFAULT_ROWS,
  maxColumns: number = GRID_DEFAULT_COLUMNS,
): boolean =>
  Number.isInteger(position.row) &&
  Number.isInteger(position.column) &&
  position.row >= GRID_MIN_ROW &&
  position.column >= GRID_MIN_COLUMN &&
  position.row <= maxRows &&
  position.column <= maxColumns;

/** Clamped relative move used by arrow-key navigation. */
export const moveCellPosition = (
  position: GridCellPosition,
  delta: { rows?: number; columns?: number },
  maxRows: number = GRID_DEFAULT_ROWS,
  maxColumns: number = GRID_DEFAULT_COLUMNS,
): GridCellPosition =>
  clampPosition(
    {
      row: position.row + (delta.rows ?? 0),
      column: position.column + (delta.columns ?? 0),
    },
    maxRows,
    maxColumns,
  );

/** Human readable address used in the cell panel and aria labels. */
export const cellAddressLabel = (position: GridCellPosition): string => {
  return `${columnIndexToLabel(position.column)}${position.row}`;
};

export const cellAriaLabel = (position: GridCellPosition, summary: string): string => {
  const address = cellAddressLabel(position);
  return summary ? `${address}: ${summary}` : `${address}: empty cell`;
};

/** Reads a `?cell=AB12` style address without trusting it. */
export const parseCellAddress = (raw: string): GridCellPosition | null => {
  const match = /^([A-Za-z]{1,4})(\d{1,4})$/.exec(raw.trim());
  if (!match) return null;

  const row = Number(match[2]);
  if (!Number.isInteger(row) || row < GRID_MIN_ROW) return null;

  try {
    const column = columnLabelToIndex(match[1]);
    return column >= GRID_MIN_COLUMN ? { row, column } : null;
  } catch {
    return null;
  }
};
