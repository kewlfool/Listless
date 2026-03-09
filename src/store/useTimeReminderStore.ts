import { create } from 'zustand';
import {
  loadTimeReminders,
  removeTimeReminderFromDB,
  saveTimeReminder,
  saveTimeReminders
} from '../db/listlessDb';
import { createId, type TimeReminder } from '../types/models';
import {
  ensureCordovaLocalNotificationPermission,
  getCordovaLocalNotificationPlugin,
  isCordovaRuntime,
  type CordovaLocalNotificationPlugin
} from '../utils/cordovaLocalNotifications';

interface ReminderMutationResult {
  ok: boolean;
  message?: string;
  reminder?: TimeReminder;
}

interface TimeReminderState {
  reminders: TimeReminder[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createReminder: (payload: { name: string; fireAt: number }) => Promise<ReminderMutationResult>;
  updateReminder: (reminderId: string, payload: { name: string; fireAt: number }) => Promise<ReminderMutationResult>;
  toggleReminderCanceled: (reminderId: string) => void;
  toggleReminderCompleted: (reminderId: string) => void;
  deleteReminder: (reminderId: string) => void;
}

const timers = new Map<string, number>();
let devicereadyReminderRetryAttached = false;
const CORDOVA_REMINDER_ID_MOD = 2000000000;

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
};

const reminderNotificationId = (reminderId: string): number => {
  let hash = 7;
  for (let index = 0; index < reminderId.length; index += 1) {
    hash = (hash * 31 + reminderId.charCodeAt(index)) % CORDOVA_REMINDER_ID_MOD;
  }

  return Math.max(1, hash);
};

const cancelCordovaReminder = (
  plugin: CordovaLocalNotificationPlugin | null,
  reminderId: string
): void => {
  if (!plugin?.cancel) {
    return;
  }

  try {
    const result = plugin.cancel(reminderNotificationId(reminderId));
    if (isPromiseLike(result)) {
      void result.catch(() => undefined);
    }
  } catch {
    // no-op
  }
};

const scheduleCordovaReminder = (
  plugin: CordovaLocalNotificationPlugin,
  reminder: TimeReminder
): void => {
  const name = reminder.name.trim() || 'Reminder';
  const notification = {
    id: reminderNotificationId(reminder.id),
    title: name,
    text: 'Reminder time.',
    trigger: {
      at: new Date(reminder.fireAt)
    },
    iOSForeground: true,
    data: {
      type: 'time-reminder',
      reminderId: reminder.id,
      fireAt: reminder.fireAt
    }
  };

  try {
    const result = plugin.schedule(notification);
    if (isPromiseLike(result)) {
      void result.catch(() => undefined);
    }
  } catch {
    // no-op
  }
};

const sortReminders = (reminders: TimeReminder[]): TimeReminder[] => {
  return [...reminders].sort((a, b) => a.fireAt - b.fireAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
};

const clearReminderTimer = (id: string): void => {
  const timerId = timers.get(id);
  if (timerId !== undefined) {
    window.clearTimeout(timerId);
    timers.delete(id);
  }
};

const clearReminderSchedule = (id: string): void => {
  clearReminderTimer(id);

  if (isCordovaRuntime()) {
    cancelCordovaReminder(getCordovaLocalNotificationPlugin(), id);
  }
};

const clearAllReminderTimers = (): void => {
  timers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  timers.clear();
};

const attachCordovaReminderRetry = (onReady: () => void): void => {
  if (devicereadyReminderRetryAttached || typeof document === 'undefined') {
    return;
  }

  devicereadyReminderRetryAttached = true;
  document.addEventListener(
    'deviceready',
    () => {
      devicereadyReminderRetryAttached = false;
      onReady();
    },
    { once: true }
  );
};

const scheduleReminderCompletionTimer = (
  reminder: TimeReminder,
  onDue: () => void
): void => {
  const timeoutMs = reminder.fireAt - Date.now();
  if (timeoutMs <= 0) {
    return;
  }

  const timerId = window.setTimeout(onDue, timeoutMs);
  timers.set(reminder.id, timerId);
};

const ensureNotificationPermission = async (): Promise<ReminderMutationResult> => {
  if (!isCordovaRuntime()) {
    return {
      ok: false,
      message: 'Reminders now require the iPhone native build.'
    };
  }

  return await ensureCordovaLocalNotificationPermission(getCordovaLocalNotificationPlugin());
};

const isFutureTime = (fireAt: number): boolean => {
  return Number.isFinite(fireAt) && fireAt > Date.now();
};

export const useTimeReminderStore = create<TimeReminderState>((set, get) => {
  const markReminderDoneFromTimer = (reminderId: string): void => {
    let nextReminder: TimeReminder | undefined;

    set((state) => ({
      reminders: sortReminders(
        state.reminders.map((reminder) => {
          if (reminder.id !== reminderId || reminder.completed || reminder.canceled) {
            return reminder;
          }

          nextReminder = {
            ...reminder,
            completed: true,
            updatedAt: Date.now()
          };

          return nextReminder;
        })
      )
    }));

    clearReminderTimer(reminderId);
    if (isCordovaRuntime()) {
      cancelCordovaReminder(getCordovaLocalNotificationPlugin(), reminderId);
    }
    if (nextReminder) {
      void saveTimeReminder(nextReminder);
    }
  };

  const scheduleReminderTimer = (reminder: TimeReminder): void => {
    clearReminderSchedule(reminder.id);

    if (reminder.canceled || reminder.completed) {
      return;
    }

    const timeoutMs = reminder.fireAt - Date.now();
    if (timeoutMs <= 0) {
      return;
    }

    const plugin = getCordovaLocalNotificationPlugin();
    if (!plugin) {
      attachCordovaReminderRetry(() => {
        get()
          .reminders.forEach((row) => {
            syncReminderTimer(row);
          });
      });
      return;
    }

    scheduleCordovaReminder(plugin, reminder);
    scheduleReminderCompletionTimer(reminder, () => {
      markReminderDoneFromTimer(reminder.id);
    });
  };

  const syncReminderTimer = (reminder: TimeReminder): void => {
    if (!isFutureTime(reminder.fireAt) || reminder.canceled || reminder.completed) {
      clearReminderSchedule(reminder.id);
      return;
    }

    scheduleReminderTimer(reminder);
  };

  return {
    reminders: [],
    hydrated: false,

    hydrate: async () => {
      const stored = await loadTimeReminders();
      const now = Date.now();
      let hasChanges = false;

      const normalized = sortReminders(
        stored.map((reminder) => {
          if (!reminder.canceled && !reminder.completed && reminder.fireAt <= now) {
            hasChanges = true;
            return {
              ...reminder,
              completed: true,
              updatedAt: now
            };
          }

          return reminder;
        })
      );

      clearAllReminderTimers();
      normalized.forEach((reminder) => {
        syncReminderTimer(reminder);
      });

      set({ reminders: normalized, hydrated: true });

      if (hasChanges) {
        void saveTimeReminders(normalized);
      }
    },

    createReminder: async ({ name, fireAt }) => {
      const trimmedName = name.trim() || 'Reminder';
      const resolvedFireAt = Math.round(fireAt);

      if (!isFutureTime(resolvedFireAt)) {
        return {
          ok: false,
          message: 'Choose a future date and time.'
        };
      }

      const permission = await ensureNotificationPermission();
      if (!permission.ok) {
        return permission;
      }

      const now = Date.now();
      const reminder: TimeReminder = {
        id: createId(),
        name: trimmedName,
        fireAt: resolvedFireAt,
        canceled: false,
        completed: false,
        createdAt: now,
        updatedAt: now
      };

      set((state) => ({
        reminders: sortReminders([...state.reminders, reminder])
      }));

      syncReminderTimer(reminder);
      void saveTimeReminder(reminder);

      return {
        ok: true,
        reminder
      };
    },

    updateReminder: async (reminderId, { name, fireAt }) => {
      const reminder = get().reminders.find((row) => row.id === reminderId);
      if (!reminder) {
        return {
          ok: false,
          message: 'Reminder not found.'
        };
      }

      const trimmedName = name.trim() || 'Reminder';
      const resolvedFireAt = Math.round(fireAt);

      if (!isFutureTime(resolvedFireAt)) {
        return {
          ok: false,
          message: 'Choose a future date and time.'
        };
      }

      const permission = await ensureNotificationPermission();
      if (!permission.ok) {
        return permission;
      }

      const updated: TimeReminder = {
        ...reminder,
        name: trimmedName,
        fireAt: resolvedFireAt,
        canceled: false,
        completed: false,
        updatedAt: Date.now()
      };

      set((state) => ({
        reminders: sortReminders(state.reminders.map((row) => (row.id === reminderId ? updated : row)))
      }));

      syncReminderTimer(updated);
      void saveTimeReminder(updated);

      return {
        ok: true,
        reminder: updated
      };
    },

    toggleReminderCanceled: (reminderId) => {
      let updatedReminder: TimeReminder | undefined;

      set((state) => ({
        reminders: sortReminders(
          state.reminders.map((reminder) => {
            if (reminder.id !== reminderId) {
              return reminder;
            }

            updatedReminder = {
              ...reminder,
              canceled: !reminder.canceled,
              updatedAt: Date.now()
            };

            return updatedReminder;
          })
        )
      }));

      if (!updatedReminder) {
        return;
      }

      syncReminderTimer(updatedReminder);
      void saveTimeReminder(updatedReminder);
    },

    toggleReminderCompleted: (reminderId) => {
      let updatedReminder: TimeReminder | undefined;

      set((state) => ({
        reminders: sortReminders(
          state.reminders.map((reminder) => {
            if (reminder.id !== reminderId) {
              return reminder;
            }

            updatedReminder = {
              ...reminder,
              canceled: false,
              completed: !reminder.completed,
              updatedAt: Date.now()
            };

            return updatedReminder;
          })
        )
      }));

      if (!updatedReminder) {
        return;
      }

      syncReminderTimer(updatedReminder);
      void saveTimeReminder(updatedReminder);
    },

    deleteReminder: (reminderId) => {
      set((state) => ({
        reminders: state.reminders.filter((reminder) => reminder.id !== reminderId)
      }));

      clearReminderTimer(reminderId);
      if (isCordovaRuntime()) {
        cancelCordovaReminder(getCordovaLocalNotificationPlugin(), reminderId);
      }
      void removeTimeReminderFromDB(reminderId);
    }
  };
});
