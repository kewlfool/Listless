import { create } from 'zustand';
import { loadHomeMode, saveHomeMode } from '../db/listlessDb';
import type { HomeMode } from '../types/models';

interface HomeState {
  homeMode: HomeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setHomeMode: (mode: HomeMode) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  homeMode: 'listless',
  hydrated: false,

  hydrate: async () => {
    const mode = await loadHomeMode();
    set((state) => ({
      homeMode: mode ?? state.homeMode,
      hydrated: true
    }));
  },

  setHomeMode: (mode: HomeMode) => {
    set({ homeMode: mode });
    void saveHomeMode(mode);
  }
}));
