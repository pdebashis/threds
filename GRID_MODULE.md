# Grid module

Grid is a second module inside Threds, next to the Imageboard. Its frontend,
Rails persistence, and API endpoints are implemented.

## What exists

| Area | Where |
| --- | --- |
| Route parsing (`#/board/g`, `#/board/g/item/:id`; legacy `#/grid` links supported) | `threds-ui/routing.ts` (+ `routing.test.ts`) |
| Grid types, palette, coordinates, virtualization math, bounded cache | `threds-ui/grid/*.ts` (+ tests) |
| Typed HTTP Grid API client | `threds-ui/services/gridApi.ts` |
| Views | `threds-ui/grid/GridView.tsx`, `GridDirectory.tsx`, `GridItemView.tsx`, `GridCanvas.tsx`, `GridCellPanel.tsx` |
| Shared JSON transport | `threds-ui/services/http.ts` |
| Rails persistence schema and models | `threds-api/db/migrate/20261106225000_create_grid_tables.rb`, `threds-api/app/models/grid_*.rb` |
| Rails API endpoints | `threds-api/app/controllers/grid_controller.rb`, `threds-api/config/routes.rb` |

Grid is registered as board type `g`; Grid item ids remain separate from
Imageboard thread ids.

## Product behaviour

* Grid directory (`#/grid`) lists Grid items and creates new ones (open or keyed).
* A Grid item (`#/grid/:id`) is a 500 x 500 text grid, rows 1-500 and columns as
  numeric indices shown with Excel labels (A, Z, AA ... SF).
* Only the visible window is rendered and fetched. Cell metrics are fixed
  (`36px` rows, `128px` columns), so the window is derived from scroll position
  and container size, with a small overscan.
* A cell holds an append-only stack of independent anonymous posts. Cells show
  the first lines of the stack; the panel shows all posts in deterministic
  (oldest first, id tie-break) order.
* The cell panel appends posts (`Enter` posts, `Shift+Enter` inserts a newline),
  toggles whole-cell bold, and sets a fill from a finite palette. Formatting is
  confirmed by the server before the UI shows it.
* Keyboard: arrows move, `Ctrl/Cmd` + arrows jump 10, `PageUp/PageDown` move 16
  rows, `Home`/`End` jump columns, `Ctrl/Cmd+Home/End` jump to the corners,
  `Enter`/`Space` opens the selected cell, `Esc` closes the panel.
* Polling: the visible range is polled every 12s (paused while the tab is
  hidden, stopped on unmount). Requests are abortable and tagged so a slow
  response can't overwrite newer content, and a poll that started before a
  confirmed write is discarded.
* Client retention is bounded (3,000 cells / 12 ranges); whole ranges are
  evicted oldest-first.

## Access rules

* `public`: read and write for everyone.
* `keyed`: read for everyone, write only with the key. The UI holds the key in
  memory and sends it in the `X-Grid-Access-Key` header; it is never put in a
  URL, response, or storage. Rails hashes the key with PBKDF2-HMAC-SHA256 and
  must enforce it on every write, including throttling failed attempts.

## Backend API

All payloads are camelCase JSON, serialized explicitly like the existing
Imageboard controllers. Dates/timestamps are epoch milliseconds. Grid routes
are registered in Rails and the UI sends requests to `VITE_API_URL`.

```
GET    /grid/items                                    -> GridItem[]  (newest activity first)
POST   /grid/items                                    -> GridItem
       body: { subject, access: "public"|"keyed", accessKey? }
GET    /grid/items/:id                                -> GridItem
GET    /grid/items/:id/cells?rowStart=&rowEnd=&columnStart=&columnEnd=
                                                      -> { cells: GridCell[] }
GET    /grid/items/:id/cells/:row/:column              -> { cell: GridCell | null }
POST   /grid/items/:id/cells/:row/:column/posts        -> { cell: GridCell }
       body: { content }
PATCH  /grid/items/:id/cells/:row/:column/format       -> { cell: GridCell | null }
       body: { bold: boolean, color: null|"slate"|"rose"|"amber"|"emerald"|"sky"|"violet" }
```

Writes to an existing item send the key in the `X-Grid-Access-Key` header. The
key being set at creation time travels once in the request body.


`GridItem`:

```json
{
  "id": "uuid",
  "subject": "Product roadmap",
  "access": "keyed",
  "createdAt": 1730000000000,
  "updatedAt": 1730000000000,
  "maxRows": 500,
  "maxColumns": 500,
  "populatedCells": 12,
  "postCount": 40
}
```

`GridCell`:

```json
{
  "row": 12,
  "column": 3,
  "format": { "bold": false, "color": "amber" },
  "posts": [{ "id": "uuid", "content": "text", "createdAt": 1730000000000 }],
  "postCount": 1,
  "updatedAt": 1730000000000
}
```

Requirements the frontend relies on:

* `GET .../cells` returns only cells that have posts or non-default formatting;
  absent means empty. Empty/unformatted cells have no row.
* Ranges are inclusive, 1-based, and clamped server-side to 500 x 500 (or the
  item's own limits). Only the requested range is queried.
* Cell formatting is stored separately from posts (own table/columns), never as
  posts; clearing it removes the row.
* Palette keys are validated against a finite list; arbitrary colours are
  rejected with `422`.
* Missing/invalid key on a write: `403` with `{ "error": "..." }`.
  Grid writes are rate-limited per IP.
* Indexes: `(grid_item_id, row, column)` unique for cells and formatting, plus
  `grid_item_id` for item listing. Must work on SQLite and PostgreSQL.
* No editing or deleting posts; no accounts.

## Running

```
cd threds-ui
npm run dev
npm test        # Node >= 22.6 (uses built-in test runner + type stripping)
```

The Grid UI uses the configured Rails API URL (`VITE_API_URL`) directly. Grid
items and their cell data are persisted by the Rails API, not browser storage.
