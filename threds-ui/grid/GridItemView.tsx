import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { describeRequestError } from '../services/http';
import type { GridApi } from '../services/gridApi';
import { cellKey, columnIndexToLabel } from './coordinates';
import { formatGridClock } from './format';
import { GridAccessBadge, gridAccessExplanation } from './GridAccessBadge';
import { GridCanvas } from './GridCanvas';
import { GridCellPanel } from './GridCellPanel';
import { GRID_POLL_INTERVAL_MS } from './constants';
import type { GridCellFormat, GridCellPosition, GridCellQuery, GridItem } from './types';
import { useGridRange } from './useGridRange';
import type { GridVisibleRange } from './virtualization';

const INITIAL_RANGE: GridCellQuery = { rowStart: 1, rowEnd: 24, columnStart: 1, columnEnd: 12 };

export interface GridItemViewProps {
  api: GridApi;
  itemId: string;
  onBack: () => void;
}

/**
 * One Grid item: header with access state, the virtualized grid, and the
 * selected-cell panel. Reads and writes go through the typed Grid API only.
 */
export const GridItemView: React.FC<GridItemViewProps> = ({ api, itemId, onBack }) => {
  const [item, setItem] = useState<GridItem | null>(null);
  const [itemStatus, setItemStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemReloadToken, setItemReloadToken] = useState(0);

  const [focusedCell, setFocusedCell] = useState<GridCellPosition>({ row: 1, column: 1 });
  const [openCell, setOpenCell] = useState<GridCellPosition | null>(null);
  const [openedFromKeyboard, setOpenedFromKeyboard] = useState(false);
  const [pendingCellKey, setPendingCellKey] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [returnFocusToken, setReturnFocusToken] = useState(0);
  const [range, setRange] = useState<GridCellQuery>(INITIAL_RANGE);

  const openPositionRef = useRef<GridCellPosition | null>(null);
  openPositionRef.current = openCell;

  // A different item is a fresh visit: no key, no selection carry-over.
  useEffect(() => {
    setItem(null);
    setItemStatus('loading');
    setItemError(null);
    setFocusedCell({ row: 1, column: 1 });
    setOpenCell(null);
    setAccessKey('');
    setPendingCellKey(null);
    setRange(INITIAL_RANGE);
  }, [itemId]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setItemStatus('loading');

    api
      .fetchItem(itemId, { signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setItem(result);
        setItemStatus('ready');
        setItemError(null);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setItemStatus('error');
        setItemError(describeRequestError(error, 'Could not load this Grid.'));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, itemId, itemReloadToken]);

  const grid = useGridRange({ api, itemId, range, enabled: itemStatus === 'ready' });

  const handleRangeChange = useCallback((next: GridVisibleRange) => {
    setRange((previous) =>
      previous.rowStart === next.rowStart &&
      previous.rowEnd === next.rowEnd &&
      previous.columnStart === next.columnStart &&
      previous.columnEnd === next.columnEnd
        ? previous
        : { ...next },
    );
  }, []);

  const handleFocusCell = useCallback((position: GridCellPosition) => {
    setFocusedCell((previous) =>
      previous.row === position.row && previous.column === position.column ? previous : position,
    );
  }, []);

  const handleOpenCell = useCallback((position: GridCellPosition, viaKeyboard = false) => {
    setFocusedCell(position);
    setOpenCell(position);
    setOpenedFromKeyboard(viaKeyboard);
  }, []);

  const closeCellPanel = useCallback(() => {
    setOpenCell(null);
    setReturnFocusToken((token) => token + 1);
  }, []);

  const requireWritablePosition = useCallback((): GridCellPosition | null => {
    const position = openPositionRef.current;
    if (!position) return null;
    return position;
  }, []);

  const handlePost = useCallback(
    async (content: string) => {
      const position = requireWritablePosition();
      if (!position) return;

      const key = cellKey(position.row, position.column);
      setPendingCellKey(key);

      try {
        const cell = await api.addCellPost({
          itemId,
          position,
          content,
          accessKey: accessKey.trim() || undefined,
        });

        grid.applyCell(cell, position);
        setItem((previous) =>
          previous ? { ...previous, updatedAt: Date.now(), postCount: previous.postCount + 1 } : previous,
        );
      } finally {
        setPendingCellKey(null);
      }
    },
    [accessKey, api, grid, itemId, requireWritablePosition],
  );

  const handleFormat = useCallback(
    async (format: GridCellFormat) => {
      const position = requireWritablePosition();
      if (!position) return;

      const key = cellKey(position.row, position.column);
      setPendingCellKey(key);

      try {
        const cell = await api.updateCellFormat({
          itemId,
          position,
          format,
          accessKey: accessKey.trim() || undefined,
        });

        // The cache stores exactly what the server confirmed; `null` removes a
        // cell that no longer has posts or formatting.
        grid.applyCell(cell, position);
      } finally {
        setPendingCellKey(null);
      }
    },
    [accessKey, api, grid, itemId, requireWritablePosition],
  );

  const selectedCell = useMemo(() => {
    if (!openCell) return undefined;
    return grid.cells[cellKey(openCell.row, openCell.column)];
  }, [grid.cells, openCell]);

  const rangeLabel = useMemo(
    () =>
      `Rows ${range.rowStart}–${range.rowEnd} · Columns ${columnIndexToLabel(range.columnStart)}–${columnIndexToLabel(
        range.columnEnd,
      )}`,
    [range],
  );

  if (itemStatus === 'loading' && !item) {
    return <LoadingState message="Loading Grid…" />;
  }

  if (itemStatus === 'error' || !item) {
    return (
      <div className="animate-fade-in">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <i className="fas fa-chevron-left" aria-hidden="true"></i> Grid directory
        </button>

        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {itemError ?? 'That Grid item could not be found.'}
          </p>
          <Button
            variant="secondary"
            className="mx-auto mt-4"
            onClick={() => setItemReloadToken((token) => token + 1)}
          >
            <i className="fas fa-sync-alt mr-2" aria-hidden="true"></i> Try again
          </Button>
        </div>
      </div>
    );
  }

  const pollHint = `live · every ${Math.round(GRID_POLL_INTERVAL_MS / 1000)}s`;

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 self-start text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <i className="fas fa-chevron-left" aria-hidden="true"></i> Grid directory
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[10px] uppercase tracking-wider text-gray-400">Sync</span>
            <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
              {grid.isRefreshing
                ? 'Refreshing…'
                : grid.lastSyncedAt
                  ? `Updated ${formatGridClock(grid.lastSyncedAt)}`
                  : pollHint}
            </span>
            <span className="block text-[10px] text-gray-400">
              {grid.cellCount} cells cached · {rangeLabel}
            </span>
          </div>
          <Button
            variant="secondary"
            onClick={grid.refresh}
            isLoading={grid.isRefreshing}
            title="Reload the visible cells"
            aria-label="Refresh visible cells"
          >
            <i className="fas fa-sync-alt" aria-hidden="true"></i> Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{item.subject}</h1>
        <GridAccessBadge access={item.access} />
        <p className="w-full text-sm text-gray-500 dark:text-gray-400 sm:w-auto">{gridAccessExplanation(item.access)}</p>
      </div>

      {grid.error && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{grid.error}</span>
          <button
            type="button"
            onClick={grid.refresh}
            className="ml-auto font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <GridCanvas
            cells={grid.cells}
            focused={focusedCell}
            openCell={openCell}
            pendingCellKey={pendingCellKey}
            isLoading={grid.isInitialLoading}
            rowCount={item.maxRows}
            columnCount={item.maxColumns}
            onFocusCell={handleFocusCell}
            onOpenCell={handleOpenCell}
            onRangeChange={handleRangeChange}
            returnFocusToken={returnFocusToken}
          />

          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">↑↓←→</kbd> move
            </span>
            <span>
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">Enter</kbd> open cell
            </span>
            <span>
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">Home</kbd>/
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">End</kbd> columns
            </span>
            <span>
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">PgUp</kbd>/
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">PgDn</kbd> rows
            </span>
            <span>
              <kbd className="rounded border border-gray-300 px-1 font-mono dark:border-gray-600">Shift+Enter</kbd> newline
            </span>
          </p>
        </div>

        {openCell && (
          <aside className="w-full lg:w-[360px] lg:shrink-0 lg:sticky lg:top-20">
            <GridCellPanel
              key={cellKey(openCell.row, openCell.column)}
              item={item}
              position={openCell}
              cell={selectedCell}
              accessKey={accessKey}
              onAccessKeyChange={setAccessKey}
              onClose={closeCellPanel}
              onPost={handlePost}
              onFormat={handleFormat}
              focusComposerOnMount={openedFromKeyboard}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
