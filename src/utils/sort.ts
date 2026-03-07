import type { List, Subtask, Task } from '../types/models';

const taskSort = (a: Task, b: Task): number => {
  return Number(a.completed) - Number(b.completed) || a.order - b.order || a.id.localeCompare(b.id);
};

const subtaskSort = (a: Subtask, b: Subtask): number => {
  return Number(a.completed) - Number(b.completed) || a.order - b.order || a.id.localeCompare(b.id);
};

export const sortSubtasks = (subtasks: Subtask[]): Subtask[] => {
  return [...subtasks].sort(subtaskSort);
};

export const sortTasks = (tasks: Task[]): Task[] => {
  return [...tasks]
    .map((task) => ({
      ...task,
      note: task.note ?? '',
      subtasks: sortSubtasks(task.subtasks ?? [])
    }))
    .sort(taskSort);
};

export const normalizeTaskOrder = (tasks: Task[]): Task[] => {
  return tasks.map((task, index) => ({ ...task, order: index }));
};

export const normalizeSubtaskOrder = (subtasks: Subtask[]): Subtask[] => {
  return subtasks.map((subtask, index) => ({ ...subtask, order: index }));
};

export const sortListData = (list: List): List => {
  return {
    ...list,
    tasks: sortTasks(list.tasks)
  };
};
