import { createId } from '../types/models';
import {
  ensureCordovaLocalNotificationPermission,
  getCordovaLocalNotificationPlugin,
  isCordovaRuntime,
  type CordovaLocalNotificationPlugin
} from './cordovaLocalNotifications';

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
const CORDOVA_LIST_REMINDER_ID_MOD = 2000000000;

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
};

const listReminderNotificationId = (reminderId: string): number => {
  let hash = 13;
  for (let index = 0; index < reminderId.length; index += 1) {
    hash = (hash * 37 + reminderId.charCodeAt(index)) % CORDOVA_LIST_REMINDER_ID_MOD;
  }

  return Math.max(1, hash);
};

const cancelCordovaListReminder = (
  plugin: CordovaLocalNotificationPlugin | null,
  reminderId: string
): void => {
  if (!plugin?.cancel) {
    return;
  }

  try {
    const result = plugin.cancel(listReminderNotificationId(reminderId));
    if (isPromiseLike(result)) {
      void result.catch(() => undefined);
    }
  } catch {
    // no-op
  }
};

const scheduleCordovaListReminder = (
  plugin: CordovaLocalNotificationPlugin,
  reminder: ListReminder
): void => {
  const reminderName = reminder.name?.trim();
  const notification = {
    id: listReminderNotificationId(reminder.id),
    title: reminderName || 'Listless reminder',
    text: reminderName ? `${reminder.listTitle}` : `Time to check "${reminder.listTitle}".`,
    trigger: {
      at: new Date(reminder.fireAt)
    },
    iOSForeground: true,
    data: {
      type: 'list-reminder',
      reminderId: reminder.id,
      listId: reminder.listId
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

const scheduleReminderTimer = (reminder: ListReminder): void => {
  clearTimer(reminder.id);
  cancelCordovaListReminder(getCordovaLocalNotificationPlugin(), reminder.id);

  const plugin = getCordovaLocalNotificationPlugin();
  if (plugin) {
    scheduleCordovaListReminder(plugin, reminder);
  }

  const timeoutMs = Math.max(0, reminder.fireAt - Date.now());
  const timeoutId = window.setTimeout(() => {
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
        cancelCordovaListReminder(getCordovaLocalNotificationPlugin(), row.id);
      });
    writeReminders(next);
  }

  return next;
};

const ensureNotificationPermission = async (): Promise<ReminderResult> => {
  if (!isCordovaRuntime()) {
    return {
      ok: false,
      message: 'Reminders now require the iPhone native build.'
    };
  }

  return await ensureCordovaLocalNotificationPermission(getCordovaLocalNotificationPlugin());
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
      cancelCordovaListReminder(getCordovaLocalNotificationPlugin(), row.id);
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
      cancelCordovaListReminder(getCordovaLocalNotificationPlugin(), row.id);
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
