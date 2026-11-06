import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_GRID_METRICS, cellOffset, computeVisibleRange, gridContentSize, scrollOffsetsForCell } from './virtualization.ts';

const viewport = { viewportWidth: 800, viewportHeight: 400, rowCount: 500, columnCount: 500 };

test('the visible window is a small slice of a 500x500 grid', () => {
  const range = computeVisibleRange({ ...viewport, scrollTop: 0, scrollLeft: 0 });

  assert.deepEqual(range, { rowStart: 1, rowEnd: 16, columnStart: 1, columnEnd: 9 });
  const renderedCells =
    (range.rowEnd - range.rowStart + 1) * (range.columnEnd - range.columnStart + 1);
  assert.ok(renderedCells < 200, `expected a windowed cell count, received ${renderedCells}`);
});

test('scrolling moves the window instead of growing it', () => {
  const range = computeVisibleRange({ ...viewport, scrollTop: 360, scrollLeft: 256 });

  assert.equal(range.rowStart, 7); // first visible row 11 minus overscan
  assert.equal(range.rowEnd, 26);
  assert.equal(range.columnStart, 1); // first visible column 3 minus overscan, clamped at 1
  assert.equal(range.columnEnd, 11);

  const middle = computeVisibleRange({ ...viewport, scrollTop: 3600, scrollLeft: 1280 });
  assert.equal(middle.rowStart, 97);
  assert.equal(middle.rowEnd, 116);
  assert.equal(middle.columnStart, 9);
  assert.equal(middle.columnEnd, 19);
});

test('the window never runs past the last row or column', () => {
  const range = computeVisibleRange({ ...viewport, scrollTop: 18000, scrollLeft: 64000 });

  assert.equal(range.rowEnd, 500);
  assert.equal(range.columnEnd, 500);
  assert.ok(range.rowStart <= range.rowEnd);
  assert.ok(range.columnStart <= range.columnEnd);
});

test('tiny grids are clamped safely', () => {
  const range = computeVisibleRange({
    scrollTop: 0,
    scrollLeft: 0,
    viewportWidth: 800,
    viewportHeight: 400,
    rowCount: 1,
    columnCount: 1,
  });

  assert.deepEqual(range, { rowStart: 1, rowEnd: 1, columnStart: 1, columnEnd: 1 });
});

test('content size and cell offsets use fixed metrics', () => {
  assert.deepEqual(gridContentSize(500, 500), {
    width: 500 * DEFAULT_GRID_METRICS.columnWidth,
    height: 500 * DEFAULT_GRID_METRICS.rowHeight,
  });
  assert.deepEqual(cellOffset({ row: 1, column: 1 }), { left: 0, top: 0 });
  assert.deepEqual(cellOffset({ row: 2, column: 3 }), {
    left: 2 * DEFAULT_GRID_METRICS.columnWidth,
    top: DEFAULT_GRID_METRICS.rowHeight,
  });
});

test('keyboard navigation can scroll a cell into view', () => {
  const base = { ...viewport, scrollTop: 0, scrollLeft: 0 };

  const toRight = scrollOffsetsForCell({ ...base, position: { row: 1, column: 10 } });
  assert.equal(toRight.scrollTop, 0);
  assert.equal(toRight.scrollLeft, 10 * DEFAULT_GRID_METRICS.columnWidth - 800);

  const toLeft = scrollOffsetsForCell({
    ...base,
    scrollLeft: 1280,
    position: { row: 1, column: 2 },
  });
  assert.equal(toLeft.scrollLeft, DEFAULT_GRID_METRICS.columnWidth);

  // Already visible cells do not move the viewport.
  assert.deepEqual(
    scrollOffsetsForCell({ ...base, position: { row: 3, column: 3 } }),
    { scrollTop: 0, scrollLeft: 0 },
  );

  // The bottom-right corner never over-scrolls past the content.
  const corner = scrollOffsetsForCell({ ...base, position: { row: 500, column: 500 } });
  assert.equal(corner.scrollTop, gridContentSize(500, 500).height - 400);
  assert.equal(corner.scrollLeft, gridContentSize(500, 500).width - 800);
});
