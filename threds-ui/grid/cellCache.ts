import { GRID_MAX_CACHED_CELLS, GRID_MAX_CACHED_RANGES } from './constants.ts';
import { cellKey } from './coordinates.ts';
import type { GridCell, GridCellPosition, GridCellQuery } from './types.ts';

/**
 * Client-side cache of persisted Grid cells.
 *
 * Only cells that were actually returned by the API are held, the total number
 * of held cells is capped, and whole ranges are evicted oldest-first. That is
 * what keeps a 500x500 grid from accumulating unbounded client state.
 */
export interface GridCellCache {
  cells: Record<string, GridCell>;
  /** Most recently fetched range keys, newest first. */
  ranges: string[];
}

export interface GridCacheLimits {
  maxCells: number;
  maxRanges: number;
}

const DEFAULT_LIMITS: GridCacheLimits = {
  maxCells: GRID_MAX_CACHED_CELLS,
  maxRanges: GRID_MAX_CACHED_RANGES,
};

export const emptyCellCache = (): GridCellCache => ({ cells: {}, ranges: [] });

export const rangeKeyOf = (query: GridCellQuery): string =>
  `${query.rowStart}:${query.rowEnd}:${query.columnStart}:${query.columnEnd}`;

export const parseRangeKey = (key: string): GridCellQuery | null => {
  const parts = key.split(':').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return null;
  const [rowStart, rowEnd, columnStart, columnEnd] = parts;
  return { rowStart, rowEnd, columnStart, columnEnd };
};

export const isPositionInQuery = (position: GridCellPosition, query: GridCellQuery): boolean =>
  position.row >= query.rowStart &&
  position.row <= query.rowEnd &&
  position.column >= query.columnStart &&
  position.column <= query.columnEnd;

const trimCache = (cache: GridCellCache, protectedRangeKey: string, limits: GridCacheLimits): GridCellCache => {
  let cells = cache.cells;
  let ranges = cache.ranges;

  const dropRange = (rangeKeyToDrop: string) => {
    const query = parseRangeKey(rangeKeyToDrop);
    if (!query) return;

    const next: Record<string, GridCell> = {};
    for (const [key, cell] of Object.entries(cells)) {
      if (isPositionInQuery(cell, query)) continue;
      next[key] = cell;
    }
    cells = next;
  };

  // Cap the number of retained ranges first, so cells never outlive the range
  // they were fetched for.
  while (ranges.length > Math.max(1, limits.maxRanges)) {
    const dropped = ranges[ranges.length - 1];
    ranges = ranges.slice(0, -1);
    if (dropped !== protectedRangeKey) dropRange(dropped);
  }

  // Then cap the number of held cells, dropping the oldest range first.
  while (Object.keys(cells).length > limits.maxCells && ranges.length > 1) {
    const dropped = ranges[ranges.length - 1];
    if (dropped === protectedRangeKey) break;

    ranges = ranges.slice(0, -1);
    dropRange(dropped);
  }

  // Insertion-order fallback: guarantees a hard bound even if a caller keeps
  // upserting cells outside every tracked range.
  while (Object.keys(cells).length > limits.maxCells) {
    const protectedQuery = parseRangeKey(protectedRangeKey);
    const evictable = Object.keys(cells).find((key) => {
      const cell = cells[key];
      return !protectedQuery || !isPositionInQuery(cell, protectedQuery);
    });

    if (!evictable) break;
    const next = { ...cells };
    delete next[evictable];
    cells = next;
  }

  return { cells, ranges };
};

/**
 * Applies a fetched range: cells inside the range are replaced wholesale (so a
 * cleared format disappears), cells outside it keep their identity so memoized
 * cells do not rerender.
 */
export const mergeRange = (
  cache: GridCellCache,
  query: GridCellQuery,
  incoming: readonly GridCell[],
  limits: GridCacheLimits = DEFAULT_LIMITS,
): GridCellCache => {
  const key = rangeKeyOf(query);
  const cells: Record<string, GridCell> = {};

  for (const [cachedKey, cell] of Object.entries(cache.cells)) {
    if (isPositionInQuery(cell, query)) continue;
    cells[cachedKey] = cell;
  }

  for (const cell of incoming) {
    if (!isPositionInQuery(cell, query)) continue;
    cells[cellKey(cell.row, cell.column)] = cell;
  }

  // Keep the new range first; trimCache drops the oldest ranges (and their
  // cells) if the configured number of ranges is exceeded.
  const ranges = [key, ...cache.ranges.filter((range) => range !== key)];

  return trimCache({ cells, ranges }, key, limits);
};

export const upsertCell = (
  cache: GridCellCache,
  cell: GridCell,
  limits: GridCacheLimits = DEFAULT_LIMITS,
): GridCellCache =>
  trimCache(
    {
      ranges: cache.ranges,
      cells: { ...cache.cells, [cellKey(cell.row, cell.column)]: cell },
    },
    cache.ranges[0] ?? '',
    limits,
  );

export const removeCell = (
  cache: GridCellCache,
  position: GridCellPosition,
): GridCellCache => {
  const key = cellKey(position.row, position.column);
  if (!(key in cache.cells)) return cache;

  const cells = { ...cache.cells };
  delete cells[key];
  return { cells, ranges: cache.ranges };
};

export const getCachedCell = (cache: GridCellCache, position: GridCellPosition): GridCell | undefined =>
  cache.cells[cellKey(position.row, position.column)];

export const cachedCellCount = (cache: GridCellCache): number => Object.keys(cache.cells).length;
