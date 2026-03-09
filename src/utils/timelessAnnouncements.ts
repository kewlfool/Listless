import type { TimelessChimeMode } from '../types/models';
import {
  ensureCordovaLocalNotificationPermission,
  getCordovaLocalNotificationPlugin,
  isCordovaRuntime,
  type CordovaLocalNotificationPlugin
} from './cordovaLocalNotifications';

export interface TimelessAnnouncementSettings {
  enabled: boolean;
  mode: TimelessChimeMode;
  fromHour: number;
  tillHour: number;
  randomMinute1: number;
  randomMinute2: number;
}

export const setRandomPair = (): { rM1: number; rM2: number } => {
  for (;;) {
    const rM1 = Math.floor(Math.random() * 29) + 1;
    const rM2 = Math.floor(Math.random() * 30) + 30;
    const gap = rM2 - rM1;
    if (gap > 25 && gap < 40) {
      return { rM1, rM2 };
    }
  }
};

export const isValidRandomPair = (rM1: number, rM2: number): boolean => {
  if (!Number.isInteger(rM1) || !Number.isInteger(rM2)) {
    return false;
  }

  if (rM1 < 1 || rM1 > 29) {
    return false;
  }

  if (rM2 < 30 || rM2 > 59) {
    return false;
  }

  const gap = rM2 - rM1;
  return gap > 25 && gap < 40;
};

const DEFAULT_RANDOM_PAIR = setRandomPair();

export const DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS: TimelessAnnouncementSettings = {
  enabled: false,
  mode: 'halfHourly',
  fromHour: 8,
  tillHour: 22,
  randomMinute1: DEFAULT_RANDOM_PAIR.rM1,
  randomMinute2: DEFAULT_RANDOM_PAIR.rM2
};

const CHIME_MODE_ORDER: TimelessChimeMode[] = ['hourly', 'halfHourly', 'random'];
const CORDOVA_SCHEDULED_IDS_KEY = 'timeless-cordova-announcement-ids-v1';
const MAX_SCHEDULED_NOTIFICATIONS = 60;
const SCHEDULE_HORIZON_HOURS = 72;
const REPEATING_NOTIFICATION_ID_BASE = 1400000000;

let devicereadyRetryAttached = false;

export const normalizeHour = (hour: number): number => {
  const rounded = Math.round(hour);
  return ((rounded % 24) + 24) % 24;
};

export const shiftHour = (hour: number, direction: 1 | -1): number => {
  return normalizeHour(hour + direction);
};

export const cycleTimelessChimeMode = (
  mode: TimelessChimeMode,
  direction: 1 | -1
): TimelessChimeMode => {
  const index = CHIME_MODE_ORDER.indexOf(mode);
  const baseIndex = index >= 0 ? index : 0;
  const nextIndex = (baseIndex + direction + CHIME_MODE_ORDER.length) % CHIME_MODE_ORDER.length;
  return CHIME_MODE_ORDER[nextIndex];
};

export const formatHourLabel = (hour: number): string => {
  const normalized = normalizeHour(hour);
  const suffix = normalized >= 12 ? 'pm' : 'am';
  const hour12 = normalized % 12 || 12;
  return `${hour12} ${suffix}`;
};

const formatSpokenLabel = (date: Date): string => {
  const hour = date.getHours() % 12 || 12;
  const minute = date.getMinutes().toString().padStart(2, '0');
  const suffix = date.getHours() >= 12 ? 'PM' : 'AM';
  return `Time announcement: ${hour}:${minute} ${suffix}`;
};

const isMinuteInWindow = (minuteOfDay: number, fromHour: number, tillHour: number): boolean => {
  const start = normalizeHour(fromHour) * 60;
  const end = normalizeHour(tillHour) * 60;

  if (start === end) {
    return true;
  }

  if (start < end) {
    return minuteOfDay >= start && minuteOfDay <= end;
  }

  return minuteOfDay >= start || minuteOfDay <= end;
};

const candidateMinutesForMode = (
  mode: TimelessChimeMode,
  randomPair?: { rM1: number; rM2: number }
): number[] => {
  if (mode === 'hourly') {
    return [0];
  }

  if (mode === 'halfHourly') {
    return [0, 30];
  }

  const { rM1, rM2 } = randomPair ?? setRandomPair();
  return [rM1, rM2];
};

const buildUpcomingDates = (settings: TimelessAnnouncementSettings, now: Date): Date[] => {
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);

  const rows: Date[] = [];

  const initialRandomPair = isValidRandomPair(settings.randomMinute1, settings.randomMinute2)
    ? {
      rM1: settings.randomMinute1,
      rM2: settings.randomMinute2
    }
    : setRandomPair();

  for (let hourOffset = 0; hourOffset <= SCHEDULE_HORIZON_HOURS; hourOffset += 1) {
    if (rows.length >= MAX_SCHEDULED_NOTIFICATIONS) {
      break;
    }

    const hourBase = new Date(cursor.getTime() + hourOffset * 60 * 60 * 1000);
    const minutes = candidateMinutesForMode(
      settings.mode,
      settings.mode === 'random'
        ? hourOffset === 0
          ? initialRandomPair
          : setRandomPair()
        : undefined
    );

    for (const minute of minutes) {
      const at = new Date(hourBase);
      at.setMinutes(minute, 0, 0);

      const timeMs = at.getTime();
      if (timeMs <= now.getTime()) {
        continue;
      }

      const minuteOfDay = at.getHours() * 60 + at.getMinutes();
      if (!isMinuteInWindow(minuteOfDay, settings.fromHour, settings.tillHour)) {
        continue;
      }

      rows.push(at);
      if (rows.length >= MAX_SCHEDULED_NOTIFICATIONS) {
        break;
      }
    }
  }

  rows.sort((a, b) => a.getTime() - b.getTime());
  return rows;
};

const minutesForMode = (settings: TimelessAnnouncementSettings): number[] => {
  if (settings.mode === 'hourly') {
    return [0];
  }

  if (settings.mode === 'halfHourly') {
    return [0, 30];
  }

  if (isValidRandomPair(settings.randomMinute1, settings.randomMinute2)) {
    return [settings.randomMinute1, settings.randomMinute2];
  }

  const nextPair = setRandomPair();
  return [nextPair.rM1, nextPair.rM2];
};

const hoursInWindow = (fromHour: number, tillHour: number): number[] => {
  const start = normalizeHour(fromHour);
  const end = normalizeHour(tillHour);

  if (start === end) {
    return Array.from({ length: 24 }, (_, hour) => hour);
  }

  const rows: number[] = [];
  if (start < end) {
    for (let hour = start; hour <= end; hour += 1) {
      rows.push(hour);
    }
    return rows;
  }

  for (let hour = start; hour <= 23; hour += 1) {
    rows.push(hour);
  }

  for (let hour = 0; hour <= end; hour += 1) {
    rows.push(hour);
  }

  return rows;
};

interface RepeatingScheduleRow {
  id: number;
  hour: number;
  minute: number;
}

const repeatingScheduleRows = (settings: TimelessAnnouncementSettings): RepeatingScheduleRow[] => {
  const hours = hoursInWindow(settings.fromHour, settings.tillHour);
  const minutes = minutesForMode(settings);
  const rows: RepeatingScheduleRow[] = [];

  for (const hour of hours) {
    for (const minute of minutes) {
      rows.push({
        id: REPEATING_NOTIFICATION_ID_BASE + hour * 100 + minute,
        hour,
        minute
      });
    }
  }

  return rows;
};

const getSpokenFileName = (date: Date): string => {
  const hour12 = date.getHours() % 12 || 12;
  const minute = date.getMinutes();
  return `spoken_${hour12}_${minute}.caf`;
};

const getSpokenFileNameForHourMinute = (hour: number, minute: number): string => {
  const hour12 = normalizeHour(hour) % 12 || 12;
  const normalizedMinute = ((minute % 60) + 60) % 60;
  return `spoken_${hour12}_${normalizedMinute}.caf`;
};

const formatSpokenLabelForHourMinute = (hour: number, minute: number): string => {
  const normalizedHour = normalizeHour(hour);
  const hour12 = normalizedHour % 12 || 12;
  const normalizedMinute = ((minute % 60) + 60) % 60;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  return `Time announcement: ${hour12}:${normalizedMinute.toString().padStart(2, '0')} ${suffix}`;
};

const loadStoredCordovaIds = (): number[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CORDOVA_SCHEDULED_IDS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((row) => Number.parseInt(String(row), 10))
      .filter((row) => Number.isInteger(row) && row > 0);
  } catch {
    return [];
  }
};

const saveStoredCordovaIds = (ids: number[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (ids.length === 0) {
    window.localStorage.removeItem(CORDOVA_SCHEDULED_IDS_KEY);
    return;
  }

  window.localStorage.setItem(CORDOVA_SCHEDULED_IDS_KEY, JSON.stringify(ids));
};

const notificationIdFromTimestamp = (timestamp: number): number => {
  const minuteStamp = Math.floor(timestamp / 60000);
  return minuteStamp % 2000000000;
};

const cancelStoredCordovaSchedule = (plugin: CordovaLocalNotificationPlugin | null): void => {
  if (!plugin?.cancel) {
    if (!isCordovaRuntime()) {
      saveStoredCordovaIds([]);
    }
    return;
  }

  const previousIds = loadStoredCordovaIds();
  if (previousIds.length > 0) {
    try {
      plugin.cancel(previousIds);
    } catch {
      // no-op
    }
  }

  saveStoredCordovaIds([]);
};

export const syncTimelessAnnouncements = async (
  settings: TimelessAnnouncementSettings
): Promise<void> => {
  const cordovaRuntime = isCordovaRuntime();
  if (!cordovaRuntime) {
    return;
  }

  const plugin = getCordovaLocalNotificationPlugin();
  cancelStoredCordovaSchedule(plugin);

  if (!settings.enabled) {
    return;
  }

  const upcomingDates = buildUpcomingDates(settings, new Date());
  if (upcomingDates.length < 1) {
    return;
  }

  if (plugin) {
    const permission = await ensureCordovaLocalNotificationPermission(plugin);
    if (!permission.ok) {
      return;
    }

    if (settings.mode !== 'random') {
      const repeatingRows = repeatingScheduleRows(settings);
      if (repeatingRows.length < 1) {
        return;
      }

      const notifications = repeatingRows.map((row) => {
        const fileName = getSpokenFileNameForHourMinute(row.hour, row.minute);
        return {
          id: row.id,
          title: 'Listless Timeless',
          text: formatSpokenLabelForHourMinute(row.hour, row.minute),
          trigger: {
            every: {
              hour: row.hour,
              minute: row.minute
            }
          },
          sound: `www/sounds/${fileName}`,
          iOSForeground: true,
          data: {
            type: 'timeless-announcement-repeating',
            hour: row.hour,
            minute: row.minute,
            fileName
          }
        };
      });

      try {
        await Promise.resolve(plugin.schedule(notifications));
        saveStoredCordovaIds(notifications.map((row) => row.id));
        return;
      } catch {
        // fallback below
      }
    }

    const notifications = upcomingDates.map((at) => {
      const timestamp = at.getTime();
      const fileName = getSpokenFileName(at);
      const id = notificationIdFromTimestamp(timestamp);

      return {
        id,
        title: 'Listless Timeless',
        text: formatSpokenLabel(at),
        trigger: { at },
        sound: `www/sounds/${fileName}`,
        iOSForeground: true,
        data: {
          type: 'timeless-announcement',
          at: timestamp,
          fileName
        }
      };
    });

    try {
      await Promise.resolve(plugin.schedule(notifications));
      saveStoredCordovaIds(notifications.map((row) => row.id));
      return;
    } catch {
      // fallback below
    }
  }

  if (!plugin && !devicereadyRetryAttached) {
    devicereadyRetryAttached = true;
    document.addEventListener(
      'deviceready',
      () => {
        devicereadyRetryAttached = false;
        void syncTimelessAnnouncements(settings);
      },
      { once: true }
    );
  }
};
