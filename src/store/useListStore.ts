import { create } from 'zustand';
import {
  loadLists,
  loadViewMode,
  removeListFromDB,
  saveList,
  saveViewMode
} from '../db/listlessDb';
import { createId, type List, type Subtask, type Task, type ViewMode } from '../types/models';
import {
  normalizeSubtaskOrder,
  normalizeTaskOrder,
  sortListData,
  sortSubtasks,
  sortTasks
} from '../utils/sort';

interface ListState {
  lists: List[];
  activeListId: string | null;
  viewMode: ViewMode;
  showOverview: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createList: (title: string) => string;
  updateListTitle: (listId: string, title: string) => void;
  deleteList: (listId: string) => void;
  setActiveList: (listId: string) => void;
  moveActiveListBy: (offset: 1 | -1) => void;
  openOverview: () => void;
  closeOverview: () => void;
  setViewMode: (mode: ViewMode) => void;
  addTask: (listId: string, title: string) => void;
  updateTaskTitle: (listId: string, taskId: string, title: string) => void;
  setTaskNote: (listId: string, taskId: string, note: string) => void;
  toggleTask: (listId: string, taskId: string) => void;
  deleteTask: (listId: string, taskId: string) => void;
  clearCompletedTasks: (listId: string) => void;
  reorderTasks: (listId: string, orderedTaskIds: string[]) => void;
  addSubtask: (listId: string, taskId: string, title: string) => void;
  updateSubtaskTitle: (listId: string, taskId: string, subtaskId: string, title: string) => void;
  toggleSubtask: (listId: string, taskId: string, subtaskId: string) => void;
  deleteSubtask: (listId: string, taskId: string, subtaskId: string) => void;
  reorderSubtasks: (listId: string, taskId: string, orderedSubtaskIds: string[]) => void;
}

const persistList = (list: List | undefined): void => {
  if (!list) {
    return;
  }

  void saveList(sortListData(list));
};

const mapById = <T extends { id: string }>(rows: T[]): Map<string, T> => {
  return new Map(rows.map((row) => [row.id, row]));
};

export const useListStore = create<ListState>((set) => ({
  lists: [],
  activeListId: null,
  viewMode: 'card',
  showOverview: false,
  hydrated: false,

  hydrate: async () => {
    const [lists, viewMode] = await Promise.all([loadLists(), loadViewMode()]);
    set((state) => ({
      lists,
      activeListId: state.activeListId ?? lists[0]?.id ?? null,
      viewMode: viewMode ?? state.viewMode,
      hydrated: true
    }));
  },

  createList: (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return '';
    }

    const newList: List = {
      id: createId(),
      title: trimmed,
      createdAt: Date.now(),
      tasks: []
    };

    set((state) => ({
      lists: [...state.lists, newList].sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
      ),
      activeListId: newList.id,
      showOverview: false
    }));

    void saveList(newList);

    return newList.id;
  },

  updateListTitle: (listId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        updatedList = {
          ...list,
          title: trimmed,
          tasks: sortTasks(list.tasks.map((task) => ({ ...task, subtasks: sortSubtasks(task.subtasks) })))
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  deleteList: (listId: string) => {
    set((state) => {
      const lists = state.lists.filter((list) => list.id !== listId);
      const activeListId =
        state.activeListId === listId ? (lists.length ? lists[0].id : null) : state.activeListId;

      return {
        lists,
        activeListId,
        showOverview: lists.length > 0 ? state.showOverview : false
      };
    });

    void removeListFromDB(listId);
  },

  setActiveList: (listId: string) => {
    set({ activeListId: listId });
  },

  moveActiveListBy: (offset: 1 | -1) => {
    set((state) => {
      if (state.lists.length < 2) {
        return state;
      }

      const currentIndex = state.lists.findIndex((list) => list.id === state.activeListId);
      const sourceIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (sourceIndex + offset + state.lists.length) % state.lists.length;

      return {
        ...state,
        activeListId: state.lists[nextIndex].id
      };
    });
  },

  openOverview: () => {
    set({ showOverview: true });
  },

  closeOverview: () => {
    set({ showOverview: false });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
    void saveViewMode(mode);
  },

  addTask: (listId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const shiftedTasks = list.tasks.map((task) => ({
          ...task,
          order: task.order + 1,
          note: task.note ?? '',
          subtasks: sortSubtasks(task.subtasks)
        }));
        const newTask: Task = {
          id: createId(),
          title: trimmed,
          completed: false,
          order: 0,
          note: '',
          subtasks: []
        };

        updatedList = {
          ...list,
          tasks: normalizeTaskOrder(sortTasks([newTask, ...shiftedTasks]))
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  updateTaskTitle: (listId: string, taskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                title: trimmed,
                note: task.note ?? '',
                subtasks: sortSubtasks(task.subtasks)
              }
            : { ...task, note: task.note ?? '', subtasks: sortSubtasks(task.subtasks) }
        );

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  setTaskNote: (listId: string, taskId: string, note: string) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                note,
                subtasks: sortSubtasks(task.subtasks)
              }
            : { ...task, note: task.note ?? '', subtasks: sortSubtasks(task.subtasks) }
        );

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  toggleTask: (listId: string, taskId: string) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) => ({ ...task, subtasks: sortSubtasks(task.subtasks) }));
        const target = tasks.find((task) => task.id === taskId);

        if (!target) {
          return list;
        }

        if (target.completed) {
          tasks.forEach((task) => {
            if (!task.completed) {
              task.order += 1;
            }
          });
          target.completed = false;
          target.order = 0;
        } else {
          target.completed = true;
          target.order = Math.max(...tasks.map((task) => task.order), 0) + 1;
        }

        updatedList = {
          ...list,
          tasks: normalizeTaskOrder(sortTasks(tasks))
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  deleteTask: (listId: string, taskId: string) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        updatedList = {
          ...list,
          tasks: normalizeTaskOrder(sortTasks(list.tasks.filter((task) => task.id !== taskId)))
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  clearCompletedTasks: (listId: string) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        updatedList = {
          ...list,
          tasks: normalizeTaskOrder(sortTasks(list.tasks.filter((task) => !task.completed)))
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  reorderTasks: (listId: string, orderedTaskIds: string[]) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const taskMap = mapById(list.tasks);
        const reordered = orderedTaskIds
          .map((id, index): Task | null => {
            const task = taskMap.get(id);
            if (!task) {
              return null;
            }

            return { ...task, order: index, subtasks: sortSubtasks(task.subtasks) };
          })
          .filter((task): task is Task => task !== null);

        const missing = list.tasks
          .filter((task) => !orderedTaskIds.includes(task.id))
          .map((task, index) => ({ ...task, order: reordered.length + index }));

        updatedList = {
          ...list,
          tasks: normalizeTaskOrder(sortTasks([...reordered, ...missing]))
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  addSubtask: (listId: string, taskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const nextOrder =
            task.subtasks.reduce((maxOrder, subtask) => Math.max(maxOrder, subtask.order), -1) + 1;
          const newSubtask: Subtask = {
            id: createId(),
            title: trimmed,
            completed: false,
            order: nextOrder
          };

          return {
            ...task,
            subtasks: normalizeSubtaskOrder(
              sortSubtasks([...task.subtasks.map((subtask) => ({ ...subtask })), newSubtask])
            )
          };
        });

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  updateSubtaskTitle: (listId: string, taskId: string, subtaskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          return {
            ...task,
            subtasks: normalizeSubtaskOrder(
              sortSubtasks(
                task.subtasks.map((subtask) =>
                  subtask.id === subtaskId ? { ...subtask, title: trimmed } : subtask
                )
              )
            )
          };
        });

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  toggleSubtask: (listId: string, taskId: string, subtaskId: string) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const subtasks = task.subtasks.map((subtask) => ({ ...subtask }));
          const target = subtasks.find((subtask) => subtask.id === subtaskId);

          if (!target) {
            return task;
          }

          if (target.completed) {
            subtasks.forEach((subtask) => {
              if (!subtask.completed) {
                subtask.order += 1;
              }
            });
            target.completed = false;
            target.order = 0;
          } else {
            target.completed = true;
            target.order = Math.max(...subtasks.map((subtask) => subtask.order), 0) + 1;
          }

          return {
            ...task,
            subtasks: normalizeSubtaskOrder(sortSubtasks(subtasks))
          };
        });

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  deleteSubtask: (listId: string, taskId: string, subtaskId: string) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          return {
            ...task,
            subtasks: normalizeSubtaskOrder(
              sortSubtasks(task.subtasks.filter((subtask) => subtask.id !== subtaskId))
            )
          };
        });

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  },

  reorderSubtasks: (listId: string, taskId: string, orderedSubtaskIds: string[]) => {
    let updatedList: List | undefined;

    set((state) => ({
      lists: state.lists.map((list) => {
        if (list.id !== listId) {
          return list;
        }

        const tasks = list.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const subtaskMap = mapById(task.subtasks);
          const reordered = orderedSubtaskIds
            .map((id, index): Subtask | null => {
              const subtask = subtaskMap.get(id);
              if (!subtask) {
                return null;
              }

              return { ...subtask, order: index };
            })
            .filter((subtask): subtask is Subtask => subtask !== null);

          const missing = task.subtasks
            .filter((subtask) => !orderedSubtaskIds.includes(subtask.id))
            .map((subtask, index) => ({ ...subtask, order: reordered.length + index }));

          return {
            ...task,
            subtasks: normalizeSubtaskOrder(sortSubtasks([...reordered, ...missing]))
          };
        });

        updatedList = {
          ...list,
          tasks: sortTasks(tasks)
        };

        return updatedList;
      })
    }));

    persistList(updatedList);
  }
}));

export const selectActiveList = (state: ListState): List | null => {
  return state.lists.find((list) => list.id === state.activeListId) ?? null;
};
