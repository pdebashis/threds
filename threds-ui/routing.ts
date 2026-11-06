import type { BoardType } from './types';

// The app shares board navigation while keeping the Grid's item id separate
// from Imageboard thread ids.
export type AppModule = 'imageboard' | 'grid';

export interface RouteState {
  module: AppModule;
  /** True only for the global directory at "#/". */
  isHomeView: boolean;
  currentBoard?: BoardType;
  activeThreadId?: string;
  /** Set when the Grid board is open to a specific Grid item. */
  gridItemId?: string;
}

export const GRID_ROUTE_PREFIX = 'grid';
export const BOARD_ROUTE_PREFIX = 'board';

// Kept byte-for-byte compatible with the original hand-written parser so that
// every existing imageboard URL keeps resolving the same way.
export const normalizePath = (raw: string) => {
  return raw.replace(/^#\/?/, '').replace(/^\/\+|\/\+$/g, '');
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const parseRoute = (rawPath: string): RouteState => {
  const segments = normalizePath(rawPath).split('/').filter(Boolean);

  if (segments.length === 0) {
    return { module: 'imageboard', isHomeView: true };
  }

  // Keep the old Grid URLs working while new navigation uses the board route.
  if (segments[0] === GRID_ROUTE_PREFIX) {
    return {
      module: 'grid',
      isHomeView: false,
      currentBoard: 'g',
      gridItemId: segments[1] ? safeDecode(segments[1]) : undefined,
    };
  }

  if (segments[0] === BOARD_ROUTE_PREFIX && segments[1]) {
    const boardId = segments[1] as BoardType;
    if (boardId === 'g') {
      return {
        module: 'grid',
        isHomeView: false,
        currentBoard: 'g',
        gridItemId: segments[2] === 'item' && segments[3] ? safeDecode(segments[3]) : undefined,
      };
    }

    if (segments[2] === 'thread' && segments[3]) {
      return { module: 'imageboard', isHomeView: false, currentBoard: boardId, activeThreadId: segments[3] };
    }
    return { module: 'imageboard', isHomeView: false, currentBoard: boardId };
  }

  return { module: 'imageboard', isHomeView: true };
};

export const parseUrlRoute = (): RouteState => {
  const hash = window.location.hash;
  const raw = hash.startsWith('#') ? hash.slice(1) : window.location.pathname;
  return parseRoute(raw);
};

export const routeToPath = (route: RouteState): string => {
  if (route.module === 'grid') {
    return route.gridItemId
      ? `#/${BOARD_ROUTE_PREFIX}/g/item/${encodeURIComponent(route.gridItemId)}`
      : `#/${BOARD_ROUTE_PREFIX}/g`;
  }

  if (route.isHomeView || !route.currentBoard) {
    return '#/';
  }

  let path = `#/${BOARD_ROUTE_PREFIX}/${route.currentBoard}`;
  if (route.activeThreadId) {
    path += `/thread/${encodeURIComponent(route.activeThreadId)}`;
  }
  return path;
};

export const updateUrl = (route: RouteState) => {
  const path = routeToPath(route);
  // Avoid pushing a duplicate history entry for the route already in the URL.
  if (window.location.hash === path) return;
  window.history.pushState({ ...route }, '', path);
};
