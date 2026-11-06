import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CELL_FORMAT,
  GRID_CELL_COLORS,
  GRID_COLOR_OPTIONS,
  cellColorClass,
  colorOption,
  isDefaultFormat,
  isGridCellColor,
  isSameFormat,
  normalizeCellFormat,
} from './palette.ts';

test('the palette is finite and only contains safe background classes', () => {
  assert.ok(GRID_CELL_COLORS.length >= 4);
  assert.equal(new Set(GRID_COLOR_OPTIONS.map((option) => option.key)).size, GRID_COLOR_OPTIONS.length);
  assert.equal(GRID_COLOR_OPTIONS[0].key, 'none');

  for (const option of GRID_COLOR_OPTIONS) {
    const cellClasses = option.cellClass.split(/\s+/).filter(Boolean);
    for (const token of cellClasses) {
      assert.match(token, /^(dark:)?bg-[a-z]+(-\d{2,3})?(\/\d{2})?$/);
    }
    // No inline CSS, no HTML, no arbitrary values.
    assert.ok(!option.cellClass.includes('['));
    assert.ok(!option.cellClass.includes('style'));
    assert.match(option.swatchClass, /^bg-/);
  }
  assert.equal((GRID_CELL_COLORS as readonly string[]).includes('none'), false);
});

test('only palette keys are accepted as colours', () => {
  assert.equal(isGridCellColor('amber'), true);
  assert.equal(isGridCellColor('none'), false);
  assert.equal(isGridCellColor('red'), false);
  assert.equal(isGridCellColor('#ff0000'), false);
  assert.equal(isGridCellColor('expression(alert(1))'), false);
  assert.equal(isGridCellColor(null), false);
});

test('formats are normalized defensively', () => {
  assert.deepEqual(normalizeCellFormat(null), DEFAULT_CELL_FORMAT);
  assert.deepEqual(normalizeCellFormat(undefined), DEFAULT_CELL_FORMAT);
  assert.deepEqual(normalizeCellFormat('amber'), DEFAULT_CELL_FORMAT);
  assert.deepEqual(normalizeCellFormat({ bold: true }), { bold: true, color: null });
  assert.deepEqual(normalizeCellFormat({ bold: false, color: 'rose' }), { bold: false, color: 'rose' });
  // "none" is a UI concept; it is never persisted as a colour.
  assert.deepEqual(normalizeCellFormat({ color: 'none' }), { bold: false, color: null });
  assert.deepEqual(normalizeCellFormat({ color: '#123456' }), { bold: false, color: null });
  // Snake_case payloads still work if the serializer ever sends them.
  assert.deepEqual(normalizeCellFormat({ bold: true, background_color: 'violet' }), { bold: true, color: null });
});

test('format equality and emptiness drive request suppression', () => {
  assert.equal(isSameFormat({ bold: false, color: null }, { bold: false, color: null }), true);
  assert.equal(isSameFormat({ bold: true, color: null }, { bold: false, color: null }), false);
  assert.equal(isSameFormat({ bold: false, color: 'sky' }, { bold: false, color: null }), false);

  assert.equal(isDefaultFormat({ bold: false, color: null }), true);
  assert.equal(isDefaultFormat({ bold: false, color: 'amber' }), false);
  assert.equal(isDefaultFormat({ bold: true, color: null }), false);
});

test('colour lookups never throw on unknown values', () => {
  assert.equal(colorOption('emerald').key, 'emerald');
  assert.equal(colorOption(null).key, 'none');
  assert.equal(colorOption(undefined).key, 'none');
  // @ts-expect-error -- runtime payloads are untrusted
  assert.equal(colorOption('not-a-colour').key, 'none');
  assert.equal(cellColorClass(null), '');
  assert.ok(cellColorClass('amber').includes('bg-amber'));
});
