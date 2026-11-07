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
});

test('paths round-trip through the parser', () => {
  const paths = ['#/', '#/board/w', '#/board/t/thread/z-9'];
  for (const path of paths) {
    const parsed = parseRoute(path);
    assert.deepEqual(parseRoute(routeToPath(parsed)), parsed, path);
  }
});
