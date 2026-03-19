export enum BoardType {
  WORK = 'w',
  RANDOM = 'r',
  TRAVEL = 't',
}

export interface Post {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
  replyToId?: string;
}

export interface Thread {
  id: string;
  boardId: BoardType;
  subject: string;
  timestamp: number;
  posts: Post[];
}

export interface BoardConfig {
  id: BoardType;
  label: string;
  description: string;
  icon: string;
  color: string;
}