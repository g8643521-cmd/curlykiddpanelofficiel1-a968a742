import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StreamerModeState {
  isEnabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export const useStreamerMode = create<StreamerModeState>()(
  persist(
    (set) => ({
      isEnabled: false,
      toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
      enable: () => set({ isEnabled: true }),
      disable: () => set({ isEnabled: false }),
    }),
    {
      name: 'streamer-mode',
    }
  )
);
