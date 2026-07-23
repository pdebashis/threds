import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BoardType, Thread } from './types';
import { BOARDS, MAX_THREDS_PER_BOARD } from './constants';
import { Button } from './components/Button';
import { Navbar } from './components/Navbar';
import { ThreadCard } from './components/ThreadCard';
import { PostItem } from './components/PostItem';
import { LoadingState } from './components/LoadingState';
import { api } from './services/api';

// --- URL Routing Functions ---

interface RouteState {
  isHomeView: boolean;
  currentBoard?: BoardType;
  activeThreadId?: string;
}

const normalizePath = (raw: string) => {
  return raw.replace(/^#\/?/, '').replace(/^\/\+|\/\+$/g, '');
};

const parseUrlRoute = (): RouteState => {
  const hash = window.location.hash;
  const raw = hash.startsWith('#') ? hash.slice(1) : window.location.pathname;
  const path = normalizePath(raw);

  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { isHomeView: true };
  }

  if (segments[0] === 'board' && segments[1]) {
    const boardId = segments[1] as BoardType;
    if (segments[2] === 'thread' && segments[3]) {
      return { isHomeView: false, currentBoard: boardId, activeThreadId: segments[3] };
    }
    return { isHomeView: false, currentBoard: boardId };
  }

  return { isHomeView: true };
};

const updateUrl = (route: RouteState) => {
  let path = '#/';

  if (!route.isHomeView && route.currentBoard) {
    path = `#/board/${route.currentBoard}`;
    if (route.activeThreadId) {
      path += `/thread/${route.activeThreadId}`;
    }
  }

  window.history.pushState({ ...route }, '', path);
};

// --- Main Application ---

export default function App() {
  const initialRoute = parseUrlRoute();
  
  const [currentBoard, setCurrentBoard] = useState<BoardType>(initialRoute.currentBoard || BoardType.WORK);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialRoute.activeThreadId || null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isHomeView, setIsHomeView] = useState<boolean>(initialRoute.isHomeView);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isContentLoading, setIsContentLoading] = useState(true);
  
  const [threds, setThreds] = useState<Thread[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Form States
  const [isCreatingThred, setIsCreatingThred] = useState(false);
  const [subject, setSubject] = useState('');
  const [postContent, setPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  // Reply specific state
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  
  // Loading & Error States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync URL when navigation state changes
  useEffect(() => {
    updateUrl({ isHomeView, currentBoard, activeThreadId: activeThreadId || undefined });
  }, [isHomeView, currentBoard, activeThreadId]);

  // Handle browser back/forward buttons + manual hash changes
  useEffect(() => {
    const syncRouteFromUrl = () => {
      const route = parseUrlRoute();
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
    let isCancelled = false;

    const loadThreds = async () => {
      setIsContentLoading(true);
      setError(null);

      try {
        if (isHomeView) {
          const allResults = await Promise.all(
            BOARDS.map((board) => api.fetchThreds(board.id))
          );

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
  }, [currentBoard, isHomeView]);

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
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const clearForm = useCallback(() => {
    setSubject('');
    setPostContent('');
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
    setCurrentBoard(boardId);
    setActiveThreadId(null);
    setActiveThread(null);
    setIsHomeView(false);
    setIsCreatingThred(false);
    setReplyTargetId(null);
    setIsContentLoading(true);
  }, []);

  const navigateToThread = useCallback(async (thread: Thread) => {
    setActiveThreadId(thread.id);
    setActiveThread(null);
    setIsHomeView(false);
    setIsContentLoading(true);

    try {
      const full = await api.fetchThread(thread.id);
      setActiveThread(full);
    } catch (err) {
      console.error('Failed to load thread', err);
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsContentLoading(false);
    }
  }, []);

  const goHome = useCallback(() => {
    setIsHomeView(true);
    setActiveThreadId(null);
    setActiveThread(null);
    setIsCreatingThred(false);
    setIsContentLoading(true);
  }, []);

  // Logic: Create Thred
  const handleCreateThread = useCallback(async (e: React.FormEvent) => {
    if (!postContent.trim() && !selectedFile) return;
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;
      if (selectedFile) {
        imageUrl = await api.uploadImage(selectedFile);
      }

      const newThread = await api.createThread(currentBoard, {
        subject,
        content: postContent,
        imageUrl
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
  }, [postContent, selectedFile, currentBoard, subject, clearForm]);

  // Logic: Add Reply
  const handleReply = useCallback(async (e: React.FormEvent) => {
    if (!postContent.trim() && !selectedFile) return;
    e.preventDefault();

    if (!activeThreadId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;
      if (selectedFile) {
        imageUrl = await api.uploadImage(selectedFile);
      }

      await api.createPost(activeThreadId, {
        content: postContent,
        replyToId: replyTargetId || undefined,
        imageUrl
      });

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
  }, [postContent, selectedFile, activeThreadId, replyTargetId, clearForm]);

  const showLoadingState = isContentLoading && (isHomeView || !activeThreadId || !activeThread);

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

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {showLoadingState ? (
          <LoadingState message={activeThreadId && !activeThread ? 'Loading thread...' : 'Loading content...'} />
        ) : isHomeView ? (
          // --- GLOBAL HOME VIEW ---
          <div className="animate-fade-in bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-8 border-b border-gray-100 dark:border-gray-700 pb-4">
              <h1 className="text-2xl font-bold dark:text-white font-mono">Directory of Threds</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">Status: {isOnline ? 'Online' : 'Booting in 15s'} | Account: Anonymous</p>
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
                              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-full"
                            >
                              {thread.subject}
                            </button>
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
                <div className="mb-4 flex items-center justify-between">
                  <button 
                    onClick={() => setActiveThreadId(null)}
                    className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-sm font-medium"
                  >
                    <i className="fas fa-chevron-left"></i> Back to |-{currentBoard}-|
                  </button>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block uppercase tracking-wider">Thread Control</span>
                    <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{activeThread.id.slice(0,8)}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-6 mb-6">
                   <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{activeThread.subject}</h2>
                   <div className="space-y-4">
                     {activeThread.posts.map((post, idx) => {
                        const repliesToThis = repliesMap.get(post.id) || [];
                        return (
                          <PostItem 
                            key={post.id} 
                            post={post} 
                            index={idx} 
                            onReply={initReplyTo}
                            repliesToThisPost={repliesToThis}
                          />
                        );
                     })}
                   </div>
                </div>

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
                     <form onSubmit={handleReply} className="flex gap-2">
                       <div className="flex-1 relative">
                          <input 
                            ref={replyInputRef}
                            type="text" 
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder="Write a reply..."
                            disabled={isSubmitting}
                            className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none shadow-sm placeholder-gray-400 disabled:opacity-50"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <label className={`cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}>
                              <i className="fas fa-image"></i>
                              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                            </label>
                          </div>
                       </div>
                       {filePreview && (
                         <div className="relative w-10 h-10 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                           <img src={filePreview} alt="Preview" className="w-full h-full object-cover rounded" />
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                        <textarea
                          rows={4}
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          disabled={isSubmitting}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500 outline-none disabled:opacity-50"
                          placeholder="Type your message here..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image (Optional)</label>
                        <div className="flex items-center gap-4">
                           <label className={`flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer border border-gray-300 dark:border-gray-600 text-sm dark:text-white ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}>
                             <i className="fas fa-upload"></i> Choose File
                             <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isSubmitting} />
                           </label>
                           {filePreview && (
                             <div className="h-12 w-12 relative">
                               <img src={filePreview} alt="Preview" className="h-full w-full object-cover rounded border dark:border-gray-600" />
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

                {/* Thread Grid */}
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