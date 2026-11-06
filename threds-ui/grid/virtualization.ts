import {
  GRID_COLUMN_WIDTH,
  GRID_HEADER_HEIGHT,
  GRID_OVERSCAN_COLUMNS,
  GRID_OVERSCAN_ROWS,
  GRID_ROW_HEADER_WIDTH,
  GRID_ROW_HEIGHT,
} from './constants.ts';
import type { GridCellPosition } from './types.ts';

export interface GridViewportMetrics {
  rowHeight: number;
  columnWidth: number;
  headerHeight: number;
  rowHeaderWidth: number;
  overscanRows: number;
  overscanColumns: number;
}

export const DEFAULT_GRID_METRICS: GridViewportMetrics = {
  rowHeight: GRID_ROW_HEIGHT,
  columnWidth: GRID_COLUMN_WIDTH,
  headerHeight: GRID_HEADER_HEIGHT,
  rowHeaderWidth: GRID_ROW_HEADER_WIDTH,
  overscanRows: GRID_OVERSCAN_ROWS,
  overscanColumns: GRID_OVERSCAN_COLUMNS,
};

/** 1-based, inclusive, and clamped to the item's row/column count. */
export interface GridVisibleRange {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
}

export interface GridScrollState {
  scrollTop: number;
  scrollLeft: number;
  /** Size of the scrolling body, i.e. excluding the header strips. */
  viewportWidth: number;
  viewportHeight: number;
}

export interface GridVisibleRangeInput extends GridScrollState {
  rowCount: number;
  columnCount: number;
  metrics?: GridViewportMetrics;
}

const clampIndex = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Derives which rows/columns are on screen from scroll position and viewport
 * size. This is why the grid never mounts 250,000 cells: only the returned
 * window (plus a small overscan) is rendered.
 */
export const computeVisibleRange = ({
  scrollTop,
  scrollLeft,
  viewportWidth,
  viewportHeight,
  rowCount,
  columnCount,
  metrics = DEFAULT_GRID_METRICS,
}: GridVisibleRangeInput): GridVisibleRange => {
  const safeRowCount = Math.max(1, Math.trunc(rowCount) || 1);
  const safeColumnCount = Math.max(1, Math.trunc(columnCount) || 1);
  const { rowHeight, columnWidth } = metrics;

  const firstRow = Math.floor(Math.max(0, scrollTop) / rowHeight) + 1;
  const lastRow = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / rowHeight);
  const firstColumn = Math.floor(Math.max(0, scrollLeft) / columnWidth) + 1;
  const lastColumn = Math.ceil((Math.max(0, scrollLeft) + Math.max(0, viewportWidth)) / columnWidth);

  return {
    rowStart: clampIndex(firstRow - metrics.overscanRows, 1, safeRowCount),
    rowEnd: clampIndex(lastRow + metrics.overscanRows, 1, safeRowCount),
    columnStart: clampIndex(firstColumn - metrics.overscanColumns, 1, safeColumnCount),
    columnEnd: clampIndex(lastColumn + metrics.overscanColumns, 1, safeColumnCount),
  };
};

export const isSameRange = (a: GridVisibleRange, b: GridVisibleRange): boolean =>
  a.rowStart === b.rowStart &&
  a.rowEnd === b.rowEnd &&
  a.columnStart === b.columnStart &&
  a.columnEnd === b.columnEnd;

/** Grid body size in pixels; header strips live outside the scrolling body. */
export const gridContentSize = (
  rowCount: number,
  columnCount: number,
  metrics: GridViewportMetrics = DEFAULT_GRID_METRICS,
): { width: number; height: number } => ({
  width: Math.max(0, columnCount) * metrics.columnWidth,
  height: Math.max(0, rowCount) * metrics.rowHeight,
});

/** Body-relative pixel offset of a cell (headers excluded). */
export const cellOffset = (
  position: GridCellPosition,
  metrics: GridViewportMetrics = DEFAULT_GRID_METRICS,
): { left: number; top: number } => ({
  left: (Math.max(1, position.column) - 1) * metrics.columnWidth,
  top: (Math.max(1, position.row) - 1) * metrics.rowHeight,
});

/**
 * Scroll offsets that bring a cell fully into view. Used by keyboard navigation
 * so arrowing past the viewport edge scrolls instead of losing focus.
 */
export const scrollOffsetsForCell = ({
  position,
  scrollTop,
  scrollLeft,
  viewportWidth,
  viewportHeight,
  rowCount,
  columnCount,
  metrics = DEFAULT_GRID_METRICS,
}: GridVisibleRangeInput & { position: GridCellPosition }): { scrollTop: number; scrollLeft: number } => {
  const { left, top } = cellOffset(position, metrics);
  const content = gridContentSize(rowCount, columnCount, metrics);

  let nextLeft = Math.max(0, scrollLeft);
  let nextTop = Math.max(0, scrollTop);

  if (left < nextLeft) {
    nextLeft = left;
  } else if (left + metrics.columnWidth > nextLeft + viewportWidth) {
    nextLeft = left + metrics.columnWidth - viewportWidth;
  }

  if (top < nextTop) {
    nextTop = top;
  } else if (top + metrics.rowHeight > nextTop + viewportHeight) {
    nextTop = top + metrics.rowHeight - viewportHeight;
  }

  const maxLeft = Math.max(0, content.width - viewportWidth);
  const maxTop = Math.max(0, content.height - viewportHeight);

  return {
    scrollLeft: clampIndex(nextLeft, 0, maxLeft),
    scrollTop: clampIndex(nextTop, 0, maxTop),
  };
};
