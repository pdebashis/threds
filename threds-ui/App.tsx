import React, { useState, useEffect, useRef } from 'react';
import { BoardType, Thread, Post, BoardConfig } from './types';
import { BOARDS, MAX_THREDS_PER_BOARD, MAX_POSTS_PER_THREAD } from './constants';
import { Button } from './components/Button';
import { api } from './services/api';

// --- URL Routing Functions ---

interface RouteState {
  isHomeView: boolean;
  currentBoard?: BoardType;
  activeThreadId?: string;
}

const parseUrlRoute = (): RouteState => {
  const path = window.location.pathname;
  
  // Remove leading/trailing slashes
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
  let path = '/';
  
  if (!route.isHomeView && route.currentBoard) {
    path = `/board/${route.currentBoard}`;
    if (route.activeThreadId) {
      path += `/thread/${route.activeThreadId}`;
    }
  }
  
  window.history.pushState({ ...route }, '', path);
};

// --- Helper Functions ---

const scrollToPost = (postId: string) => {
  const element = document.getElementById(`post-${postId}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.remove('animate-flash');
    // Force reflow
    void element.offsetWidth; 
    element.classList.add('animate-flash');
  }
};

// --- Helper Components ---

const Navbar: React.FC<{ 
  currentBoard: BoardType; 
  onBoardChange: (b: BoardType) => void;
  onHome: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isHomeView: boolean;
}> = ({ currentBoard, onBoardChange, onHome, isDarkMode, toggleDarkMode, isHomeView }) => (
  <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 transition-colors duration-300">
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onHome}>
          <div className="w-8 h-8 bg-black dark:bg-white dark:text-black text-white rounded flex items-center justify-center font-bold font-mono transition-colors">
            TH
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:block dark:text-white">Threds</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
            {BOARDS.map((board) => (
              <button
                key={board.id}
                onClick={() => onBoardChange(board.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  !isHomeView && currentBoard === board.id 
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <i className={`fas ${board.icon} sm:mr-2 ${!isHomeView && currentBoard === board.id ? board.color : ''}`}></i>
                <span className="hidden sm:inline">{board.label}</span>
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-1"></div>
          
          <button
            onClick={toggleDarkMode}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
             <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </div>
    </div>
  </nav>
);

const ThreadCard: React.FC<{ thread: Thread; onClick: () => void }> = ({ thread, onClick }) => {
  const firstPost = thread.posts[0];
  const replyCount = thread.posts.length - 1;
  const lastPost = thread.posts[thread.posts.length - 1];

  return (
    <div 
      onClick={onClick}
      className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group"
    >
      <div className="flex gap-4">
        {firstPost.imageUrl ? (
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 bg-gray-100 dark:bg-gray-900 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
            <img src={firstPost.imageUrl} alt="Thred thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-2">{firstPost.content}</p>
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-4 mt-auto">
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              R: <strong>{replyCount}</strong>
            </span>
            {replyCount > 0 && (
              <span className="truncate max-w-[150px] italic">
                Last: {new Date(lastPost.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PostItem: React.FC<{ 
  post: Post; 
  index: number; 
  onReply: (id: string) => void;
  repliesToThisPost: Post[];
}> = ({ post, index, onReply, repliesToThisPost }) => {
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
};

// --- Main Application ---

export default function App() {
  // Initialize state from URL
  const initialRoute = parseUrlRoute();
  
  const [currentBoard, setCurrentBoard] = useState<BoardType>(initialRoute.currentBoard || BoardType.WORK);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialRoute.activeThreadId || null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isHomeView, setIsHomeView] = useState<boolean>(initialRoute.isHomeView);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  
  // State for threds, loaded from localStorage if available
  const [threds, setThreds] = useState<Thread[]>([]);

  // Sync URL when navigation state changes
  useEffect(() => {
    updateUrl({ isHomeView, currentBoard, activeThreadId: activeThreadId || undefined });
  }, [isHomeView, currentBoard, activeThreadId]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
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

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch threds whenever the board changes
  useEffect(() => {
    const loadThreds = async () => {
      if (isHomeView) {
        // Load threds from all boards when in home view
        const allThreds: Thread[] = [];
        for (const board of BOARDS) {
          const data = await api.fetchThreds(board.id);
          allThreds.push(...data);
        }
        setThreds(allThreds);
      } else {
        // Load threds only from the current board when viewing a specific board
        const data = await api.fetchThreds(currentBoard);
        setThreds(data);
      }
    };
    loadThreds();
  }, [currentBoard, isHomeView]);

  
  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Check backend status
  useEffect(() => {
    const checkStatus = async () => {
      const isUp = await api.checkStatus();
      setIsOnline(isUp);
    };

    // Check once on mount
    checkStatus();
  }, []);

  // Form States
  const [isCreatingThred, setIsCreatingThred] = useState(false);
  const [subject, setSubject] = useState('');
  const [postContent, setPostContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  
  // Reply specific state
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  
  // Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived state
  const currentBoardThreds = threds
    .filter(t => t.boardId === currentBoard);
  const boardInfo = BOARDS.find(b => b.id === currentBoard)!;

  // File Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearForm = () => {
    setSubject('');
    setPostContent('');
    setSelectedFile(null);
    setFilePreview(null);
    setIsCreatingThred(false);
    setReplyTargetId(null);
    setIsSubmitting(false);
    setError(null);
  };

  const initReplyTo = (postId: string) => {
    setReplyTargetId(postId);
    if (replyInputRef.current) {
      replyInputRef.current.focus();
    }
  };

  // Logic: Create Thred
  const handleCreateThread = async (e: React.FormEvent) => {
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
  };

  // Logic: Add Reply
  const handleReply = async (e: React.FormEvent) => {
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
          replyToId: replyTargetId,
          imageUrl
        });

        // reload thread
        const updated = await api.fetchThread(activeThreadId);
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
    };

  const navigateToBoard = (boardId: BoardType) => {
    setCurrentBoard(boardId);
    setActiveThreadId(null);
    setIsHomeView(false);
    setIsCreatingThred(false);
    setReplyTargetId(null);
  };

  const navigateToThread = async (thread: Thread) => {
    setActiveThreadId(thread.id);
    setIsHomeView(false);

    const full = await api.fetchThread(thread.id);
    setActiveThread(full);
  };

  const goHome = () => {
    setIsHomeView(true);
    setActiveThreadId(null);
    setIsCreatingThred(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors duration-300">
      <Navbar 
        currentBoard={currentBoard} 
        onBoardChange={navigateToBoard}
        onHome={goHome}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isHomeView={isHomeView}
      />

      <main className="max-w-6xl mx-auto px-4 pt-6">
        
        {isHomeView ? (
          // --- GLOBAL HOME VIEW ---
          <div className="animate-fade-in bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="mb-8 border-b border-gray-100 dark:border-gray-700 pb-4">
              <h1 className="text-2xl font-bold dark:text-white font-mono">Directory of Threds</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">Status: {isOnline ? 'Online' : 'Booting up...60s'} | Account: Anonymous</p>
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

            {/* <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs text-gray-400 font-mono">
                Total Threds: {threds.length} | Threds per board: {MAX_THREDS_PER_BOARD}
              </div>
              <Button onClick={() => {
                setCurrentBoard(BoardType.RANDOM);
                setIsHomeView(false);
                setIsCreatingThred(true);
              }} variant="secondary" className="w-full sm:w-auto">
                <i className="fas fa-plus mr-2"></i> Quick Post to Random
              </Button>
            </div> */}
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
                        // Find which posts reply to this one
                        const repliesToThis = activeThread.posts.filter(p => p.replyToId === post.id);
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
                       <Button type="submit" disabled={!postContent.trim() || isSubmitting} isLoading={isSubmitting}>Reply</Button>
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
                          required
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
                        <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>Post Thread</Button>
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