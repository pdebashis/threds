import test from 'node:test';
import assert from 'node:assert/strict';

import type { BoardType } from './types.ts';
import { normalizePath, parseRoute, routeToPath } from './routing.ts';

const BOARD_R = 'r' as BoardType;

test('legacy imageboard URLs keep their existing meaning', () => {
  assert.deepEqual(parseRoute(''), { module: 'imageboard', isHomeView: true });
  assert.deepEqual(parseRoute('/'), { module: 'imageboard', isHomeView: true });
  assert.deepEqual(parseRoute('#/'), { module: 'imageboard', isHomeView: true });

  assert.deepEqual(parseRoute('#/board/w'), {
    module: 'imageboard',
    isHomeView: false,
    currentBoard: 'w',
  });

  assert.deepEqual(parseRoute('#/board/n/thread/thread-1'), {
    module: 'imageboard',
    isHomeView: false,
    currentBoard: 'n',
    activeThreadId: 'thread-1',
  });

  // Unknown paths have always fallen back to the imageboard directory.
  assert.deepEqual(parseRoute('#/nonsense/route'), { module: 'imageboard', isHomeView: true });
  assert.deepEqual(parseRoute('#/board'), { module: 'imageboard', isHomeView: true });
});

test('normalizePath keeps the original cleanup rules', () => {
  assert.equal(normalizePath('#/board/r'), 'board/r');
  assert.equal(normalizePath('#board/r'), 'board/r');
  // The original parser only trims literal "+" path markers, not slashes.
  assert.equal(normalizePath('/+board/r/+'), 'board/r');
  assert.equal(normalizePath('board/r/'), 'board/r/');
  // A trailing slash still resolves to the same board because empty segments
  // are filtered out.
  assert.deepEqual(parseRoute('#/board/r/'), parseRoute('#/board/r'));
});

test('grid routes use the grid board and preserve legacy links', () => {
  assert.deepEqual(parseRoute('#/grid'), {
    module: 'grid',
    isHomeView: false,
    currentBoard: 'g',
    gridItemId: undefined,
  });

  assert.deepEqual(parseRoute('#/grid/item-42'), {
    module: 'grid',
    isHomeView: false,
    currentBoard: 'g',
    gridItemId: 'item-42',
  });

  assert.deepEqual(parseRoute('#/board/g'), {
    module: 'grid',
    isHomeView: false,
    currentBoard: 'g',
    gridItemId: undefined,
  });

  assert.deepEqual(parseRoute('#/board/g/item/w'), {
    module: 'grid',
    isHomeView: false,
    currentBoard: 'g',
    gridItemId: 'w',
  });

  assert.equal(parseRoute('#/grid/w').gridItemId, 'w');
});

test('routeToPath reproduces the same hashes', () => {
  assert.equal(routeToPath({ module: 'imageboard', isHomeView: true }), '#/');
  assert.equal(
    routeToPath({ module: 'imageboard', isHomeView: false, currentBoard: BOARD_R }),
    '#/board/r',
  );
  assert.equal(
    routeToPath({ module: 'imageboard', isHomeView: false, currentBoard: BOARD_R, activeThreadId: 'abc' }),
    '#/board/r/thread/abc',
  );
  assert.equal(routeToPath({ module: 'grid', isHomeView: false }), '#/board/g');
  assert.equal(
    routeToPath({ module: 'grid', isHomeView: false, gridItemId: 'item 42/x' }),
    '#/board/g/item/item%2042%2Fx',
  );
});

test('paths round-trip through the parser', () => {
  const paths = ['#/', '#/board/w', '#/board/t/thread/z-9', '#/board/g', '#/board/g/item/abc'];
  for (const path of paths) {
    const parsed = parseRoute(path);
    assert.deepEqual(parseRoute(routeToPath(parsed)), parsed, path);
  }
});

test('a grid item id is decoded once and never treated as a board', () => {
  const route = parseRoute('#/board/g/item/a%2Fb');
  assert.equal(route.module, 'grid');
  assert.equal(route.gridItemId, 'a/b');
  assert.equal(route.currentBoard, 'g');
});
