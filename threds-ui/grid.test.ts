import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cellAddressLabel,
  cellKey,
  clampColumn,
  clampPosition,
  clampRow,
  columnIndexToLabel,
  columnLabelToIndex,
  isCellWithinBounds,
  moveCellPosition,
  parseCellAddress,
  parseCellKey,
} from './grid/coordinates.ts';
import { GRID_DEFAULT_COLUMNS, GRID_DEFAULT_ROWS } from './grid/constants.ts';

test('column indices convert to spreadsheet labels', () => {
  assert.equal(columnIndexToLabel(1), 'A');
  assert.equal(columnIndexToLabel(26), 'Z');
  assert.equal(columnIndexToLabel(27), 'AA');
  assert.equal(columnIndexToLabel(52), 'AZ');
  assert.equal(columnIndexToLabel(53), 'BA');
  assert.equal(columnIndexToLabel(500), 'SF');
  assert.equal(columnIndexToLabel(GRID_DEFAULT_COLUMNS), 'SF');
});

test('spreadsheet labels convert back to indices', () => {
  assert.equal(columnLabelToIndex('A'), 1);
  assert.equal(columnLabelToIndex('z'), 26);
  assert.equal(columnLabelToIndex('AA'), 27);
  assert.equal(columnLabelToIndex('SF'), 500);
  assert.equal(columnLabelToIndex(' SF '), 500);
});

test('label conversion round-trips for every supported column', () => {
  for (let column = 1; column <= GRID_DEFAULT_COLUMNS; column += 1) {
    assert.equal(columnLabelToIndex(columnIndexToLabel(column)), column);
  }
});

test('invalid labels and indices are rejected', () => {
  for (const bad of [0, -1, 1.5, Number.NaN, Infinity]) {
    assert.throws(() => columnIndexToLabel(bad), RangeError);
  }
  for (const bad of ['', 'A1', '1', 'A-B', 'ABCDE', '  ']) {
    assert.throws(() => columnLabelToIndex(bad), RangeError);
  }
});

test('rows and columns are 1-based and clamped to the item', () => {
  assert.equal(clampRow(0), 1);
  assert.equal(clampRow(-20), 1);
  assert.equal(clampRow(501), 500);
  assert.equal(clampRow(42), 42);
  assert.equal(clampColumn(0), 1);
  assert.equal(clampColumn(999), 500);
  assert.equal(clampRow(7, 10), 7);
  assert.equal(clampRow(99, 10), 10);
  assert.deepEqual(clampPosition({ row: 900, column: -3 }), { row: 500, column: 1 });
});

test('cell keys round-trip and reject malformed input', () => {
  assert.equal(cellKey(12, 3), '12:3');
  assert.deepEqual(parseCellKey('12:3'), { row: 12, column: 3 });
  for (const bad of ['', '12', '12:', ':3', 'a:b', '1.5:2', '-1:2']) {
    assert.equal(parseCellKey(bad), null);
  }
});

test('bounds checks only accept persisted coordinate space', () => {
  assert.equal(isCellWithinBounds({ row: 1, column: 1 }), true);
  assert.equal(isCellWithinBounds({ row: 500, column: 500 }), true);
  assert.equal(isCellWithinBounds({ row: 501, column: 1 }), false);
  assert.equal(isCellWithinBounds({ row: 1, column: 0 }), false);
  assert.equal(isCellWithinBounds({ row: 1.2, column: 1 }), false);
});

test('keyboard moves stay inside the grid', () => {
  assert.deepEqual(moveCellPosition({ row: 1, column: 1 }, { rows: -1 }), { row: 1, column: 1 });
  assert.deepEqual(moveCellPosition({ row: 1, column: 1 }, { columns: -1 }), { row: 1, column: 1 });
  assert.deepEqual(moveCellPosition({ row: 500, column: 500 }, { rows: 1, columns: 1 }), {
    row: 500,
    column: 500,
  });
  assert.deepEqual(moveCellPosition({ row: 10, column: 4 }, { rows: 2, columns: -1 }), {
    row: 12,
    column: 3,
  });
});

test('cell addresses are readable and parseable', () => {
  assert.equal(cellAddressLabel({ row: 14, column: 28 }), 'AB14');
  assert.deepEqual(parseCellAddress('AB14'), { row: 14, column: 28 });
  assert.deepEqual(parseCellAddress('a1'), { row: 1, column: 1 });
  assert.equal(parseCellAddress('nope'), null);
  assert.equal(parseCellAddress('A0'), null);
});
