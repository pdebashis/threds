import { BoardConfig, BoardType } from './types';

export const MAX_THREDS_PER_BOARD = 10;
export const MAX_POSTS_PER_THREAD = 100;

export const BOARDS: BoardConfig[] = [
  {
    id: BoardType.WORK,
    label: 'Work',
    description: 'Professional discussions and office banter.',
    icon: 'fa-briefcase',
    color: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: BoardType.RANDOM,
    label: 'Random',
    description: 'Chaos, memes, and everything in between.',
    icon: 'fa-shuffle',
    color: 'text-orange-600 dark:text-orange-400'
  }
  // {
  //   id: BoardType.TRAVEL,
  //   label: 'Travel',
  //   description: 'Outside world and adventures.',
  //   icon: 'fa-plane',
  //   color: 'text-teal-600 dark:text-teal-400'
  // }
];