import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  isLoading,
  disabled,
  ...props 
}) => {
  const baseStyle = "px-4 py-2 rounded font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-400",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:ring-gray-500",
    accent: "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 focus:ring-purple-500 shadow-md hover:shadow-lg dark:shadow-none",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <i className="fas fa-circle-notch fa-spin"></i>}
      {children}
    </button>
  );
};