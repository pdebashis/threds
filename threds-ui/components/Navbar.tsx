import React from 'react';
import { BoardType } from '../types';
import { BOARDS } from '../constants';

interface NavbarProps {
  currentBoard: BoardType;
  onBoardChange: (b: BoardType) => void;
  onHome: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isHomeView: boolean;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  currentBoard,
  onBoardChange,
  onHome,
  isDarkMode,
  toggleDarkMode,
  isHomeView
}) => (
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
));

Navbar.displayName = 'Navbar';
