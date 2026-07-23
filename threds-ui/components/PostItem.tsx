import React, { useState } from 'react';
import { Post } from '../types';

export const scrollToPost = (postId: string) => {
  const element = document.getElementById(`post-${postId}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.remove('animate-flash');
    // Force reflow
    void element.offsetWidth; 
    element.classList.add('animate-flash');
  }
};

interface PostItemProps {
  post: Post;
  index: number;
  onReply: (id: string) => void;
  repliesToThisPost: Post[];
}

export const PostItem: React.FC<PostItemProps> = React.memo(({ post, index, onReply, repliesToThisPost }) => {
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  return (
    <div 
      id={`post-${post.id}`}
      className={`p-4 bg-gray-50 border-gray-100 dark:bg-gray-700/30 dark:border-gray-700/50 rounded-lg border mb-4 transition-colors duration-500 ${
        isImageExpanded ? 'flex flex-col' : 'flex flex-col sm:flex-row gap-4'
      }`}
    >
      {post.imageUrl && (
        <div className={`flex-shrink-0 ${isImageExpanded ? 'w-full mb-4' : ''}`}>
          <img 
            src={post.imageUrl} 
            alt="Post attachment" 
            loading="lazy"
            decoding="async"
            onClick={() => setIsImageExpanded(!isImageExpanded)}
            className={`${
              isImageExpanded 
                ? 'max-w-full max-h-[60vh] object-contain mx-auto' 
                : 'max-w-full sm:max-w-[200px] max-h-[200px] object-contain'
            } rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer hover:opacity-80 transition-all duration-300`} 
          />
        </div>
      )}
      <div className={`min-w-0 ${isImageExpanded ? 'w-full' : 'flex-1'}`}>
        <div className="flex items-center gap-2 mb-2 border-b border-gray-200/50 dark:border-gray-600/50 pb-2">
          <span className="font-bold text-sm text-blue-900 dark:text-blue-300">
            Anonymous
          </span>
          <span className="text-xs text-gray-400 font-mono">
            No.{post.id.slice(-6)} • {new Date(post.timestamp).toLocaleString()}
          </span>
          {index === 0 && <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 rounded ml-auto">OP</span>}
          
          <button 
            onClick={() => onReply(post.id)}
            className="ml-auto text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
          >
            Reply
          </button>
        </div>

        {/* Replying To Link */}
        {post.replyToId && (
          <div 
            onClick={() => scrollToPost(post.replyToId!)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer mb-2 inline-block"
          >
            &gt;&gt;{post.replyToId.slice(-6)}
          </div>
        )}

        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 text-sm leading-relaxed font-mono">
          {post.content}
        </p>

        {/* Replies List */}
        {repliesToThisPost.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200/50 dark:border-gray-600/50 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-1 items-center">
            <span className="italic mr-1">Replies:</span>
            {repliesToThisPost.map(reply => (
              <button
                key={reply.id}
                onClick={() => scrollToPost(reply.id)}
                className="text-blue-600 dark:text-blue-400 hover:underline hover:bg-blue-50 dark:hover:bg-blue-900/30 px-1 rounded transition-colors"
              >
                &gt;&gt;{reply.id.slice(-6)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

PostItem.displayName = 'PostItem';
