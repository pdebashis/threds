import { GRID_CELL_SNIPPETS, GRID_DEFAULT_COLUMNS, GRID_DEFAULT_ROWS } from './constants.ts';
import { isCellWithinBounds } from './coordinates.ts';
import { isDefaultFormat, normalizeCellFormat } from './palette.ts';
import type { GridCell, GridCellPosition, GridPost } from './types.ts';

export const emptyGridCell = (position: GridCellPosition): GridCell => ({
  row: position.row,
  column: position.column,
  format: normalizeCellFormat(null),
  posts: [],
  postCount: 0,
  updatedAt: 0,
});

/** Deterministic order: oldest first, id breaks ties. Never trusts payload order. */
export const sortCellPosts = (posts: readonly GridPost[]): GridPost[] => {
  return [...posts].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
};

const coerceTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export const normalizeGridPost = (raw: unknown): GridPost | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as { id?: unknown; content?: unknown; createdAt?: unknown; timestamp?: unknown };
  if (typeof source.id !== 'string' || source.id.length === 0) return null;
  if (typeof source.content !== 'string') return null;

  return {
    id: source.id,
    content: source.content,
    createdAt: coerceTimestamp(source.createdAt ?? source.timestamp),
  };
};

/**
 * Turns an API cell into a renderable cell. Rows/columns outside the item are
 * dropped rather than rendered, and unknown colours collapse to "no fill".
 */
export const normalizeGridCell = (
  raw: unknown,
  maxRows: number = GRID_DEFAULT_ROWS,
  maxColumns: number = GRID_DEFAULT_COLUMNS,
): GridCell | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as {
    row?: unknown;
    column?: unknown;
    format?: unknown;
    posts?: unknown;
    postCount?: unknown;
    updatedAt?: unknown;
  };

  const row = typeof source.row === 'number' ? Math.trunc(source.row) : Number.NaN;
  const column = typeof source.column === 'number' ? Math.trunc(source.column) : Number.NaN;
  if (!isCellWithinBounds({ row, column }, maxRows, maxColumns)) return null;

  const posts = Array.isArray(source.posts)
    ? sortCellPosts(source.posts.map(normalizeGridPost).filter((post): post is GridPost => post !== null))
    : [];

  const reportedCount =
    typeof source.postCount === 'number' && Number.isFinite(source.postCount)
      ? Math.max(0, Math.trunc(source.postCount))
      : posts.length;

  return {
    row,
    column,
    format: normalizeCellFormat(source.format),
    posts,
    postCount: Math.max(reportedCount, posts.length),
    updatedAt: coerceTimestamp(source.updatedAt),
  };
};

export const isCellEmpty = (cell: GridCell | undefined): boolean => {
  if (!cell) return true;
  return cell.posts.length === 0 && cell.postCount === 0 && isDefaultFormat(cell.format);
};

export const cellFormatOrDefault = (cell: GridCell | undefined) => cell?.format ?? normalizeCellFormat(null);

const snippetOf = (content: string): string => content.replace(/\s+/g, ' ').trim();

export interface GridCellSnippets {
  lines: string[];
  hiddenCount: number;
}

/**
 * A cell is 36px tall, so it shows the first line of the posts it holds and
 * summarizes the rest with a count. The panel shows the full text.
 */
export const cellSnippets = (cell: GridCell | undefined, maxLines: number = GRID_CELL_SNIPPETS): GridCellSnippets => {
  if (!cell || cell.posts.length === 0) return { lines: [], hiddenCount: 0 };

  const lines = cell.posts
    .slice(0, Math.max(0, maxLines))
    .map((post) => snippetOf(post.content))
    .filter((line) => line.length > 0);

  const total = Math.max(cell.postCount, cell.posts.length);
  return { lines, hiddenCount: Math.max(0, total - lines.length) };
};

/** Short single-line summary used for aria labels and tooltips. */
export const cellSummary = (cell: GridCell | undefined): string => {
  if (!cell || cell.postCount === 0) return '';
  const first = cell.posts[0] ? snippetOf(cell.posts[0].content) : '';
  const count = cell.postCount;
  const suffix = count > 1 ? ` (+${count - 1} more)` : '';
  return `${first.slice(0, 80)}${suffix}`;
};
