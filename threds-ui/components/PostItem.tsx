import React, { useState } from 'react';
import { api } from '../services/api';
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
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('inappropriate');
  const [customReason, setCustomReason] = useState('');
  const [reportStatus, setReportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const handleReportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmittingReport(true);
    setReportStatus(null);

    try {
      await api.reportPost(post.id, reportReason, reportReason === 'custom' ? customReason : undefined);
      setReportStatus({ type: 'success', message: 'Report submitted.' });
      setShowReportForm(false);
      setCustomReason('');
      setReportReason('inappropriate');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit report.';
      setReportStatus({ type: 'error', message });
    } finally {
      setIsSubmittingReport(false);
    }
  };

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
          
          <div className="ml-auto flex items-center gap-2">
            <button 
              onClick={() => setShowReportForm((prev) => !prev)}
              className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:underline cursor-pointer"
            >
              Report
            </button>
            <button 
              onClick={() => onReply(post.id)}
              className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
            >
              Reply
            </button>
          </div>
        </div>

        {showReportForm && (
          <form onSubmit={handleReportSubmit} className="mb-3 rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/20">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
              Report post
            </div>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`report-${post.id}`}
                  value="inappropriate"
                  checked={reportReason === 'inappropriate'}
                  onChange={(event) => setReportReason(event.target.value)}
                />
                Inappropriate
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`report-${post.id}`}
                  value="off_topic"
                  checked={reportReason === 'off_topic'}
                  onChange={(event) => setReportReason(event.target.value)}
                />
                Off topic
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`report-${post.id}`}
                  value="shitpost"
                  checked={reportReason === 'shitpost'}
                  onChange={(event) => setReportReason(event.target.value)}
                />
                Shitpost
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`report-${post.id}`}
                  value="custom"
                  checked={reportReason === 'custom'}
                  onChange={(event) => setReportReason(event.target.value)}
                />
                Custom
              </label>
              {reportReason === 'custom' && (
                <textarea
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  rows={3}
                  placeholder="Describe the issue..."
                  className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingReport || (reportReason === 'custom' && !customReason.trim())}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isSubmittingReport ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </form>
        )}

        {reportStatus && (
          <div
            className={`mb-3 rounded border px-2 py-1 text-xs ${
              reportStatus.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
            }`}
          >
            {reportStatus.message}
          </div>
        )}

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
