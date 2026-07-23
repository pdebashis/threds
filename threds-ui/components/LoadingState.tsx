import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = React.memo(({ message = 'Loading...' }) => (
  <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  </div>
));

LoadingState.displayName = 'LoadingState';
