import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emptyCellCache, mergeRange, removeCell, upsertCell, type GridCellCache } from './cellCache.ts';
import { GRID_POLL_INTERVAL_MS } from './constants.ts';
import type { GridCell, GridCellPosition, GridCellQuery } from './types.ts';
import { describeRequestError, isAbortError } from '../services/http';
import type { GridApi } from '../services/gridApi';

export interface UseGridRangeArgs {
  api: GridApi;
  itemId: string;
  range: GridCellQuery;
  enabled?: boolean;
  pollIntervalMs?: number;
}

export interface GridRangeController {
  cells: GridCellCache['cells'];
  /** Cells held client-side (bounded by the cache). */
  cellCount: number;
  rangeKey: string;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  refresh: () => void;
  /** Applies a server-confirmed write to the local cache. */
  applyCell: (cell: GridCell | null, position: GridCellPosition) => void;
}

const toRangeKey = (range: GridCellQuery): string =>
  `${range.rowStart}:${range.rowEnd}:${range.columnStart}:${range.columnEnd}`;

/**
 * Loads only the visible Grid range, polls it at a modest interval, and keeps
 * the result in a bounded cache.
 *
 * - the range is the query key, so scrolling to a new window fetches that
 *   window only;
 * - every request is cancellable and tagged, so a slow response can never
 *   overwrite newer content;
 * - a poll that started before a confirmed write is discarded, so the UI cannot
 *   flash stale posts or formatting;
 * - polling stops when the module unmounts or the tab is hidden.
 */
export const useGridRange = ({
  api,
  itemId,
  range,
  enabled = true,
  pollIntervalMs = GRID_POLL_INTERVAL_MS,
}: UseGridRangeArgs): GridRangeController => {
  const [cache, setCache] = useState<GridCellCache>(emptyCellCache);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const writeSeqRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const itemIdRef = useRef(itemId);
  const rangeRef = useRef(range);

  itemIdRef.current = itemId;
  rangeRef.current = range;

  const rangeKey = toRangeKey(range);

  // A different Grid item must never show the previous item's cells.
  useEffect(() => {
    hasLoadedRef.current = false;
    writeSeqRef.current += 1;
    requestSeqRef.current += 1;
    setCache(emptyCellCache());
    setIsInitialLoading(true);
    setIsRefreshing(false);
    setError(null);
    setLastSyncedAt(null);
  }, [itemId, api]);

  const load = useCallback(
    async (signal: AbortSignal, silent: boolean) => {
      const requestId = requestSeqRef.current + 1;
      requestSeqRef.current = requestId;
      const writeSeqAtStart = writeSeqRef.current;
      const query = rangeRef.current;
      const targetItemId = itemIdRef.current;

      if (!silent) setIsRefreshing(true);

      try {
        const cells = await api.fetchCells(targetItemId, query, { signal });

        // Ignore aborted, superseded, or pre-write responses.
        if (signal.aborted || requestId !== requestSeqRef.current || writeSeqRef.current !== writeSeqAtStart) {
          return;
        }

        setCache((previous) => mergeRange(previous, query, cells));
        hasLoadedRef.current = true;
        setError(null);
        setLastSyncedAt(Date.now());
      } catch (caught) {
        if (isAbortError(caught) || signal.aborted || requestId !== requestSeqRef.current) return;
        setError(describeRequestError(caught, 'Could not load this part of the Grid.'));
      } finally {
        if (requestId === requestSeqRef.current) {
          if (!silent) setIsRefreshing(false);
          setIsInitialLoading(false);
        }
      }
    },
    [api],
  );

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }, []);

  const refresh = useCallback(() => {
    const controller = abortInFlight();
    void load(controller.signal, false);
  }, [abortInFlight, load]);

  // Fetch on range change, then poll the same range while it is on screen.
  useEffect(() => {
    if (!enabled) return;

    const controller = abortInFlight();
    void load(controller.signal, hasLoadedRef.current);

    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const next = abortInFlight();
      void load(next.signal, true);
    };

    const intervalId = window.setInterval(poll, pollIntervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Abort whichever request is currently in flight for this range.
      controllerRef.current?.abort();
    };
    // `load` and `abortInFlight` follow `api`; the range key is the fetch trigger.
  }, [enabled, itemId, api, rangeKey, pollIntervalMs]);

  // Abort anything still running when the module unmounts.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const applyCell = useCallback((cell: GridCell | null, position: GridCellPosition) => {
    // A confirmed write invalidates polls that started before it.
    writeSeqRef.current += 1;

    setCache((previous) => (cell ? upsertCell(previous, cell) : removeCell(previous, position)));
    if (cell) {
      hasLoadedRef.current = true;
      setIsInitialLoading(false);
    }
  }, []);

  return useMemo(
    () => ({
      cells: cache.cells,
      cellCount: Object.keys(cache.cells).length,
      rangeKey,
      isInitialLoading: enabled && isInitialLoading && !hasLoadedRef.current,
      isRefreshing,
      error,
      lastSyncedAt,
      refresh,
      applyCell,
    }),
    [cache.cells, rangeKey, enabled, isInitialLoading, isRefreshing, error, lastSyncedAt, refresh, applyCell],
  );
};
