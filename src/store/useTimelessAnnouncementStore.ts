import { create } from 'zustand';
import {
  loadTimelessChimeEnabled,
  loadTimelessChimeFromHour,
  loadTimelessChimeMode,
  loadTimelessChimeRandomMinute1,
  loadTimelessChimeRandomMinute2,
  loadTimelessChimeTillHour,
  saveTimelessChimeEnabled,
  saveTimelessChimeFromHour,
  saveTimelessChimeMode,
  saveTimelessChimeRandomMinute1,
  saveTimelessChimeRandomMinute2,
  saveTimelessChimeTillHour
} from '../db/listlessDb';
import type { TimelessChimeMode } from '../types/models';
import {
  cycleTimelessChimeMode,
  DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS,
  isValidRandomPair,
  normalizeHour,
  setRandomPair,
  syncTimelessAnnouncements,
  type TimelessAnnouncementSettings
} from '../utils/timelessAnnouncements';

const RANDOM_HOUR_SLOT_STORAGE_KEY = 'timeless-random-hour-slot-v1';
const HOUR_MS = 60 * 60 * 1000;

const currentHourSlot = (): number => Math.floor(Date.now() / HOUR_MS);

const loadRandomHourSlot = (): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(RANDOM_HOUR_SLOT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const saveRandomHourSlot = (slot: number): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(RANDOM_HOUR_SLOT_STORAGE_KEY, String(slot));
};

const toAnnouncementSettings = (state: {
  enabled: boolean;
  mode: TimelessChimeMode;
  fromHour: number;
  tillHour: number;
  randomMinute1: number;
  randomMinute2: number;
}): TimelessAnnouncementSettings => {
  return {
    enabled: state.enabled,
    mode: state.mode,
    fromHour: state.fromHour,
    tillHour: state.tillHour,
    randomMinute1: state.randomMinute1,
    randomMinute2: state.randomMinute2
  };
};

interface TimelessAnnouncementState {
  enabled: boolean;
  mode: TimelessChimeMode;
  fromHour: number;
  tillHour: number;
  randomMinute1: number;
  randomMinute2: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  cycleMode: (direction: 1 | -1) => void;
  setFromHour: (hour: number) => void;
  setTillHour: (hour: number) => void;
  setEnabled: (enabled: boolean) => void;
  shuffleRandomMinutes: () => void;
  resyncSchedule: () => void;
  tickRandomHour: () => void;
}

export const useTimelessAnnouncementStore = create<TimelessAnnouncementState>((set, get) => ({
  enabled: DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS.enabled,
  mode: DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS.mode,
  fromHour: DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS.fromHour,
  tillHour: DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS.tillHour,
  randomMinute1: DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS.randomMinute1,
  randomMinute2: DEFAULT_TIMELESS_ANNOUNCEMENT_SETTINGS.randomMinute2,
  hydrated: false,

  hydrate: async () => {
    const [enabled, mode, fromHour, tillHour, randomMinute1, randomMinute2] = await Promise.all([
      loadTimelessChimeEnabled(),
      loadTimelessChimeMode(),
      loadTimelessChimeFromHour(),
      loadTimelessChimeTillHour(),
      loadTimelessChimeRandomMinute1(),
      loadTimelessChimeRandomMinute2()
    ]);

    const hasStoredRandomPair =
      randomMinute1 !== null &&
      randomMinute2 !== null &&
      isValidRandomPair(randomMinute1, randomMinute2);

    const nextEnabled = enabled ?? get().enabled;
    const nextMode = mode ?? get().mode;
    const nextFromHour = fromHour ?? get().fromHour;
    const nextTillHour = tillHour ?? get().tillHour;

    let nextRandomPair = hasStoredRandomPair
      ? {
        rM1: randomMinute1,
        rM2: randomMinute2
      }
      : setRandomPair();
    let shouldPersistRandomPair = !hasStoredRandomPair;

    if (nextMode === 'random') {
      const slot = currentHourSlot();
      const storedSlot = loadRandomHourSlot();
      if (storedSlot !== slot) {
        nextRandomPair = setRandomPair();
        shouldPersistRandomPair = true;
      }
      saveRandomHourSlot(slot);
    }

    set(() => ({
      enabled: nextEnabled,
      mode: nextMode,
      fromHour: nextFromHour,
      tillHour: nextTillHour,
      randomMinute1: nextRandomPair.rM1,
      randomMinute2: nextRandomPair.rM2,
      hydrated: true
    }));

    if (shouldPersistRandomPair) {
      void saveTimelessChimeRandomMinute1(nextRandomPair.rM1);
      void saveTimelessChimeRandomMinute2(nextRandomPair.rM2);
    }

    void syncTimelessAnnouncements(
      toAnnouncementSettings({
        enabled: nextEnabled,
        mode: nextMode,
        fromHour: nextFromHour,
        tillHour: nextTillHour,
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      })
    );
  },

  cycleMode: (direction) => {
    set((state) => {
      const nextMode = cycleTimelessChimeMode(state.mode, direction);
      let nextRandomPair = {
        rM1: state.randomMinute1,
        rM2: state.randomMinute2
      };

      if (nextMode === 'random') {
        const slot = currentHourSlot();
        const storedSlot = loadRandomHourSlot();
        const hasValidPair = isValidRandomPair(state.randomMinute1, state.randomMinute2);

        if (!hasValidPair || storedSlot !== slot) {
          nextRandomPair = setRandomPair();
          void saveTimelessChimeRandomMinute1(nextRandomPair.rM1);
          void saveTimelessChimeRandomMinute2(nextRandomPair.rM2);
        }

        saveRandomHourSlot(slot);
      }

      void saveTimelessChimeMode(nextMode);
      void syncTimelessAnnouncements(
        toAnnouncementSettings({
          enabled: state.enabled,
          mode: nextMode,
          fromHour: state.fromHour,
          tillHour: state.tillHour,
          randomMinute1: nextRandomPair.rM1,
          randomMinute2: nextRandomPair.rM2
        })
      );

      return {
        mode: nextMode,
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      };
    });
  },

  setFromHour: (hour) => {
    set((state) => {
      const nextFromHour = normalizeHour(hour);
      void saveTimelessChimeFromHour(nextFromHour);
      void syncTimelessAnnouncements(
        toAnnouncementSettings({
          enabled: state.enabled,
          mode: state.mode,
          fromHour: nextFromHour,
          tillHour: state.tillHour,
          randomMinute1: state.randomMinute1,
          randomMinute2: state.randomMinute2
        })
      );

      return {
        fromHour: nextFromHour
      };
    });
  },

  setTillHour: (hour) => {
    set((state) => {
      const nextTillHour = normalizeHour(hour);
      void saveTimelessChimeTillHour(nextTillHour);
      void syncTimelessAnnouncements(
        toAnnouncementSettings({
          enabled: state.enabled,
          mode: state.mode,
          fromHour: state.fromHour,
          tillHour: nextTillHour,
          randomMinute1: state.randomMinute1,
          randomMinute2: state.randomMinute2
        })
      );

      return {
        tillHour: nextTillHour
      };
    });
  },

  setEnabled: (enabled) => {
    set((state) => {
      let nextRandomPair = {
        rM1: state.randomMinute1,
        rM2: state.randomMinute2
      };

      if (enabled && state.mode === 'random') {
        const slot = currentHourSlot();
        const storedSlot = loadRandomHourSlot();
        const hasValidPair = isValidRandomPair(state.randomMinute1, state.randomMinute2);
        if (!hasValidPair || storedSlot !== slot) {
          nextRandomPair = setRandomPair();
          void saveTimelessChimeRandomMinute1(nextRandomPair.rM1);
          void saveTimelessChimeRandomMinute2(nextRandomPair.rM2);
        }
        saveRandomHourSlot(slot);
      }

      void saveTimelessChimeEnabled(enabled);
      void syncTimelessAnnouncements(
        toAnnouncementSettings({
          enabled,
          mode: state.mode,
          fromHour: state.fromHour,
          tillHour: state.tillHour,
          randomMinute1: nextRandomPair.rM1,
          randomMinute2: nextRandomPair.rM2
        })
      );

      return {
        enabled,
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      };
    });
  },

  shuffleRandomMinutes: () => {
    set((state) => {
      const nextRandomPair = setRandomPair();
      void saveTimelessChimeRandomMinute1(nextRandomPair.rM1);
      void saveTimelessChimeRandomMinute2(nextRandomPair.rM2);
      saveRandomHourSlot(currentHourSlot());
      void syncTimelessAnnouncements(
        toAnnouncementSettings({
          enabled: state.enabled,
          mode: state.mode,
          fromHour: state.fromHour,
          tillHour: state.tillHour,
          randomMinute1: nextRandomPair.rM1,
          randomMinute2: nextRandomPair.rM2
        })
      );

      return {
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      };
    });
  },

  resyncSchedule: () => {
    const state = get();
    if (!state.hydrated) {
      return;
    }

    let nextRandomPair = {
      rM1: state.randomMinute1,
      rM2: state.randomMinute2
    };
    let shouldUpdatePair = false;

    if (state.mode === 'random') {
      const slot = currentHourSlot();
      const storedSlot = loadRandomHourSlot();
      const hasValidPair = isValidRandomPair(state.randomMinute1, state.randomMinute2);
      if (!hasValidPair || storedSlot !== slot) {
        nextRandomPair = setRandomPair();
        shouldUpdatePair = true;
        void saveTimelessChimeRandomMinute1(nextRandomPair.rM1);
        void saveTimelessChimeRandomMinute2(nextRandomPair.rM2);
      }
      saveRandomHourSlot(slot);
    }

    if (shouldUpdatePair) {
      set({
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      });
    }

    void syncTimelessAnnouncements(
      toAnnouncementSettings({
        enabled: state.enabled,
        mode: state.mode,
        fromHour: state.fromHour,
        tillHour: state.tillHour,
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      })
    );
  },

  tickRandomHour: () => {
    const state = get();
    if (!state.hydrated || state.mode !== 'random') {
      return;
    }

    const slot = currentHourSlot();
    const storedSlot = loadRandomHourSlot();
    if (storedSlot === slot && isValidRandomPair(state.randomMinute1, state.randomMinute2)) {
      return;
    }

    const nextRandomPair = setRandomPair();
    void saveTimelessChimeRandomMinute1(nextRandomPair.rM1);
    void saveTimelessChimeRandomMinute2(nextRandomPair.rM2);
    saveRandomHourSlot(slot);

    set({
      randomMinute1: nextRandomPair.rM1,
      randomMinute2: nextRandomPair.rM2
    });

    void syncTimelessAnnouncements(
      toAnnouncementSettings({
        enabled: state.enabled,
        mode: state.mode,
        fromHour: state.fromHour,
        tillHour: state.tillHour,
        randomMinute1: nextRandomPair.rM1,
        randomMinute2: nextRandomPair.rM2
      })
    );
  }
}));
