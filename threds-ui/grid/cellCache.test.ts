import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cachedCellCount,
  emptyCellCache,
  getCachedCell,
  mergeRange,
  rangeKeyOf,
  removeCell,
  upsertCell,
} from './cellCache.ts';
import { emptyGridCell } from './cells.ts';
import type { GridCell, GridCellQuery } from './types.ts';

const limits = { maxCells: 6, maxRanges: 2 };

const cell = (row: number, column: number, format: GridCell['format'] = { bold: false, color: null }): GridCell => ({
  ...emptyGridCell({ row, column }),
  posts: [{ id: `${row}:${column}`, content: 'x', createdAt: 1 }],
  postCount: 1,
  format,
});

const query = (rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): GridCellQuery => ({
  rowStart,
  rowEnd,
  columnStart,
  columnEnd,
});

test('merging a range replaces only that range', () => {
  const first = query(1, 2, 1, 2);
  const second = query(5, 6, 5, 6);

  let cache = mergeRange(emptyCellCache(), first, [cell(1, 1), cell(2, 2)], limits);
  const outside = getCachedCell(cache, { row: 1, column: 1 });
  cache = mergeRange(cache, second, [cell(5, 5)], limits);

  assert.equal(getCachedCell(cache, { row: 1, column: 1 }), outside);
  assert.ok(getCachedCell(cache, { row: 5, column: 5 }));
  assert.equal(cachedCellCount(cache), 3);
});

test('cells that disappeared from a range are dropped', () => {
  const range = query(1, 3, 1, 3);
  let cache = mergeRange(emptyCellCache(), range, [cell(1, 1), cell(2, 2)], limits);
  assert.equal(cachedCellCount(cache), 2);

  cache = mergeRange(cache, range, [cell(1, 1, { bold: true, color: 'sky' })], limits);
  assert.equal(cachedCellCount(cache), 1);
  assert.deepEqual(getCachedCell(cache, { row: 1, column: 1 })?.format, { bold: true, color: 'sky' });
  assert.equal(getCachedCell(cache, { row: 3, column: 3 }), undefined);
});

test('incoming cells outside the requested range are ignored', () => {
  const cache = mergeRange(emptyCellCache(), query(1, 2, 1, 2), [cell(1, 1), cell(50, 50)], limits);

  assert.ok(getCachedCell(cache, { row: 1, column: 1 }));
  assert.equal(getCachedCell(cache, { row: 50, column: 50 }), undefined);
});

test('retention is bounded and evicts the least recently fetched range', () => {
  let cache = emptyCellCache();
  const ranges = [query(1, 5, 1, 5), query(10, 15, 1, 5), query(20, 25, 1, 5)];

  for (const range of ranges) {
    const cells = [cell(range.rowStart, 1), cell(range.rowStart + 1, 2), cell(range.rowStart + 2, 3)];
    cache = mergeRange(cache, range, cells, limits);
    assert.ok(cachedCellCount(cache) <= limits.maxCells);
    assert.ok(cache.ranges.length <= limits.maxRanges);
  }

  // The newest range survives, the oldest is gone.
  assert.ok(getCachedCell(cache, { row: 20, column: 1 }));
  assert.equal(getCachedCell(cache, { row: 1, column: 1 }), undefined);
});

test('upserts and removals keep the bound', () => {
  let cache = mergeRange(emptyCellCache(), query(1, 2, 1, 2), [cell(1, 1)], limits);

  for (let row = 10; row < 40; row += 1) {
    cache = upsertCell(cache, cell(row, 1), limits);
    assert.ok(cachedCellCount(cache) <= limits.maxCells);
  }

  const updated = upsertCell(cache, cell(10, 1, { bold: true, color: 'rose' }), limits);
  assert.deepEqual(getCachedCell(updated, { row: 10, column: 1 })?.format, { bold: true, color: 'rose' });

  const removed = removeCell(updated, { row: 10, column: 1 });
  assert.equal(getCachedCell(removed, { row: 10, column: 1 }), undefined);
  assert.equal(removeCell(removed, { row: 10, column: 1 }), removed);
});

test('range keys are stable and parseable', () => {
  assert.equal(rangeKeyOf(query(1, 20, 3, 9)), '1:20:3:9');
  assert.equal(mergeRange(emptyCellCache(), query(1, 20, 3, 9), [], limits).ranges[0], '1:20:3:9');
});
