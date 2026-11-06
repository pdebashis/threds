import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cellSnippets, cellSummary } from './cells';
import {
  GRID_COLUMN_WIDTH,
  GRID_DEFAULT_COLUMNS,
  GRID_DEFAULT_ROWS,
  GRID_HEADER_HEIGHT,
  GRID_ROW_HEADER_WIDTH,
  GRID_ROW_HEIGHT,
} from './constants';
import { cellAriaLabel, cellKey, columnIndexToLabel, moveCellPosition } from './coordinates';
import { cellColorClass } from './palette';
import type { GridCell, GridCellPosition } from './types';
import {
  computeVisibleRange,
  gridContentSize,
  isSameRange,
  scrollOffsetsForCell,
  type GridVisibleRange,
} from './virtualization';

const PAGE_ROWS = 16;

interface GridCellViewProps {
  row: number;
  column: number;
  cell: GridCell | undefined;
  isFocused: boolean;
  isOpen: boolean;
  isPending: boolean;
  onFocusCell: (position: GridCellPosition) => void;
  onOpenCell: (position: GridCellPosition, viaKeyboard?: boolean) => void;
}

/**
 * One rendered cell. Memoized on primitives and the cell object, so a post or
 * format update in one cell does not touch the other cells on screen.
 */
const GridCellView = React.memo(function GridCellView({
  row,
  column,
  cell,
  isFocused,
  isOpen,
  isPending,
  onFocusCell,
  onOpenCell,
}: GridCellViewProps) {
  const snippets = useMemo(() => cellSnippets(cell), [cell]);
  const summary = useMemo(() => cellSummary(cell), [cell]);
  const bold = cell?.format.bold ?? false;
  const colorClass = cellColorClass(cell?.format.color ?? null);

  return (
    <div
      role="gridcell"
      aria-label={cellAriaLabel({ row, column }, summary)}
      aria-rowindex={row}
      aria-colindex={column}
      aria-selected={isOpen}
      tabIndex={isFocused ? 0 : -1}
      data-grid-cell={cellKey(row, column)}
      onClick={() => onOpenCell({ row, column }, false)}
      onFocus={() => onFocusCell({ row, column })}
      className={`absolute cursor-pointer overflow-hidden border-b border-r border-gray-200/80 px-1.5 py-0.5 align-top transition-colors focus:outline-none dark:border-gray-700/70 ${colorClass} ${
        isOpen
          ? 'z-10 ring-2 ring-inset ring-blue-500'
          : isFocused
            ? 'z-10 ring-2 ring-inset ring-blue-400'
            : 'hover:bg-blue-50/70 dark:hover:bg-blue-900/20'
      }`}
      style={{
        left: (column - 1) * GRID_COLUMN_WIDTH,
        top: (row - 1) * GRID_ROW_HEIGHT,
        width: GRID_COLUMN_WIDTH,
        height: GRID_ROW_HEIGHT,
      }}
    >
      <div className="flex h-full flex-col justify-center overflow-hidden">
        {snippets.lines.map((line, index) => (
          <span
            key={index}
            className={`block truncate text-[11px] leading-[13px] text-gray-700 dark:text-gray-200 ${
              bold ? 'font-bold' : ''
            }`}
          >
            {line}
          </span>
        ))}
      </div>

      {snippets.hiddenCount > 0 && (
        <span className="absolute right-1 top-0.5 rounded bg-gray-900/75 px-1 text-[9px] font-semibold text-white dark:bg-gray-100/85 dark:text-gray-900">
          +{snippets.hiddenCount}
        </span>
      )}
      {isPending && (
        <span
          className="absolute bottom-1 right-1 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
          aria-hidden="true"
        />
      )}
    </div>
  );
});

export interface GridCanvasProps {
  cells: Record<string, GridCell>;
  focused: GridCellPosition;
  openCell: GridCellPosition | null;
  pendingCellKey?: string | null;
  isLoading?: boolean;
  rowCount?: number;
  columnCount?: number;
  onFocusCell: (position: GridCellPosition) => void;
  onOpenCell: (position: GridCellPosition, viaKeyboard?: boolean) => void;
  onRangeChange: (range: GridVisibleRange) => void;
  returnFocusToken?: number;
}

/**
 * Virtualized Grid surface.
 *
 * Only the rows and columns inside the viewport (plus a small overscan) are
 * mounted, so a 500x500 item renders a few hundred nodes, never 250,000. Header
 * strips are separate layers translated by the current scroll offset, which
 * keeps them pinned without nesting sticky containers.
 */
export const GridCanvas: React.FC<GridCanvasProps> = ({
  cells,
  focused,
  openCell,
  pendingCellKey = null,
  isLoading = false,
  rowCount = GRID_DEFAULT_ROWS,
  columnCount = GRID_DEFAULT_COLUMNS,
  onFocusCell,
  onOpenCell,
  onRangeChange,
  returnFocusToken = 0,
}) => {
  const boundedRows = Math.max(1, Math.min(GRID_DEFAULT_ROWS, Math.trunc(rowCount) || 1));
  const boundedColumns = Math.max(1, Math.min(GRID_DEFAULT_COLUMNS, Math.trunc(columnCount) || 1));

  const bodyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastRangeRef = useRef<GridVisibleRange | null>(null);

  const [scroll, setScroll] = useState({ scrollTop: 0, scrollLeft: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [hasGridFocus, setHasGridFocus] = useState(false);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const element = bodyRef.current;
      if (!element) return;
      setScroll({ scrollTop: element.scrollTop, scrollLeft: element.scrollLeft });
    });
  }, []);

  // The header strips sit outside the scrolling body, so a wheel over a header
  // should still scroll the grid.
  const forwardWheelToBody = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const element = bodyRef.current;
    if (!element) return;
    element.scrollTop += event.deltaY;
    element.scrollLeft += event.deltaX;
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Measure the scrolling body so the visible window is derived from real size.
  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;

    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const range = useMemo(
    () =>
      computeVisibleRange({
        scrollTop: scroll.scrollTop,
        scrollLeft: scroll.scrollLeft,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        rowCount: boundedRows,
        columnCount: boundedColumns,
      }),
    [scroll.scrollTop, scroll.scrollLeft, viewport.width, viewport.height, boundedRows, boundedColumns],
  );

  // Tell the owner which window to fetch, but only when it actually moves.
  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return;
    if (lastRangeRef.current && isSameRange(lastRangeRef.current, range)) return;

    lastRangeRef.current = range;
    onRangeChange(range);
  }, [range, viewport.width, viewport.height, onRangeChange]);

  const content = useMemo(
    () => gridContentSize(boundedRows, boundedColumns),
    [boundedRows, boundedColumns],
  );

  // Keep the focused cell visible when arrowing past the viewport edge.
  useEffect(() => {
    if (!hasGridFocus) return;

    const element = bodyRef.current;
    if (!element) return;

    const offsets = scrollOffsetsForCell({
      position: focused,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
      viewportWidth: element.clientWidth,
      viewportHeight: element.clientHeight,
      rowCount: boundedRows,
      columnCount: boundedColumns,
    });

    if (Math.abs(element.scrollLeft - offsets.scrollLeft) > 0.5) {
      element.scrollLeft = offsets.scrollLeft;
    }
    if (Math.abs(element.scrollTop - offsets.scrollTop) > 0.5) {
      element.scrollTop = offsets.scrollTop;
    }
  }, [focused, hasGridFocus, boundedRows, boundedColumns]);

  // Focus follows selection when the grid owns focus, after a virtualization
  // pass has had a chance to render the target cell.
  useEffect(() => {
    if (!hasGridFocus) return;

    const container = bodyRef.current;
    if (!container) return;

    const selector = `[data-grid-cell="${cellKey(focused.row, focused.column)}"]`;
    const target = container.querySelector<HTMLElement>(selector);
    if (target && document.activeElement !== target) {
      target.focus({ preventScroll: true });
    }
  }, [
    focused.row,
    focused.column,
    hasGridFocus,
    range.rowStart,
    range.rowEnd,
    range.columnStart,
    range.columnEnd,
  ]);

  // Closing the cell panel returns focus to the grid.
  useEffect(() => {
    if (returnFocusToken === 0 || !bodyRef.current) return;

    const container = bodyRef.current;
    const selector = `[data-grid-cell="${cellKey(focused.row, focused.column)}"]`;
    const target = container.querySelector<HTMLElement>(selector);
    target?.focus({ preventScroll: true });
  }, [returnFocusToken, focused.row, focused.column]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const jump = event.ctrlKey || event.metaKey;
      let next: GridCellPosition | null = null;

      switch (event.key) {
        case 'ArrowUp':
          next = moveCellPosition(focused, { rows: jump ? -10 : -1 }, boundedRows, boundedColumns);
          break;
        case 'ArrowDown':
          next = moveCellPosition(focused, { rows: jump ? 10 : 1 }, boundedRows, boundedColumns);
          break;
        case 'ArrowLeft':
          next = moveCellPosition(focused, { columns: jump ? -10 : -1 }, boundedRows, boundedColumns);
          break;
        case 'ArrowRight':
          next = moveCellPosition(focused, { columns: jump ? 10 : 1 }, boundedRows, boundedColumns);
          break;
        case 'PageUp':
          next = moveCellPosition(focused, { rows: -PAGE_ROWS }, boundedRows, boundedColumns);
          break;
        case 'PageDown':
          next = moveCellPosition(focused, { rows: PAGE_ROWS }, boundedRows, boundedColumns);
          break;
        case 'Home':
          next = jump ? { row: 1, column: 1 } : { row: focused.row, column: 1 };
          break;
        case 'End':
          next = jump
            ? { row: boundedRows, column: boundedColumns }
            : { row: focused.row, column: boundedColumns };
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          // Opening from the keyboard moves focus into the cell panel.
          onOpenCell(focused, true);
          return;
        default:
          return;
      }

      event.preventDefault();
      if (next.row !== focused.row || next.column !== focused.column) {
        onFocusCell(next);
      }
    },
    [boundedColumns, boundedRows, focused, onFocusCell, onOpenCell],
  );

  const columns = useMemo(() => {
    const list: number[] = [];
    for (let column = range.columnStart; column <= range.columnEnd; column += 1) list.push(column);
    return list;
  }, [range.columnStart, range.columnEnd]);

  const rows = useMemo(() => {
    const list: number[] = [];
    for (let row = range.rowStart; row <= range.rowEnd; row += 1) list.push(row);
    return list;
  }, [range.rowStart, range.rowEnd]);

  const cellsToRender: React.ReactNode[] = [];
  for (const row of rows) {
    for (const column of columns) {
      const key = cellKey(row, column);
      cellsToRender.push(
        <GridCellView
          key={key}
          row={row}
          column={column}
          cell={cells[key]}
          isFocused={focused.row === row && focused.column === column}
          isOpen={openCell !== null && openCell.row === row && openCell.column === column}
          isPending={pendingCellKey === key}
          onFocusCell={onFocusCell}
          onOpenCell={onOpenCell}
        />,
      );
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
      style={{ height: '62vh', minHeight: 320 }}
      data-testid="grid-canvas"
    >
      {/* Column headers (Excel labels derived from numeric indices). */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex overflow-hidden border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60"
        style={{ height: GRID_HEADER_HEIGHT }}
        aria-hidden="true"
        onWheel={forwardWheelToBody}
      >
        <div
          className="flex shrink-0 items-center justify-center border-r border-gray-200 font-mono text-[10px] text-gray-500 dark:border-gray-700 dark:text-gray-400"
          style={{ width: GRID_ROW_HEADER_WIDTH }}
        >
          {boundedRows}×{boundedColumns}
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: content.width, transform: `translateX(${-scroll.scrollLeft}px)` }}
          >
            {columns.map((column) => (
              <div
                key={column}
                className="absolute top-0 flex items-center justify-center border-r border-gray-200 font-mono text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
                style={{
                  left: (column - 1) * GRID_COLUMN_WIDTH,
                  width: GRID_COLUMN_WIDTH,
                  height: GRID_HEADER_HEIGHT,
                }}
              >
                {columnIndexToLabel(column)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row headers (1-based row numbers). */}
      <div
        className="absolute bottom-0 left-0 z-10 overflow-hidden border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60"
        style={{ top: GRID_HEADER_HEIGHT, width: GRID_ROW_HEADER_WIDTH }}
        aria-hidden="true"
        onWheel={forwardWheelToBody}
      >
        <div
          className="absolute left-0 top-0 w-full"
          style={{ height: content.height, transform: `translateY(${-scroll.scrollTop}px)` }}
        >
          {rows.map((row) => (
            <div
              key={row}
              className="absolute left-0 flex w-full items-center justify-center border-b border-gray-200 font-mono text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400"
              style={{ top: (row - 1) * GRID_ROW_HEIGHT, height: GRID_ROW_HEIGHT }}
            >
              {row}
            </div>
          ))}
        </div>
      </div>

      {/* Scrolling body: the only element with 250k cells worth of layout. */}
      <div
        ref={bodyRef}
        role="grid"
        aria-label="Grid cells"
        aria-rowcount={boundedRows}
        aria-colcount={boundedColumns}
        aria-readonly={false}
        tabIndex={-1}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          if (event.target === event.currentTarget) return;
          setHasGridFocus(true);
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setHasGridFocus(false);
        }}
        className="absolute overflow-auto overscroll-contain bg-gray-50/40 outline-none dark:bg-gray-900/20"
        style={{ top: GRID_HEADER_HEIGHT, left: GRID_ROW_HEADER_WIDTH, right: 0, bottom: 0 }}
      >
        <div style={{ position: 'relative', width: content.width, height: content.height }}>
          {cellsToRender}
        </div>
      </div>

      {isLoading && (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-gray-900/50"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow dark:bg-gray-800 dark:text-gray-300">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
            Loading cells…
          </div>
        </div>
      )}
    </div>
  );
};
