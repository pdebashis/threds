import React, { useCallback, useEffect, useRef, useState } from 'react';

import { GRID_POST_MAX_LENGTH } from './constants';
import { cellAddressLabel } from './coordinates';
import { cellFormatOrDefault, isCellEmpty } from './cells';
import { formatGridTimestamp } from './format';
import { Button } from '../components/Button';
import { describeRequestError } from '../services/http';
import type { GridCell, GridCellFormat, GridCellPosition, GridItem } from './types';
import { GRID_COLOR_OPTIONS, isSameFormat } from './palette';

export interface GridCellPanelProps {
  item: GridItem;
  position: GridCellPosition;
  cell: GridCell | undefined;
  accessKey: string;
  onAccessKeyChange: (value: string) => void;
  onClose: () => void;
  onPost: (content: string) => Promise<void>;
  onFormat: (format: GridCellFormat) => Promise<void>;
  /** True when the cell was opened from the keyboard, so typing can start. */
  focusComposerOnMount?: boolean;
}

/**
 * Inspector for one selected cell: its posts in order, a composer that appends
 * a new independent post, and whole-cell formatting.
 *
 * The panel is remounted (keyed by cell address) whenever the selection moves,
 * so a half-written draft never leaks to another cell.
 */
export const GridCellPanel: React.FC<GridCellPanelProps> = ({
  item,
  position,
  cell,
  accessKey,
  onAccessKeyChange,
  onClose,
  onPost,
  onFormat,
  focusComposerOnMount = false,
}) => {
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const postingRef = useRef(false);
  const formattingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focusComposerOnMount) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [focusComposerOnMount]);

  const isKeyed = item.access === 'keyed';
  const hasKey = !isKeyed || accessKey.trim().length > 0;
  const format = cellFormatOrDefault(cell);
  const posts = cell?.posts ?? [];
  const address = cellAddressLabel(position);

  const submitPost = useCallback(async () => {
    // A ref prevents a second submit from a repeated Enter/click while the
    // first request is still in flight.
    if (postingRef.current) return;

    const content = draft.trim();
    if (!content) {
      setPostError('Write something before posting.');
      return;
    }

    postingRef.current = true;
    setIsPosting(true);
    setPostError(null);

    try {
      await onPost(content);
      setDraft('');
      textareaRef.current?.focus();
    } catch (caught) {
      setPostError(describeRequestError(caught, 'Could not add your post.'));
    } finally {
      postingRef.current = false;
      setIsPosting(false);
    }
  }, [draft, onPost]);

  const handleFormat = useCallback(
    async (next: GridCellFormat) => {
      if (formattingRef.current || isPosting) return;
      if (!hasKey) {
        setFormatError('Enter the key above to change formatting.');
        return;
      }
      if (isSameFormat(next, format)) return;

      formattingRef.current = true;
      setIsFormatting(true);
      setFormatError(null);

      try {
        await onFormat(next);
      } catch (caught) {
        setFormatError(describeRequestError(caught, 'Could not save the cell formatting.'));
      } finally {
        formattingRef.current = false;
        setIsFormatting(false);
      }
    },
    [format, hasKey, isPosting, onFormat],
  );

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      aria-label={`Cell ${address}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-700">
        <div>
          <h3 className="font-mono text-sm font-bold text-gray-900 dark:text-white">Cell {address}</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Row {position.row} · Column {position.column} · {posts.length === 1 ? '1 post' : `${Math.max(cell?.postCount ?? 0, posts.length)} posts`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label="Close cell"
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>

      {isKeyed && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <label
            htmlFor="grid-cell-key"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200"
          >
            This Grid is keyed
          </label>
          <input
            id="grid-cell-key"
            type="password"
            autoComplete="off"
            value={accessKey}
            onChange={(event) => onAccessKeyChange(event.target.value)}
            placeholder="Enter key to write"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500 dark:border-amber-800 dark:bg-gray-900 dark:text-white"
          />
          <p className="mt-1 text-[11px] leading-snug text-amber-800 dark:text-amber-200">
            Anyone can read. Writing sends this key in a request header; it is never saved by the UI and Rails
            re-checks it on every write.
          </p>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Cell formatting
          </span>
          {isFormatting && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500" aria-live="polite">
              Saving…
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={format.bold}
            aria-label="Bold text in this cell"
            disabled={!hasKey || isFormatting || isPosting}
            onClick={() => void handleFormat({ ...format, bold: !format.bold })}
            className={`rounded border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
              format.bold
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-200'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            B
          </button>

          <div
            role="group"
            aria-label="Cell fill colour"
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 p-1.5 dark:border-gray-700"
          >
            {GRID_COLOR_OPTIONS.map((option) => {
              const selected = option.key === 'none' ? format.color === null : format.color === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Fill: ${option.label}`}
                  title={option.label}
                  disabled={!hasKey || isFormatting || isPosting}
                  onClick={() =>
                    void handleFormat({
                      ...format,
                      color: option.key === 'none' ? null : option.key,
                    })
                  }
                  className={`h-6 w-6 rounded-full border transition-transform disabled:opacity-50 ${option.swatchClass} ${
                    selected
                      ? 'scale-110 border-gray-900 ring-2 ring-gray-900 dark:border-white dark:ring-white'
                      : 'border-gray-300 hover:scale-105 dark:border-gray-600'
                  }`}
                >
                  <span className="sr-only">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {formatError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
            {formatError}
          </p>
        )}
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Posts in this cell
        </h4>

        {posts.length === 0 ? (
          <p className="rounded border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
            {isCellEmpty(cell) ? 'Empty cell. Add the first post below.' : 'This cell only has formatting so far.'}
          </p>
        ) : (
          <ol className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/30">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                  <span className="font-bold text-gray-600 dark:text-gray-300">Anonymous</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatGridTimestamp(post.createdAt)}</span>
                </div>
                <p
                  className={`whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-gray-800 dark:text-gray-200 ${
                    format.bold ? 'font-bold' : ''
                  }`}
                >
                  {post.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitPost();
        }}
      >
        <label
          htmlFor="grid-cell-composer"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          Add a post
        </label>
        <textarea
          id="grid-cell-composer"
          ref={textareaRef}
          rows={3}
          value={draft}
          maxLength={GRID_POST_MAX_LENGTH}
          disabled={isPosting || !hasKey}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter posts; Shift+Enter inserts a newline. This is the
            // keyboard-accessible newline the composer documents.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submitPost();
            }
          }}
          placeholder={hasKey ? 'Write a post for this cell…' : 'Enter the key above to post'}
          aria-describedby="grid-composer-hint"
          className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        />

        <p id="grid-composer-hint" className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Enter posts · Shift+Enter adds a line break · posts are anonymous and cannot be edited.
        </p>

        {!hasKey && (
          <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            This Grid is read-only until a key is entered.
          </p>
        )}

        {postError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
            {postError}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
            {draft.length}/{GRID_POST_MAX_LENGTH}
          </span>
          <Button
            type="submit"
            isLoading={isPosting}
            disabled={isPosting || !hasKey || draft.trim().length === 0}
          >
            {isPosting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </form>
    </section>
  );
};
