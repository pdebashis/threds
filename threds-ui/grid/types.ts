// Grid domain contracts. Grid content is intentionally modelled separately from
// the Imageboard Thred/Post types: a Grid cell post has no author, image, reply
// target or word-count rule, and a cell is addressed by (row, column) numbers.

export type GridAccess = 'public' | 'keyed';

/** Finite, server-validated palette. `null` means "no fill". */
export type GridCellColor = 'slate' | 'rose' | 'amber' | 'emerald' | 'sky' | 'violet';

export interface GridCellFormat {
  bold: boolean;
  color: GridCellColor | null;
}

export interface GridCellPosition {
  row: number;
  column: number;
}

export interface GridPost {
  id: string;
  content: string;
  /** Epoch milliseconds, matching the Imageboard timestamp convention. */
  createdAt: number;
}

export interface GridCell extends GridCellPosition {
  format: GridCellFormat;
  /** Deterministic order: oldest first, then id as a tie-breaker. */
  posts: GridPost[];
  /** Server-side total, which can exceed the number of posts in this payload. */
  postCount: number;
  updatedAt: number;
}

export interface GridItem {
  id: string;
  subject: string;
  access: GridAccess;
  createdAt: number;
  updatedAt: number;
  maxRows: number;
  maxColumns: number;
  populatedCells: number;
  postCount: number;
}

export interface GridItemDraft {
  subject: string;
  access: GridAccess;
  /** Only sent while creating a keyed item; never returned by the API. */
  accessKey?: string;
}

/** Inclusive, 1-based window of cells. */
export interface GridCellQuery {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
}

export interface GridCellsResponse {
  cells: GridCell[];
  /** Server time of the response, used to drop stale polls. */
  fetchedAt?: number;
}

export interface GridCellWrite {
  itemId: string;
  position: GridCellPosition;
  content: string;
  /** Sent in a header, never in the URL, and never stored by the client. */
  accessKey?: string;
}

export interface GridFormatWrite {
  itemId: string;
  position: GridCellPosition;
  format: GridCellFormat;
  accessKey?: string;
}
