export type ViewMode = 'card' | 'list' | 'preview';
export type HomeMode = 'listless' | 'noteless' | 'timeless';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  note: string;
  subtasks: Subtask[];
}

export interface List {
  id: string;
  title: string;
  createdAt: number;
  tasks: Task[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface TimeReminder {
  id: string;
  name: string;
  fireAt: number;
  canceled: boolean;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
