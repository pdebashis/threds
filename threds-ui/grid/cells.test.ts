import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cellFormatOrDefault,
  cellSnippets,
  cellSummary,
  emptyGridCell,
  isCellEmpty,
  normalizeGridCell,
  normalizeGridPost,
  sortCellPosts,
} from './cells.ts';
import type { GridCell, GridPost } from './types.ts';

const post = (id: string, createdAt: number, content = `post ${id}`): GridPost => ({ id, content, createdAt });

test('cell posts are ordered deterministically without mutating input', () => {
  const input = [post('b', 200), post('a', 100), post('c', 200)];
  const sorted = sortCellPosts(input);

  assert.deepEqual(sorted.map((entry) => entry.id), ['a', 'b', 'c']);
  assert.deepEqual(input.map((entry) => entry.id), ['b', 'a', 'c']);
  assert.deepEqual(sortCellPosts(sorted).map((entry) => entry.id), ['a', 'b', 'c']);
});

test('malformed posts are dropped instead of rendered', () => {
  assert.equal(normalizeGridPost(null), null);
  assert.equal(normalizeGridPost({ content: 'no id' }), null);
  assert.equal(normalizeGridPost({ id: 'x' }), null);
  assert.deepEqual(normalizeGridPost({ id: 'x', content: 'hi', timestamp: 5 }), {
    id: 'x',
    content: 'hi',
    createdAt: 5,
  });
});

test('cells are normalized into the fixed coordinate space', () => {
  assert.equal(normalizeGridCell({ row: 0, column: 1 }), null);
  assert.equal(normalizeGridCell({ row: 1, column: 501 }), null);
  assert.equal(normalizeGridCell({ row: '2', column: 2 }), null);
  assert.equal(normalizeGridCell({ row: 501, column: 1 }, 500, 500), null);
  assert.ok(normalizeGridCell({ row: 1, column: 1 }, 500, 500));
});

test('a cell keeps its posts ordered and its count trustworthy', () => {
  const cell = normalizeGridCell({
    row: 3,
    column: 4,
    format: { bold: true, color: 'amber' },
    postCount: 9,
    posts: [post('b', 200), post('a', 100)],
    updatedAt: 300,
  });

  assert.ok(cell);
  assert.deepEqual(cell.posts.map((entry) => entry.id), ['a', 'b']);
  assert.equal(cell.postCount, 9); // the server reported more than this payload holds
  assert.deepEqual(cell.format, { bold: true, color: 'amber' });
  assert.equal(cell.updatedAt, 300);

  const withoutCount = normalizeGridCell({ row: 1, column: 1, posts: [post('a', 1)] });
  assert.equal(withoutCount?.postCount, 1);
});

test('unknown formats collapse to the default instead of being rendered', () => {
  const cell = normalizeGridCell({
    row: 1,
    column: 1,
    format: { bold: 'yes', color: 'url(javascript:alert(1))' },
    posts: [],
  });

  assert.ok(cell);
  assert.deepEqual(cell.format, { bold: false, color: null });
  assert.deepEqual(cellFormatOrDefault(undefined), { bold: false, color: null });
});

test('snippets are plain single lines with a hidden count', () => {
  const cell: GridCell = {
    ...emptyGridCell({ row: 1, column: 1 }),
    posts: [post('a', 1, 'first\nline\nwrapped'), post('b', 2, '  second   line  '), post('c', 3, 'third')],
    postCount: 5,
  };

  const snippets = cellSnippets(cell);
  assert.deepEqual(snippets.lines, ['first line wrapped', 'second line']);
  assert.equal(snippets.hiddenCount, 3);

  assert.deepEqual(cellSnippets(undefined), { lines: [], hiddenCount: 0 });
});

test('empty cells are recognised, including format-only cells', () => {
  const empty = emptyGridCell({ row: 2, column: 2 });
  assert.equal(isCellEmpty(empty), true);
  assert.equal(isCellEmpty(undefined), true);

  assert.equal(isCellEmpty({ ...empty, format: { bold: true, color: null } }), false);
  assert.equal(isCellEmpty({ ...empty, posts: [post('a', 1)] }), false);
});

test('cell summaries describe what a screen reader hears', () => {
  const cell: GridCell = {
    ...emptyGridCell({ row: 1, column: 1 }),
    posts: [post('a', 1, 'hello world'), post('b', 2, 'again')],
    postCount: 3,
  };

  assert.equal(cellSummary(cell), 'hello world (+2 more)');
  assert.equal(cellSummary(undefined), '');
});
