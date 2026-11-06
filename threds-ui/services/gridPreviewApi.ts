import { isCellWithinBounds } from '../grid/coordinates';
import { GRID_POST_MAX_LENGTH, GRID_SUBJECT_MAX_LENGTH, GRID_MIN_ACCESS_KEY_LENGTH } from '../grid/constants';
import { sortCellPosts } from '../grid/cells';
import { DEFAULT_CELL_FORMAT, isGridCellColor, isSameFormat, normalizeCellFormat } from '../grid/palette';
import type {
  GridCell,
  GridCellFormat,
  GridCellPosition,
  GridCellQuery,
  GridCellWrite,
  GridFormatWrite,
  GridItem,
  GridItemDraft,
  GridPost,
} from '../grid/types';
import type { GridApi } from './gridApi';
import { HttpError } from './http';

/**
 * PREVIEW-ONLY Grid data source.
 *
 * The Rails Grid endpoints are not implemented yet (this change is UI-only).
 * So the Grid module can be exercised end to end, this adapter implements the
 * exact same `GridApi` contract in the browser, keeps its data in
 * `sessionStorage`, and enforces the same access rules the server will.
 *
 * It is deliberately not a security boundary: the key check here is a local
 * demo so the keyed-item flow can be tried. When the real API lands the client
 * switches to it automatically (see `gridClient.ts`).
 */

const STORAGE_KEY = 'threds.grid.preview.v2';
const MIN_LATENCY_MS = 90;
const MAX_LATENCY_MS = 220;
const DEFAULT_SEEDED_ITEM_IDS = new Set(['preview-roadmap', 'preview-retro', 'preview-reading']);

type PreviewPostRecord = GridPost;

interface PreviewFormatRecord extends GridCellFormat {
  updatedAt: number;
}

interface PreviewItemRecord {
  id: string;
  subject: string;
  access: 'public' | 'keyed';
  createdAt: number;
  updatedAt: number;
  maxRows: number;
  maxColumns: number;
  /** Demo-only digest. The real backend will use a password-style hash. */
  keyDigest: string | null;
}

interface PreviewStore {
  version: 2;
  items: PreviewItemRecord[];
  /** itemId -> cellKey -> posts. Never created for empty cells. */
  posts: Record<string, Record<string, PreviewPostRecord[]>>;
  /** itemId -> cellKey -> format. Kept apart from posts on purpose. */
  formats: Record<string, Record<string, PreviewFormatRecord>>;
}

const itemPathKey = (row: number, column: number) => `${row}:${column}`;

/** Demo-only digest: FNV-1a. Not a password hash; the Rails side will use bcrypt. */
const digestKey = (key: string): string => {
  const input = `threds-grid-preview::${key}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const abortError = (): Error => {
  if (typeof DOMException === 'function') {
    return new DOMException('The request was cancelled.', 'AbortError');
  }
  const error = new Error('The request was cancelled.');
  error.name = 'AbortError';
  return error;
};

const delay = (signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, latency);

    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });

const emptyStore = (): PreviewStore => ({ version: 2, items: [], posts: {}, formats: {} });

const isStore = (value: unknown): value is PreviewStore => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PreviewStore>;
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.items) &&
    typeof candidate.posts === 'object' &&
    typeof candidate.formats === 'object'
  );
};

const loadStore = (): PreviewStore => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStore(parsed)) {
        const seededItems = parsed.items.filter((item) => DEFAULT_SEEDED_ITEM_IDS.has(item.id));
        if (seededItems.length > 0) {
          parsed.items = parsed.items.filter((item) => !DEFAULT_SEEDED_ITEM_IDS.has(item.id));
          for (const item of seededItems) {
            delete parsed.posts[item.id];
            delete parsed.formats[item.id];
          }
          saveStore(parsed);
        }
        return parsed;
      }
    }
  } catch {
    // Storage can be unavailable (private mode); the session simply starts fresh.
  }

  const store = emptyStore();
  saveStore(store);
  return store;
};

const saveStore = (store: PreviewStore) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota/permission failures: preview data is disposable.
  }
};

const itemRecord = (store: PreviewStore, itemId: string): PreviewItemRecord => {
  const item = store.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new HttpError('That Grid item could not be found.', 404);
  return item;
};

const postsAt = (store: PreviewStore, itemId: string, position: GridCellPosition): PreviewPostRecord[] => {
  return store.posts[itemId]?.[itemPathKey(position.row, position.column)] ?? [];
};

const formatAt = (store: PreviewStore, itemId: string, position: GridCellPosition): PreviewFormatRecord | undefined => {
  return store.formats[itemId]?.[itemPathKey(position.row, position.column)];
};

const toCell = (store: PreviewStore, itemId: string, position: GridCellPosition): GridCell | null => {
  const posts = sortCellPosts(postsAt(store, itemId, position));
  const format = formatAt(store, itemId, position);

  if (posts.length === 0 && !format) return null;

  const lastPostAt = posts.length > 0 ? posts[posts.length - 1].createdAt : 0;

  return {
    row: position.row,
    column: position.column,
    format: normalizeCellFormat(format),
    posts,
    postCount: posts.length,
    updatedAt: Math.max(format?.updatedAt ?? 0, lastPostAt),
  };
};

const toItem = (store: PreviewStore, item: PreviewItemRecord): GridItem => {
  const cellKeys = new Set([
    ...Object.keys(store.posts[item.id] ?? {}),
    ...Object.keys(store.formats[item.id] ?? {}),
  ]);

  let populatedCells = 0;
  let postCount = 0;

  for (const cellKey of cellKeys) {
    const [row, column] = cellKey.split(':').map(Number);
    const count = postsAt(store, item.id, { row, column }).length;
    const hasFormat = Boolean(formatAt(store, item.id, { row, column }));
    if (count > 0 || hasFormat) populatedCells += 1;
    postCount += count;
  }

  return {
    id: item.id,
    subject: item.subject,
    access: item.access,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    maxRows: item.maxRows,
    maxColumns: item.maxColumns,
    populatedCells,
    postCount,
  };
};

const assertWritable = (item: PreviewItemRecord, accessKey?: string) => {
  if (item.access !== 'keyed') return;

  if (!accessKey) {
    throw new HttpError('This Grid needs its key to accept writes.', 403);
  }
  if (digestKey(accessKey) !== item.keyDigest) {
    throw new HttpError('That key was not accepted.', 403);
  }
};

const assertAuthorizedColor = (format: GridCellFormat) => {
  if (format.color !== null && !isGridCellColor(format.color)) {
    throw new HttpError('That cell colour is not in the supported palette.', 422);
  }
};

const validateContent = (content: string) => {
  const trimmed = content.trim();
  if (!trimmed) throw new HttpError('Write something before posting.', 422);
  if (content.length > GRID_POST_MAX_LENGTH) {
    throw new HttpError(`Keep a post under ${GRID_POST_MAX_LENGTH} characters.`, 422);
  }
  return trimmed;
};

export const createPreviewGridApi = (): GridApi => {
  const store = loadStore();
  let sequence = 0;

  const nextId = (prefix: string) => {
    sequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${sequence}`;
  };

  return {
    async listItems(options) {
      await delay(options?.signal);
      return store.items
        .map((item) => toItem(store, item))
        .sort((a, b) => b.updatedAt - a.updatedAt || a.subject.localeCompare(b.subject));
    },

    async fetchItem(itemId, options) {
      await delay(options?.signal);
      return toItem(store, itemRecord(store, itemId));
    },

    async createItem(draft: GridItemDraft, options) {
      await delay(options?.signal);

      const subject = draft.subject.trim();
      if (!subject) throw new HttpError('A subject is required.', 422);
      if (subject.length > GRID_SUBJECT_MAX_LENGTH) {
        throw new HttpError(`Keep the subject under ${GRID_SUBJECT_MAX_LENGTH} characters.`, 422);
      }

      const access = draft.access === 'keyed' ? 'keyed' : 'public';
      const key = (draft.accessKey ?? '').trim();

      if (access === 'keyed') {
        if (key.length < GRID_MIN_ACCESS_KEY_LENGTH) {
          throw new HttpError(`Use at least ${GRID_MIN_ACCESS_KEY_LENGTH} characters for the key.`, 422);
        }
      }

      const now = Date.now();
      const item: PreviewItemRecord = {
        id: nextId('preview-grid'),
        subject,
        access,
        createdAt: now,
        updatedAt: now,
        maxRows: 500,
        maxColumns: 500,
        keyDigest: access === 'keyed' ? digestKey(key) : null,
      };

      store.items.push(item);
      store.posts[item.id] = {};
      store.formats[item.id] = {};
      saveStore(store);

      return toItem(store, item);
    },

    async fetchCells(itemId, query: GridCellQuery, options) {
      await delay(options?.signal);
      const item = itemRecord(store, itemId);
      const cells: GridCell[] = [];

      for (const cellKey of Object.keys(store.posts[itemId] ?? {})) {
        const [row, column] = cellKey.split(':').map(Number);
        if (
          row < query.rowStart ||
          row > query.rowEnd ||
          column < query.columnStart ||
          column > query.columnEnd ||
          !isCellWithinBounds({ row, column }, item.maxRows, item.maxColumns)
        ) {
          continue;
        }

        const cell = toCell(store, itemId, { row, column });
        if (cell) cells.push(cell);
      }

      // Formatting-only cells are valid persisted cells too.
      for (const cellKey of Object.keys(store.formats[itemId] ?? {})) {
        const [row, column] = cellKey.split(':').map(Number);
        if (
          row < query.rowStart ||
          row > query.rowEnd ||
          column < query.columnStart ||
          column > query.columnEnd
        ) {
          continue;
        }
        if (cells.some((cell) => cell.row === row && cell.column === column)) continue;

        const cell = toCell(store, itemId, { row, column });
        if (cell) cells.push(cell);
      }

      return cells;
    },

    async fetchCell(itemId, position, options) {
      await delay(options?.signal);
      const item = itemRecord(store, itemId);
      if (!isCellWithinBounds(position, item.maxRows, item.maxColumns)) return null;
      return toCell(store, itemId, position);
    },

    async addCellPost(write: GridCellWrite, options) {
      await delay(options?.signal);

      const item = itemRecord(store, write.itemId);
      if (!isCellWithinBounds(write.position, item.maxRows, item.maxColumns)) {
        throw new HttpError('That cell is outside this Grid.', 422);
      }
      assertWritable(item, write.accessKey);

      const content = validateContent(write.content);
      const key = itemPathKey(write.position.row, write.position.column);
      const now = Date.now();

      store.posts[item.id] = store.posts[item.id] ?? {};
      store.posts[item.id][key] = store.posts[item.id][key] ?? [];
      store.posts[item.id][key].push({ id: nextId('preview-post'), content, createdAt: now });
      item.updatedAt = now;
      saveStore(store);

      const cell = toCell(store, item.id, write.position);
      if (!cell) throw new HttpError('The post could not be stored.', 500);
      return cell;
    },

    async updateCellFormat(write: GridFormatWrite, options) {
      await delay(options?.signal);

      const item = itemRecord(store, write.itemId);
      if (!isCellWithinBounds(write.position, item.maxRows, item.maxColumns)) {
        throw new HttpError('That cell is outside this Grid.', 422);
      }
      assertWritable(item, write.accessKey);

      const format = normalizeCellFormat(write.format);
      assertAuthorizedColor(format);

      const key = itemPathKey(write.position.row, write.position.column);
      const now = Date.now();
      store.formats[item.id] = store.formats[item.id] ?? {};

      const hasPosts = (store.posts[item.id]?.[key]?.length ?? 0) > 0;
      const unchanged = (() => {
        const existing = formatAt(store, item.id, write.position);
        if (!existing) return isSameFormat(format, DEFAULT_CELL_FORMAT);
        return isSameFormat(format, existing);
      })();

      if (!unchanged) {
        if (isSameFormat(format, DEFAULT_CELL_FORMAT) && !hasPosts) {
          // Unformatted + empty: no persisted row at all.
          delete store.formats[item.id][key];
        } else {
          store.formats[item.id][key] = { ...format, updatedAt: now };
        }
        item.updatedAt = now;
        saveStore(store);
      }

      return toCell(store, item.id, write.position);
    },
  };
};
