import { createHttpGridApi, type GridApi } from './gridApi';
import { createPreviewGridApi } from './gridPreviewApi';
import { HttpError } from './http';

export type GridApiMode = 'live' | 'preview';

export interface ResolvedGridClient {
  mode: GridApiMode;
  api: GridApi;
}

const PROBE_TIMEOUT_MS = 4000;

let resolved: Promise<ResolvedGridClient> | null = null;

/**
 * Picks the Grid data source once per session.
 *
 * The Rails Grid endpoints are not implemented yet, so the UI falls back to the
 * in-browser preview adapter when `/grid/items` is missing (404) or the server
 * cannot be reached. A real server error is surfaced instead of silently
 * switching data sources, because hiding it would mask integration bugs.
 *
 * Set `VITE_GRID_API_MODE=live` or `VITE_GRID_API_MODE=preview` to skip the
 * probe entirely.
 */
export const resolveGridClient = (): Promise<ResolvedGridClient> => {
  if (!resolved) {
    resolved = detectGridClient();
  }
  return resolved;
};

/** Lets the UI retry after a transient failure (used by the error state). */
export const resetGridClient = (): void => {
  resolved = null;
};

const detectGridClient = async (): Promise<ResolvedGridClient> => {
  const forced = import.meta.env.VITE_GRID_API_MODE;

  if (forced === 'preview') {
    return { mode: 'preview', api: createPreviewGridApi() };
  }

  const live = createHttpGridApi();
  if (forced === 'live') {
    return { mode: 'live', api: live };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    await live.listItems({ signal: controller.signal });
    return { mode: 'live', api: live };
  } catch (error) {
    if (error instanceof HttpError && error.status !== 404) {
      throw error;
    }

    // Missing endpoint or unreachable API: the UI-only preview is the intended
    // experience until the Grid backend is deployed.
    return { mode: 'preview', api: createPreviewGridApi() };
  } finally {
    clearTimeout(timeout);
  }
};
