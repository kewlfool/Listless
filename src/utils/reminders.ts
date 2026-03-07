import { createId } from '../types/models';

export interface ListReminder {
  id: string;
  listId: string;
  listTitle: string;
  name?: string;
  fireAt: number;
}

interface ReminderResult {
  ok: boolean;
  message?: string;
  reminder?: ListReminder;
}

const STORAGE_KEY = 'listless-reminders-v1';
const timers = new Map<string, number>();

const canUseBrowserStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const parseReminder = (value: unknown): ListReminder | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.listId !== 'string' ||
    typeof row.listTitle !== 'string' ||
    typeof row.fireAt !== 'number' ||
    !Number.isFinite(row.fireAt)
  ) {
    return null;
  }

  return {
    id: row.id,
    listId: row.listId,
    listTitle: row.listTitle,
    name: typeof row.name === 'string' ? row.name : undefined,
    fireAt: row.fireAt
  };
};

const readReminders = (): ListReminder[] => {
  if (!canUseBrowserStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((row) => parseReminder(row))
      .filter((row): row is ListReminder => row !== null);
  } catch {
    return [];
  }
};

const writeReminders = (reminders: ListReminder[]): void => {
  if (!canUseBrowserStorage()) {
    return;
  }

  if (reminders.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
};

const clearTimer = (id: string): void => {
  const timerId = timers.get(id);
  if (timerId !== undefined) {
    window.clearTimeout(timerId);
    timers.delete(id);
  }
};

const showReminderNotification = (reminder: ListReminder): void => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  const reminderName = reminder.name?.trim();
  const notification = new Notification(reminderName || 'Listless reminder', {
    body: reminderName ? `${reminder.listTitle}` : `Time to check "${reminder.listTitle}".`
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

const scheduleReminderTimer = (reminder: ListReminder): void => {
  clearTimer(reminder.id);

  const timeoutMs = Math.max(0, reminder.fireAt - Date.now());
  const timeoutId = window.setTimeout(() => {
    showReminderNotification(reminder);
    const next = readReminders().filter((row) => row.id !== reminder.id);
    writeReminders(next);
    clearTimer(reminder.id);
  }, timeoutMs);

  timers.set(reminder.id, timeoutId);
};

const pruneExpiredReminders = (reminders: ListReminder[]): ListReminder[] => {
  const now = Date.now();
  const active = reminders.filter((row) => row.fireAt > now);
  const dedupedByList = new Map<string, ListReminder>();
  active.forEach((row) => {
    dedupedByList.set(row.listId, row);
  });
  const next = Array.from(dedupedByList.values());

  if (next.length !== reminders.length) {
    const keptIds = new Set(next.map((row) => row.id));
    reminders
      .filter((row) => !keptIds.has(row.id))
      .forEach((row) => {
        clearTimer(row.id);
      });
    writeReminders(next);
  }

  return next;
};

const ensureNotificationPermission = async (): Promise<ReminderResult> => {
  if (typeof Notification === 'undefined') {
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
      message: 'Notifications are blocked. Enable them in browser settings.'
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

export const bootReminderTimers = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const reminders = pruneExpiredReminders(readReminders());
  reminders.forEach((reminder) => {
    scheduleReminderTimer(reminder);
  });
};

export const getListReminder = (listId: string): ListReminder | null => {
  const reminders = pruneExpiredReminders(readReminders());
  return reminders.find((row) => row.listId === listId) ?? null;
};

export const clearListReminder = (listId: string): void => {
  const reminders = readReminders();
  const next = reminders.filter((row) => row.listId !== listId);

  reminders
    .filter((row) => row.listId === listId)
    .forEach((row) => {
      clearTimer(row.id);
    });

  writeReminders(next);
};

export const setListReminder = async ({
  listId,
  listTitle,
  name,
  fireAt,
  durationMs,
  minutes
}: {
  listId: string;
  listTitle: string;
  name?: string;
  fireAt?: number;
  durationMs?: number;
  minutes?: number;
}): Promise<ReminderResult> => {
  const permission = await ensureNotificationPermission();
  if (!permission.ok) {
    return permission;
  }

  const resolvedFireAt =
    typeof fireAt === 'number'
      ? Math.round(fireAt)
      : Date.now() +
        (typeof durationMs === 'number'
          ? Math.round(durationMs)
          : Math.round((Number(minutes ?? 0) || 0) * 60 * 1000));

  if (!Number.isFinite(resolvedFireAt) || resolvedFireAt <= Date.now()) {
    return {
      ok: false,
      message: 'Choose a future date and time.'
    };
  }

  const current = pruneExpiredReminders(readReminders());
  const next = current.filter((row) => row.listId !== listId);

  current
    .filter((row) => row.listId === listId)
    .forEach((row) => {
      clearTimer(row.id);
    });

  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const reminder: ListReminder = {
    id: createId(),
    listId,
    listTitle,
    name: normalizedName || undefined,
    fireAt: resolvedFireAt
  };

  next.push(reminder);
  writeReminders(next);
  scheduleReminderTimer(reminder);

  return {
    ok: true,
    reminder
  };
};
