import { normalizeGridCell } from '../grid/cells';
import { GRID_DEFAULT_COLUMNS, GRID_DEFAULT_ROWS } from '../grid/constants';
import { normalizeCellFormat } from '../grid/palette';
import type {
  GridCell,
  GridCellFormat,
  GridCellPosition,
  GridCellQuery,
  GridCellWrite,
  GridFormatWrite,
  GridItem,
  GridItemDraft,
} from '../grid/types';
import { HttpError, fetchJson, toCamelCase } from './http';

const API_BASE = import.meta.env.VITE_API_URL;
const GRID_BASE = `${API_BASE}/grid`;

/**
 * Grid API contract.
 *
 * All payloads are camelCase JSON, matching the Imageboard controllers'
 * explicit serialization style. Reads are public; writes to a keyed item send
 * the key in the `X-Grid-Access-Key` header (never a query parameter, never a
 * response field).
 *
 *   GET    /grid/items                                   -> GridItem[]
 *   POST   /grid/items                                   -> GridItem
 *   GET    /grid/items/:id                               -> GridItem
 *   GET    /grid/items/:id/cells?rowStart=&rowEnd=&columnStart=&columnEnd=
 *                                                        -> { cells: GridCell[] }
 *   GET    /grid/items/:id/cells/:row/:column             -> { cell: GridCell | null }
 *   POST   /grid/items/:id/cells/:row/:column/posts       -> { cell: GridCell }
 *   PATCH  /grid/items/:id/cells/:row/:column/format      -> { cell: GridCell | null }
 *
 * `GET .../cells` only returns cells that have persisted posts or formatting,
 * so the UI can rely on "absent means empty".
 */
export interface GridApi {
  listItems(options?: { signal?: AbortSignal }): Promise<GridItem[]>;
  fetchItem(itemId: string, options?: { signal?: AbortSignal }): Promise<GridItem>;
  createItem(draft: GridItemDraft, options?: { signal?: AbortSignal }): Promise<GridItem>;
  fetchCells(itemId: string, query: GridCellQuery, options?: { signal?: AbortSignal }): Promise<GridCell[]>;
  fetchCell(itemId: string, position: GridCellPosition, options?: { signal?: AbortSignal }): Promise<GridCell | null>;
  addCellPost(write: GridCellWrite, options?: { signal?: AbortSignal }): Promise<GridCell>;
  updateCellFormat(write: GridFormatWrite, options?: { signal?: AbortSignal }): Promise<GridCell | null>;
}

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const timestampOr = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const normalizeGridItem = (raw: unknown): GridItem => {
  const source = (toCamelCase(raw) ?? {}) as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id : '';

  if (!id) {
    throw new HttpError('The Grid API returned an item without an id.', 502);
  }

  const createdAt = timestampOr(source.createdAt, Date.now());

  return {
    id,
    subject: typeof source.subject === 'string' ? source.subject : '',
    access: source.access === 'keyed' ? 'keyed' : 'public',
    createdAt,
    updatedAt: timestampOr(source.updatedAt, createdAt),
    maxRows: clampInt(source.maxRows, 1, GRID_DEFAULT_ROWS, GRID_DEFAULT_ROWS),
    maxColumns: clampInt(source.maxColumns, 1, GRID_DEFAULT_COLUMNS, GRID_DEFAULT_COLUMNS),
    populatedCells: Math.max(0, Math.trunc(numberOr(source.populatedCells, 0))),
    postCount: Math.max(0, Math.trunc(numberOr(source.postCount, 0))),
  };
};

const normalizeCells = (raw: unknown): GridCell[] => {
  const payload = toCamelCase(raw);
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.cells) ? payload.cells : [];

  return list
    .map((cell: unknown) => normalizeGridCell(cell))
    .filter((cell: GridCell | null): cell is GridCell => cell !== null);
};

const normalizeSingleCell = (raw: unknown): GridCell | null => {
  const payload = toCamelCase(raw);
  if (!payload || typeof payload !== 'object') return null;

  const candidate = 'cell' in (payload as Record<string, unknown>) ? (payload as any).cell : payload;
  if (candidate === null || candidate === undefined) return null;
  return normalizeGridCell(candidate);
};

const readJson = <T>(url: string, signal?: AbortSignal): Promise<T> =>
  fetchJson<T>(url, {
    cache: 'no-store',
    signal,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });

const writeJson = <T>(
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  accessKey?: string,
  signal?: AbortSignal,
): Promise<T> =>
  fetchJson<T>(url, {
    method,
    body: JSON.stringify(body),
    signal,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(accessKey ? { 'X-Grid-Access-Key': accessKey } : {}),
    },
  });

const cellPath = (itemId: string, position: GridCellPosition): string =>
  `${GRID_BASE}/items/${encodeURIComponent(itemId)}/cells/${position.row}/${position.column}`;

export const createHttpGridApi = (): GridApi => ({
  async listItems(options) {
    const data = await readJson<unknown>(`${GRID_BASE}/items`, options?.signal);
    const payload = toCamelCase(data);
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    return list.map(normalizeGridItem);
  },

  async fetchItem(itemId, options) {
    const data = await readJson<unknown>(`${GRID_BASE}/items/${encodeURIComponent(itemId)}`, options?.signal);
    const payload = toCamelCase(data);
    const candidate = payload && typeof payload === 'object' && 'item' in payload ? (payload as any).item : payload;
    return normalizeGridItem(candidate);
  },

  async createItem(draft, options) {
    const data = await writeJson<unknown>(
      `${GRID_BASE}/items`,
      'POST',
      {
        subject: draft.subject,
        access: draft.access,
        ...(draft.access === 'keyed' && draft.accessKey ? { accessKey: draft.accessKey } : {}),
      },
      // The key being set travels in the body once, not in an auth header.
      undefined,
      options?.signal,
    );
    const payload = toCamelCase(data);
    const candidate = payload && typeof payload === 'object' && 'item' in payload ? (payload as any).item : payload;
    return normalizeGridItem(candidate);
  },

  async fetchCells(itemId, query, options) {
    const params = new URLSearchParams({
      rowStart: String(query.rowStart),
      rowEnd: String(query.rowEnd),
      columnStart: String(query.columnStart),
      columnEnd: String(query.columnEnd),
    });
    const data = await readJson<unknown>(
      `${GRID_BASE}/items/${encodeURIComponent(itemId)}/cells?${params.toString()}`,
      options?.signal,
    );
    return normalizeCells(data);
  },

  async fetchCell(itemId, position, options) {
    const data = await readJson<unknown>(cellPath(itemId, position), options?.signal);
    return normalizeSingleCell(data);
  },

  async addCellPost(write, options) {
    const data = await writeJson<unknown>(
      `${cellPath(write.itemId, write.position)}/posts`,
      'POST',
      { content: write.content },
      write.accessKey,
      options?.signal,
    );
    const cell = normalizeSingleCell(data);
    if (!cell) {
      throw new HttpError('The Grid API did not confirm the new post.', 502);
    }
    return cell;
  },

  async updateCellFormat(write, options) {
    const format: GridCellFormat = normalizeCellFormat(write.format);
    const data = await writeJson<unknown>(
      `${cellPath(write.itemId, write.position)}/format`,
      'PATCH',
      { bold: format.bold, color: format.color },
      write.accessKey,
      options?.signal,
    );
    return normalizeSingleCell(data);
  },
});
