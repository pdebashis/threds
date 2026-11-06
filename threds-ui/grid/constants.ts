// Hard limits for the Grid module. The server owns the authoritative limits and
// echoes them back on each Grid item; these constants are the client-side floor
// and the values used for rendering and validation before a request is made.

export const GRID_DEFAULT_ROWS = 500;
export const GRID_DEFAULT_COLUMNS = 500;

/** 1-based, inclusive. */
export const GRID_MIN_ROW = 1;
export const GRID_MIN_COLUMN = 1;

export const GRID_SUBJECT_MAX_LENGTH = 120;
export const GRID_MIN_ACCESS_KEY_LENGTH = 8;
export const GRID_MAX_ACCESS_KEY_LENGTH = 200;

/** A single anonymous text post inside a cell. */
export const GRID_POST_MAX_LENGTH = 2000;

export const GRID_POLL_INTERVAL_MS = 12000;

// Fixed cell metrics make the visible range exact, so virtualization never has
// to measure rendered rows.
export const GRID_ROW_HEIGHT = 36;
export const GRID_COLUMN_WIDTH = 128;
export const GRID_HEADER_HEIGHT = 32;
export const GRID_ROW_HEADER_WIDTH = 52;

// A little overscan keeps scrolling smooth without rendering far-off rows.
export const GRID_OVERSCAN_ROWS = 4;
export const GRID_OVERSCAN_COLUMNS = 2;

// Bounded client retention. The visible window is far smaller than these caps;
// the caps only decide how much previously-seen content stays cached.
export const GRID_MAX_CACHED_CELLS = 3000;
export const GRID_MAX_CACHED_RANGES = 12;

/** How many post snippets a cell shows before it is summarized with a count. */
export const GRID_CELL_SNIPPETS = 2;
