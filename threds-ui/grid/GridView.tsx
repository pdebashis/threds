import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import type { GridApi } from '../services/gridApi';
import { resolveGridClient, resetGridClient, type GridApiMode } from '../services/gridClient';
import { createPreviewGridApi } from '../services/gridPreviewApi';
import { describeRequestError } from '../services/http';
import { GridDirectory } from './GridDirectory';
import { GridItemView } from './GridItemView';

export interface GridViewProps {
  itemId: string | null;
  onNavigateItem: (itemId: string | null) => void;
}

type ClientState =
  | { status: 'loading' }
  | { status: 'ready'; mode: GridApiMode; api: GridApi }
  | { status: 'error'; message: string };

/**
 * Entry point for the Grid module. Owns the API/data-source handshake so the
 * directory and item views only ever see a resolved `GridApi`.
 */
export const GridView: React.FC<GridViewProps> = ({ itemId, onNavigateItem }) => {
  const [client, setClient] = useState<ClientState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setClient({ status: 'loading' });

    resolveGridClient()
      .then((resolved) => {
        if (!cancelled) setClient({ status: 'ready', mode: resolved.mode, api: resolved.api });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setClient({ status: 'error', message: describeRequestError(error, 'Could not reach the Grid API.') });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    resetGridClient();
    setAttempt((value) => value + 1);
  }, []);

  if (client.status === 'loading') {
    return <LoadingState message="Preparing the Grid…" />;
  }

  if (client.status === 'error') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/20">
        <i className="fas fa-table-cells-large mb-3 text-2xl text-amber-600 dark:text-amber-300" aria-hidden="true"></i>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">The Grid is not reachable</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-gray-600 dark:text-gray-300">{client.message}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" onClick={retry}>
            <i className="fas fa-sync-alt mr-2" aria-hidden="true"></i> Try again
          </Button>
          <Button variant="secondary" onClick={() => setClient(buildPreviewClient())}>
            Use preview data
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {itemId ? (
        <GridItemView
          key={itemId}
          api={client.api}
          mode={client.mode}
          itemId={itemId}
          onBack={() => onNavigateItem(null)}
        />
      ) : (
        <GridDirectory api={client.api} mode={client.mode} onOpenItem={(id) => onNavigateItem(id)} />
      )}
    </div>
  );
};

const buildPreviewClient = (): ClientState => ({
  status: 'ready',
  mode: 'preview',
  api: createPreviewGridApi(),
});
