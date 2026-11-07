import type { BoardType } from './types';

export type AppModule = 'imageboard';

export interface RouteState {
  module: AppModule;
  /** True only for the global directory at "#/". */
  isHomeView: boolean;
  currentBoard?: BoardType;
  activeThreadId?: string;
}

export const BOARD_ROUTE_PREFIX = 'board';

export const normalizePath = (raw: string) => {
  return raw.replace(/^#\/?/, '').replace(/^\/\+|\/\+$/g, '');
};

export const parseRoute = (rawPath: string): RouteState => {
  const segments = normalizePath(rawPath).split('/').filter(Boolean);

  if (segments.length === 0) {
    return { module: 'imageboard', isHomeView: true };
  }

  if (segments[0] === BOARD_ROUTE_PREFIX && segments[1]) {
    const boardId = segments[1] as BoardType;

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
  if (window.location.hash === path) return;
  window.history.pushState({ ...route }, '', path);
};
