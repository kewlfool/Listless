import { create } from 'zustand';
import { loadHomeMode, loadThemeMode, saveHomeMode, saveThemeMode } from '../db/listlessDb';
import type { HomeMode, ThemeMode } from '../types/models';

interface HomeState {
  homeMode: HomeMode;
  themeMode: ThemeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setHomeMode: (mode: HomeMode) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  homeMode: 'listless',
  themeMode: 'light',
  hydrated: false,

  hydrate: async () => {
    const [mode, themeMode] = await Promise.all([loadHomeMode(), loadThemeMode()]);
    set((state) => ({
      homeMode: mode ?? state.homeMode,
      themeMode: themeMode ?? state.themeMode,
      hydrated: true
    }));
  },

  setHomeMode: (mode: HomeMode) => {
    set({ homeMode: mode });
    void saveHomeMode(mode);
  },

  setThemeMode: (mode: ThemeMode) => {
    set({ themeMode: mode });
    void saveThemeMode(mode);
  }
}));
