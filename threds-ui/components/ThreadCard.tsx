import React from 'react';
import { Thread } from '../types';

interface ThreadCardProps {
  thread: Thread;
  onClick: () => void;
}

export const ThreadCard: React.FC<ThreadCardProps> = React.memo(({ thread, onClick }) => {
  const firstPost = thread.posts[0];
  const replyCount = thread.posts.length - 1;
  const lastPost = thread.posts[thread.posts.length - 1];

  return (
    <div 
      onClick={onClick}
      className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group"
    >
      <div className="flex gap-4">
        {firstPost?.imageUrl ? (
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 dark:bg-gray-900 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
            <img 
              src={firstPost.imageUrl} 
              alt="Thred thumbnail" 
              loading="lazy" 
              decoding="async" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 dark:text-gray-600">
            <i className="fas fa-comment-alt text-2xl"></i>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">{thread.subject}</h3>
             <span className="text-xs text-gray-400 font-mono whitespace-nowrap">{new Date(thread.timestamp).toLocaleDateString()}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-2">{firstPost?.content}</p>
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-4 mt-auto">
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              R: <strong>{replyCount}</strong>
            </span>
            {replyCount > 0 && lastPost && (
              <span className="truncate max-w-[150px] italic">
                Last: {new Date(lastPost.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

ThreadCard.displayName = 'ThreadCard';
