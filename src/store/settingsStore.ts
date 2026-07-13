'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  fabColor: string;
  setFabColor: (color: string) => void;
}

const DEFAULT_FAB_COLOR = 'oklch(62% 0.17 258)';

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fabColor: DEFAULT_FAB_COLOR,
      setFabColor: (color: string) => set({ fabColor: color }),
    }),
    {
      name: 'stockmaster-settings',
    }
  )
);