import { create } from 'zustand';
import {
  loadTimeReminders,
  removeTimeReminderFromDB,
  saveTimeReminder,
  saveTimeReminders
} from '../db/listlessDb';
import { createId, type TimeReminder } from '../types/models';

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

const clearAllReminderTimers = (): void => {
  timers.forEach((timerId, id) => {
    window.clearTimeout(timerId);
    timers.delete(id);
  });
};

const canUseNotifications = (): boolean => {
  return typeof Notification !== 'undefined';
};

const ensureNotificationPermission = async (): Promise<ReminderMutationResult> => {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      ok: false,
      message: 'Notifications require HTTPS (or localhost). Open the app on your secure deployed URL.'
    };
  }

  if (!canUseNotifications()) {
    return {
      ok: false,
      message: 'Notifications are not supported on this browser.'
    };
  }

  if (Notification.permission === 'granted') {
    return { ok: true };
  }

  if (Notification.permission === 'denied') {
    return {
      ok: false,
      message: 'Notifications are blocked for this site. Re-enable in browser/site settings.'
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      message: 'Notification permission was not granted.'
    };
  }

  return { ok: true };
};

const showReminderNotification = (reminder: TimeReminder): void => {
  if (!canUseNotifications() || Notification.permission !== 'granted') {
    return;
  }

  const name = reminder.name.trim() || 'Reminder';
  const notification = new Notification(name, {
    body: 'Reminder time.'
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
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
    if (nextReminder) {
      void saveTimeReminder(nextReminder);
      showReminderNotification(nextReminder);
    }
  };

  const scheduleReminderTimer = (reminder: TimeReminder): void => {
    clearReminderTimer(reminder.id);

    if (reminder.canceled || reminder.completed) {
      return;
    }

    const timeoutMs = reminder.fireAt - Date.now();
    if (timeoutMs <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      markReminderDoneFromTimer(reminder.id);
    }, timeoutMs);

    timers.set(reminder.id, timerId);
  };

  const syncReminderTimer = (reminder: TimeReminder): void => {
    if (!isFutureTime(reminder.fireAt) || reminder.canceled || reminder.completed) {
      clearReminderTimer(reminder.id);
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
      void removeTimeReminderFromDB(reminderId);
    }
  };
});
