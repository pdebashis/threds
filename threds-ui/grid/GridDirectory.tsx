import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { GRID_MIN_ACCESS_KEY_LENGTH, GRID_SUBJECT_MAX_LENGTH } from './constants';
import { GridAccessBadge } from './GridAccessBadge';
import { formatGridTimestamp } from './format';
import { describeRequestError } from '../services/http';
import type { GridApi } from '../services/gridApi';
import type { GridApiMode } from '../services/gridClient';
import type { GridAccess, GridItem } from './types';

export interface GridDirectoryProps {
  api: GridApi;
  mode: GridApiMode;
  onOpenItem: (itemId: string) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Grid directory: the list of Grid items plus a create form. The Grid has its
 * own module state; it is not a board and never appears in BoardType.
 */
export const GridDirectory: React.FC<GridDirectoryProps> = ({ api, mode, onOpenItem }) => {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [access, setAccess] = useState<GridAccess>('public');
  const [accessKey, setAccessKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoadState('loading');

    api
      .listItems({ signal: controller.signal })
      .then((result) => {
        if (cancelled) return;
        setItems(result);
        setLoadState('ready');
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setLoadState('error');
        setLoadError(describeRequestError(error, 'Could not load the Grid directory.'));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, reloadToken]);

  const resetForm = useCallback(() => {
    setSubject('');
    setAccess('public');
    setAccessKey('');
    setFormError(null);
    setIsFormOpen(false);
  }, []);

  const handleCreate = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (submittingRef.current) return;

      const trimmedSubject = subject.trim();
      if (!trimmedSubject) {
        setFormError('A subject is required.');
        return;
      }
      if (access === 'keyed' && accessKey.trim().length < GRID_MIN_ACCESS_KEY_LENGTH) {
        setFormError(`Use at least ${GRID_MIN_ACCESS_KEY_LENGTH} characters for the key.`);
        return;
      }

      submittingRef.current = true;
      setIsSubmitting(true);
      setFormError(null);

      try {
        const created = await api.createItem({
          subject: trimmedSubject,
          access,
          accessKey: access === 'keyed' ? accessKey.trim() : undefined,
        });
        resetForm();
        onOpenItem(created.id);
      } catch (error) {
        setFormError(describeRequestError(error, 'Could not create this Grid.'));
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [access, accessKey, api, onOpenItem, resetForm, subject],
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 dark:border-gray-700 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-mono text-3xl font-bold text-gray-900 dark:text-white">|-grid-|</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Spreadsheet-like text threds. Up to 500 rows and 500 columns, one post stack per cell.
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            250,000 cells per Grid, but only the visible window is ever rendered.
          </p>
        </div>

        <Button onClick={() => setIsFormOpen((open) => !open)} aria-expanded={isFormOpen}>
          <i className={`fas ${isFormOpen ? 'fa-times' : 'fa-plus'} mr-2`} aria-hidden="true"></i>
          {isFormOpen ? 'Cancel' : 'New Grid'}
        </Button>
      </div>

      {isFormOpen && (
        <div className="mb-8 rounded-lg border-t-4 border-blue-500 bg-white p-6 shadow-md dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Create a new Grid</h2>

          {formError && (
            <div
              className="mb-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              role="alert"
            >
              <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
              <span>{formError}</span>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="ml-auto hover:text-red-900 dark:hover:text-red-100"
                aria-label="Dismiss error"
              >
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="grid-subject" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject
              </label>
              <input
                id="grid-subject"
                type="text"
                required
                maxLength={GRID_SUBJECT_MAX_LENGTH}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={isSubmitting}
                placeholder="What is this Grid for?"
                className="w-full rounded border border-gray-300 bg-white p-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-blue-500"
              />
            </div>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Who can write
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    access === 'public'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="grid-access"
                    value="public"
                    checked={access === 'public'}
                    onChange={() => setAccess('public')}
                    disabled={isSubmitting}
                    className="mt-1 accent-blue-600"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <i className="fas fa-door-open text-emerald-600 dark:text-emerald-300" aria-hidden="true"></i>
                      Open
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Anyone can read and write.
                    </span>
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    access === 'keyed'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="grid-access"
                    value="keyed"
                    checked={access === 'keyed'}
                    onChange={() => setAccess('keyed')}
                    disabled={isSubmitting}
                    className="mt-1 accent-amber-600"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <i className="fas fa-key text-amber-600 dark:text-amber-300" aria-hidden="true"></i>
                      Keyed
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      Anyone can read; a key is needed to write.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {access === 'keyed' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <label
                  htmlFor="grid-new-key"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Grid key
                </label>
                <input
                  id="grid-new-key"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  disabled={isSubmitting}
                  placeholder={`At least ${GRID_MIN_ACCESS_KEY_LENGTH} characters`}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  The key is sent once when creating the Grid. Rails stores a password-style hash, never the key
                  itself, and every later write is checked against it.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                Create Grid
              </Button>
            </div>
          </form>
        </div>
      )}

      {loadState === 'loading' && items.length === 0 ? (
        <LoadingState message="Loading Grid items…" />
      ) : loadState === 'error' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">{loadError}</p>
          <Button variant="secondary" className="mx-auto mt-3" onClick={() => setReloadToken((token) => token + 1)}>
            <i className="fas fa-sync-alt mr-2" aria-hidden="true"></i> Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-20 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-4 text-gray-400">No Grid items yet.</p>
          <Button variant="secondary" onClick={() => setIsFormOpen(true)}>
            Create the first Grid
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenItem(item.id)}
                aria-label={`Open ${item.subject}`}
                className="group flex w-full items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500"
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-600">
                  <i className="fas fa-table-cells-large text-xl" aria-hidden="true"></i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-lg font-bold text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                      {item.subject}
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <GridAccessBadge access={item.access} compact />
                      {item.updatedAt > 0 && (
                        <span className="hidden whitespace-nowrap text-xs text-gray-400 sm:inline">
                          {formatGridTimestamp(item.updatedAt)}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center gap-2 font-mono text-xs text-gray-500 dark:text-gray-400">
                    <span className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">
                      cells: {item.populatedCells}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-1 dark:bg-gray-700">
                      posts: {item.postCount}
                    </span>
                    <span>{item.maxRows}×{item.maxColumns}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === 'preview' && (
        <p className="mt-6 text-center text-[11px] text-gray-400 dark:text-gray-500">
          Preview data source: Grid items you create here live in this browser tab until the Rails Grid API is
          implemented.
        </p>
      )}
    </div>
  );
};
