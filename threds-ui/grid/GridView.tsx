import React from 'react';

import { createHttpGridApi } from '../services/gridApi';
import { GridDirectory } from './GridDirectory';
import { GridItemView } from './GridItemView';

const gridApi = createHttpGridApi();

export interface GridViewProps {
  itemId: string | null;
  onNavigateItem: (itemId: string | null) => void;
}

/**
 * Grid entry point. All reads and writes go directly to the Rails API.
 */
export const GridView: React.FC<GridViewProps> = ({ itemId, onNavigateItem }) => {
  return (
    <div>
      {itemId ? (
        <GridItemView
          key={itemId}
          api={gridApi}
          itemId={itemId}
          onBack={() => onNavigateItem(null)}
        />
      ) : (
        <GridDirectory api={gridApi} onOpenItem={(id) => onNavigateItem(id)} />
      )}
    </div>
  );
};
