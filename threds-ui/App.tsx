import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BoardType, Thread } from './types';
import { BOARDS, MAX_THREDS_PER_BOARD } from './constants';
import { Button } from './components/Button';
import { Navbar } from './components/Navbar';
import { ThreadCard } from './components/ThreadCard';
import { ProtectionBadge } from './components/ProtectionBadge';
import { PostItem } from './components/PostItem';
import { SketchBoard } from './components/SketchBoard';
import { LoadingState } from './components/LoadingState';
import { api } from './services/api';
import { parseUrlRoute, updateUrl, type AppModule } from './routing';
import { getMediaFileError } from './media';

// Time of the last manual thred refresh, shown next to the refresh control.
const formatRefreshTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Main Application ---

export default function App() {
  const initialRoute = parseUrlRoute();

  const [activeModule, setActiveModule] = useState<AppModule>(initialRoute.module);

  const [currentBoard, setCurrentBoard] = useState<BoardType>(initialRoute.currentBoard || BoardType.WORK);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialRoute.activeThreadId || null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isHomeView, setIsHomeView] = useState<boolean>(initialRoute.isHomeView);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(true);
  
  const [threds, setThreds] = useState<Thread[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const isImageboardModule = activeModule === 'imageboard';

  // Form States
  const [isCreatingThred, setIsCreatingThred] = useState(false);
  const [subject, setSubject] = useState('');
  const [postContent, setPostContent] = useState('');
  const [protectionStatus, setProtectionStatus] = useState<Thread['protectionStatus']>('public');
  const [threadCode, setThreadCode] = useState('');
  const [replyCode, setReplyCode] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  // Reply specific state
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Loading & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  // Sync URL when navigation state changes
  useEffect(() => {
    updateUrl({
      module: activeModule,
      isHomeView,
      currentBoard,
      activeThreadId: activeThreadId || undefined,
    });
  }, [activeModule, isHomeView, currentBoard, activeThreadId]);

  // Handle browser back/forward buttons + manual hash changes
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const route = parseUrlRoute();
      setActiveModule(route.module);
      setIsHomeView(route.isHomeView);

      if (route.currentBoard) {
        setCurrentBoard(route.currentBoard);
      }

      if (route.activeThreadId) {
        setActiveThreadId(route.activeThreadId);
      } else {
        setActiveThreadId(null);
      }
    };

    window.addEventListener('popstate', syncRouteFromUrl);
    window.addEventListener('hashchange', syncRouteFromUrl);
    return () => {
      window.removeEventListener('popstate', syncRouteFromUrl);
      window.removeEventListener('hashchange', syncRouteFromUrl);
    };
  }, []);

  // Dark Mode side-effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Check backend status
  useEffect(() => {
    const checkStatus = async () => {
      const isUp = await api.checkStatus();
      setIsOnline(isUp);
    };
    checkStatus();
  }, []);

  // Fetch threds whenever the board changes or home view changes
  useEffect(() => {
    if (isOnline !== true) {
      setThreds([]);
      setIsContentLoading(false);
      return;
    }

    if (activeThreadId) return;

    let isCancelled = false;

    const loadThreds = async () => {
      setIsContentLoading(true);
      setError(null);

      try {
        if (isHomeView) {
          const allResults = await Promise.all(BOARDS.map((board) => api.fetchThreds(board.id)));

          if (!isCancelled) {
            setThreds(allResults.flat());
          }
        } else {
          const data = await api.fetchThreds(currentBoard);
          if (!isCancelled) {
            setThreds(data);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load threds', err);
          setError(err instanceof Error ? err.message : 'Failed to load content');
          setThreds([]);
          setIsOnline(false);
        }
      } finally {
        if (!isCancelled) {
          setIsContentLoading(false);
        }
      }
    };

    loadThreds();
    return () => {
      isCancelled = true;
    };
  }, [currentBoard, isHomeView, activeThreadId, isOnline]);

  useEffect(() => {
    if (!isImageboardModule) return;
    if (!activeThreadId || isOnline !== true || activeThread) return;

    let isCancelled = false;

    const loadThread = async () => {
      setIsContentLoading(true);
      setError(null);

      try {
        const thread = await api.fetchThread(activeThreadId);
        if (!isCancelled) {
          setActiveThread(thread);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load thread', err);
          setError(err instanceof Error ? err.message : 'Failed to load thread');
        }
      } finally {
        if (!isCancelled) {
          setIsContentLoading(false);
        }
      }
    };

    loadThread();
    return () => {
      isCancelled = true;
    };
  }, [activeThreadId, activeThread, isOnline]);

  // Derived state memoization
  const currentBoardThreds = useMemo(() => {
    return threds.filter(t => t.boardId === currentBoard);
  }, [threds, currentBoard]);

  const boardInfo = useMemo(() => {
    return BOARDS.find(b => b.id === currentBoard) || BOARDS[0];
  }, [currentBoard]);

  // Post reply mappings memoization to avoid O(N^2) calculations during render
  const repliesMap = useMemo(() => {
    if (!activeThread) return new Map<string, Thread['posts']>();
    const map = new Map<string, Thread['posts']>();
    for (const post of activeThread.posts) {
      if (post.replyToId) {
        const existing = map.get(post.replyToId) || [];
        existing.push(post);
        map.set(post.replyToId, existing);
      }
    }
    return map;
  }, [activeThread]);

  // File Handler
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (file) {
      const validationError = getMediaFileError(file);
      if (validationError) {
        setSelectedFile(null);
        setFilePreview(null);
        setError(validationError);
        return;
      }

      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (!filePreview) return;
    return () => URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const clearForm = useCallback(() => {
    setSubject('');
    setPostContent('');
    setProtectionStatus('public');
    setThreadCode('');
    setReplyCode('');
    setSelectedFile(null);
    setFilePreview(null);
    setIsCreatingThred(false);
    setReplyTargetId(null);
    setIsSubmitting(false);
    setError(null);
  }, []);

  const initReplyTo = useCallback((postId: string) => {
    setReplyTargetId(postId);
    if (replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, []);

  // Navigation handlers
  const navigateToBoard = useCallback((boardId: BoardType) => {
    if (activeModule === 'imageboard' && !isHomeView && !activeThreadId && currentBoard === boardId) return;

    setActiveModule('imageboard');
    setCurrentBoard(boardId);
    setActiveThreadId(null);
    setActiveThread(null);
    setIsHomeView(false);
    setIsCreatingThred(false);
    setReplyTargetId(null);
    setIsContentLoading(true);
  }, [activeModule, activeThreadId, currentBoard, isHomeView]);

  const navigateToThread = useCallback((thread: Thread) => {
    setActiveModule('imageboard');
    setCurrentBoard(thread.boardId);
    setActiveThreadId(thread.id);
    setActiveThread(null);
    setIsHomeView(false);
    setIsContentLoading(true);
  }, []);

  const goHome = useCallback(() => {
    setActiveModule('imageboard');
    setIsHomeView(true);
    setActiveThreadId(null);
    setActiveThread(null);
    setIsCreatingThred(false);
    setIsContentLoading(true);
  }, []);

  // Logic: Create Thred
  const handleCreateThread = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && !selectedFile) return;
    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;
      if (selectedFile) {
        imageUrl = await api.uploadMedia(selectedFile);
      }

      const newThread = await api.createThread(currentBoard, {
        subject,
        content: postContent,
        imageUrl,
        protectionStatus,
        ...(protectionStatus === 'code_protected' ? { threadCode } : {}),
      });

      setThreds(prev => [newThread, ...prev]);
      clearForm();
    } catch (err) {
      console.error("Post failed", err);
      const message = err instanceof Error ? err.message : 'An error occurred while creating the thread';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [protectionStatus, threadCode, postContent, selectedFile, currentBoard, subject, clearForm]);

  // Logic: Add Reply
  const handleReply = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && !selectedFile) return;

    if (!activeThreadId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;
      if (selectedFile) {
        imageUrl = await api.uploadMedia(selectedFile);
      }

      await api.createPost(activeThreadId, {
        content: postContent,
        replyToId: replyTargetId || undefined,
        imageUrl
      }, replyCode);

      // reload thread (force refresh to bypass stale cache)
      const updated = await api.fetchThread(activeThreadId, true);
      setActiveThread(updated);

      // Clear the form so the UI updates
      clearForm(); 
    } catch (err) {
      console.error("Reply failed", err);
      const message = err instanceof Error ? err.message : 'An error occurred while creating the reply';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [postContent, selectedFile, activeThreadId, activeThread, replyTargetId, replyCode, clearForm]);

  const handleMessageKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }, []);

  // Logic: Pull the newest posts for the open thred. Forces the API call past
  // the 30s client cache, which is why it is useful for seeing other people's
  // replies rather than just your own.
  const handleRefreshThread = useCallback(async () => {
    if (!activeThreadId) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const updated = await api.fetchThread(activeThreadId, true);
      setActiveThread(updated);
      setLastRefreshedAt(Date.now());
    } catch (err) {
      console.error('Failed to refresh thread', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh thread');
    } finally {
      setIsRefreshing(false);
    }
  }, [activeThreadId]);

  const showLoadingState =
    isImageboardModule &&
    isOnline !== false &&
    isContentLoading &&
    (isHomeView || !activeThreadId || !activeThread);

  if (isOnline === false && isImageboardModule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-800 flex items-center justify-center px-4">
        <div className="max-w-xl w-full rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm text-center">
          <div className="mb-4 text-5xl" aria-hidden="true">🌤️</div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Site status</p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">Threds is in hibernate.</h1>
          <p className="mt-4 text-base text-slate-600">
            The backend is currently unreachable, so the site has gone quiet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-300">
      <Navbar 
        currentBoard={currentBoard} 
        onBoardChange={navigateToBoard}
        onHome={goHome}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        isHomeView={isHomeView}
      />

      <main className="mx-auto max-w-screen-2xl px-4 pt-6">
        {showLoadingState ? (
          <LoadingState message={activeThreadId && !activeThread ? 'Loading thread...' : 'Loading content...'} />
        ) : isHomeView ? (
          // --- GLOBAL HOME VIEW ---
          <div className="animate-fade-in bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-8 border-b border-gray-100 dark:border-gray-700 pb-4">
              <h1 className="text-2xl font-bold dark:text-white font-mono">Directory of Threds</h1>
            </div>
            
            <div className="space-y-6 font-mono text-sm sm:text-base">
              {BOARDS.map((board) => {
                const boardThreds = threds.filter(t => t.boardId === board.id);
                return (
                  <div key={board.id} className="group">
                    <button 
                      onClick={() => navigateToBoard(board.id)}
                      className={`font-bold transition-colors hover:text-blue-500 flex items-center gap-2 ${board.color}`}
                    >
                      <span className="text-gray-400 dark:text-gray-600">|-</span>{board.label}
                    </button>
                    
                    <div className="mt-1 space-y-1">
                      {boardThreds.length > 0 ? (
                        boardThreds.map((thread) => (
                          <div key={thread.id} className="flex items-center">
                            <span className="text-gray-400 dark:text-gray-600 ml-4">|----</span>
                            <button 
                              onClick={() => navigateToThread(thread)}
                              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                            >
                              {thread.subject}
                            </button>
                            <span className="ml-2">
                              <ProtectionBadge status={thread.protectionStatus} compact />
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center italic text-gray-400 dark:text-gray-600 ml-4">
                          <span>|----(empty)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // --- EXISTING VIEWS ---
          <>
            {/* Header Area */}
            {!activeThreadId && (
              <div className="mb-8 text-center sm:text-left border-b border-gray-200 dark:border-gray-700 pb-6">
                <h1 className={`text-3xl font-bold mb-2 ${boardInfo.color}`}>
                  |-{boardInfo.id}-| - {boardInfo.label}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">{boardInfo.description}</p>
              </div>
            )}

            {/* View Switcher */}
            {activeThreadId && activeThread ? (
              // --- Thread View ---
              <div className="animate-fade-in">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button 
                    onClick={() => setActiveThreadId(null)}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-sm font-medium"
                  >
                    <i className="fas fa-chevron-left"></i> Back to |-{currentBoard}-|
                  </button>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-gray-400 block uppercase tracking-wider">Thread Control</span>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{activeThread.id.slice(0,8)}</span>
                      {lastRefreshedAt !== null && (
                        <span className="text-xs text-gray-400 block">
                          Updated {formatRefreshTime(lastRefreshedAt)}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleRefreshThread}
                      isLoading={isRefreshing}
                      title="Check for new posts"
                      aria-label="Refresh thred"
                    >
                      <i className="fas fa-sync-alt" aria-hidden="true"></i> Refresh
                    </Button>
                  </div>
                </div>

                {activeThread.boardId === BoardType.SKETCH ? (
                  <SketchBoard
                    threadId={activeThread.id}
                    threadTitle={activeThread.subject}
                    isKeyed={activeThread.protectionStatus === 'code_protected'}
                    postsPanel={activeThread.posts.length ? (
                      <div className="space-y-3">
                        {activeThread.posts.map((post, idx) => (
                          <PostItem
                            key={post.id}
                            post={post}
                            index={idx}
                            onReply={initReplyTo}
                            repliesToThisPost={repliesMap.get(post.id) || []}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-500 dark:text-stone-400">No posts yet. Add one using the reply box.</p>
                    )}
                  />
                ) : (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-6 mb-6">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{activeThread.subject}</h2>
                      <ProtectionBadge status={activeThread.protectionStatus} />
                    </div>
                    <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                      {activeThread.protectionStatus === 'code_protected'
                        ? 'Anyone can read this thred. A key is needed to add a post.'
                        : 'Anyone can read and add posts to this thred.'}
                    </p>
                    <div className="space-y-4">
                      {activeThread.posts.map((post, idx) => (
                        <PostItem
                          key={post.id}
                          post={post}
                          index={idx}
                          onReply={initReplyTo}
                          repliesToThisPost={repliesMap.get(post.id) || []}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="sticky bottom-4 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                  <div className="w-full flex-1">
                     {error && (
                        <div className="flex items-center gap-2 mb-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded w-fit">
                            <i className="fas fa-exclamation-circle"></i>
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="hover:text-red-900 dark:hover:text-red-100">
                              <i className="fas fa-times"></i>
                            </button>
                        </div>
                     )}
                     {replyTargetId && (
                        <div className="flex items-center gap-2 mb-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded w-fit">
                            <span>Replying to &gt;&gt;{replyTargetId.slice(-6)}</span>
                            <button onClick={() => setReplyTargetId(null)} className="hover:text-red-500">
                              <i className="fas fa-times"></i>
                            </button>
                        </div>
                     )}
                     {activeThread.protectionStatus === 'code_protected' && (
                       <div className="mb-2 max-w-sm">
                         <label htmlFor="reply-code" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                           Thred key
                         </label>
                         <input
                           id="reply-code"
                           type="password"
                           autoComplete="new-password"
                           required
                           value={replyCode}
                           onChange={(e) => setReplyCode(e.target.value)}
                           disabled={isSubmitting}
                           placeholder="Enter key to"
                           className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                         />
                       </div>
                     )}
                     <form onSubmit={handleReply} className="flex gap-2">
                       <div className="flex-1 relative">
                          <textarea 
                            ref={replyInputRef}
                            rows={2}
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            onKeyDown={handleMessageKeyDown}
                            placeholder="Write a reply..."
                            disabled={isSubmitting}
                            className="w-full pl-3 pr-10 py-2 resize-y border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none shadow-sm placeholder-gray-400 disabled:opacity-50"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <label className={`cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}>
                              <i className="fas fa-image"></i>
                              <input type="file" accept="image/*,video/webm,video/mp4" className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                            </label>
                          </div>
                       </div>
                       {filePreview && (
                         <div className="relative w-10 h-10 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                           {selectedFile?.type.startsWith('video/') ? (
                             <video src={filePreview} muted loop autoPlay playsInline className="w-full h-full object-cover rounded" />
                           ) : (
                             <img src={filePreview} alt="Preview" className="w-full h-full object-cover rounded" />
                           )}
                           <button 
                              type="button"
                              onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                              disabled={isSubmitting}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
                            >
                              &times;
                            </button>
                         </div>
                       )}
                        <Button 
                          type="submit" 
                          disabled={(!postContent.trim() && !selectedFile) || isSubmitting} 
                          isLoading={isSubmitting}
                        >
                          Reply
                        </Button>
                      </form>
                  </div>
                </div>
              </div>
            ) : (
              // --- Board View ---
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Displaying {currentBoardThreds.length} / {MAX_THREDS_PER_BOARD} active threds
                  </div>
                  <Button onClick={() => setIsCreatingThred(true)}>
                    <i className="fas fa-plus mr-2"></i> New Thread
                  </Button>
                </div>

                {/* Create Thread Form (Inline) */}
                {isCreatingThred && (
                  <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-t-4 border-blue-500 animate-fade-in">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Create New Thread</h3>
                    {error && (
                      <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
                        <i className="fas fa-exclamation-circle"></i>
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto hover:text-red-900 dark:hover:text-red-100">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    )}
                    <form onSubmit={handleCreateThread} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                        <input
                          type="text"
                          required
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          disabled={isSubmitting}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500 outline-none disabled:opacity-50"
                          placeholder="What is on your mind?"
                        />
                      </div>
                      <fieldset>
                        <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">How people can post</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            protectionStatus === 'public'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            <input
                              type="radio"
                              name="thread-protection"
                              value="public"
                              checked={protectionStatus === 'public'}
                              onChange={() => setProtectionStatus('public')}
                              disabled={isSubmitting}
                              className="mt-1 accent-blue-600"
                            />
                            <span>
                              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                <i className="fas fa-door-open text-emerald-600 dark:text-emerald-300" aria-hidden="true"></i>
                                Open
                              </span>
                              <span className="block text-xs text-gray-500 dark:text-gray-400">Anyone can read and add posts.</span>
                            </span>
                          </label>
                          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            protectionStatus === 'code_protected'
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            <input
                              type="radio"
                              name="thread-protection"
                              value="code_protected"
                              checked={protectionStatus === 'code_protected'}
                              onChange={() => setProtectionStatus('code_protected')}
                              disabled={isSubmitting}
                              className="mt-1 accent-amber-600"
                            />
                            <span>
                              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                <i className="fas fa-key text-amber-600 dark:text-amber-300" aria-hidden="true"></i>
                                Keyed
                              </span>
                              <span className="block text-xs text-gray-500 dark:text-gray-400">
                                Anyone can read; a key is needed to add posts{currentBoard === BoardType.SKETCH ? ' and edit the sketch' : ''}.
                              </span>
                            </span>
                          </label>
                        </div>
                      </fieldset>
                      {protectionStatus === 'code_protected' && (
                        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                          <div>
                            <label htmlFor="thread-code" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Set a thred key
                            </label>
                            <input
                              id="thread-code"
                              type="password"
                              autoComplete="new-password"
                              required
                              value={threadCode}
                              onChange={(e) => setThreadCode(e.target.value)}
                              disabled={isSubmitting}
                              placeholder="Create a key"
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="text-gray-600 dark:text-gray-300">Thred card:</span>
                            <ProtectionBadge status="code_protected" compact />
                            <span className="text-gray-600 dark:text-gray-300">Reply form:</span>
                            <span className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              Enter key to add a post
                            </span>
                          </div>
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            Anyone can read this thred. A key is required to add posts{currentBoard === BoardType.SKETCH ? ' and edit the sketch' : ''}.
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                        <textarea
                          rows={4}
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          onKeyDown={handleMessageKeyDown}
                          disabled={isSubmitting}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500 outline-none disabled:opacity-50"
                          placeholder="Type your message here..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image, WebM, or MP4 video (optional, under 25 MB)</label>
                        <div className="flex items-center gap-4">
                           <label className={`flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer border border-gray-300 dark:border-gray-600 text-sm dark:text-white ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}>
                             <i className="fas fa-upload"></i> Choose File
                             <input type="file" accept="image/*,video/webm,video/mp4" className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                           </label>
                           {filePreview && (
                             <div className="h-12 w-12 relative">
                               {selectedFile?.type.startsWith('video/') ? (
                                 <video src={filePreview} muted loop autoPlay playsInline className="h-full w-full object-cover rounded border dark:border-gray-600" />
                               ) : (
                                 <img src={filePreview} alt="Preview" className="h-full w-full object-cover rounded border dark:border-gray-600" />
                               )}
                               <button 
                                 type="button"
                                 onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                                 disabled={isSubmitting}
                                 className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm"
                               >
                                 &times;
                               </button>
                             </div>
                           )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={clearForm} disabled={isSubmitting}>Cancel</Button>
                        <Button 
                          type="submit" 
                          isLoading={isSubmitting} 
                          disabled={(!postContent.trim() && !selectedFile) || isSubmitting}
                        >
                          Post Thread
                        </Button>                      
                      </div>
                    </form>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {currentBoardThreds.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                      <p className="text-gray-400 mb-4">No threds yet.</p>
                      <Button variant="secondary" onClick={() => setIsCreatingThred(true)}>Start the first one</Button>
                    </div>
                  ) : (
                    currentBoardThreds.map(thread => (
                      <ThreadCard 
                        key={thread.id} 
                        thread={thread} 
                        onClick={() => navigateToThread(thread)} 
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}