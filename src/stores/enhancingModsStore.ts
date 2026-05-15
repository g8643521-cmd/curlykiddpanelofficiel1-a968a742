import { create } from 'zustand';

interface EnhancingModsStore {
  enhancingMods: Map<string, number>; // modId -> startTime (ms)
  addMod: (id: string) => void;
  removeMod: (id: string) => void;
  getStartTime: (id: string) => number | undefined;
}

export const useEnhancingModsStore = create<EnhancingModsStore>((set, get) => ({
  enhancingMods: new Map(),
  addMod: (id) => set((state) => {
    const next = new Map(state.enhancingMods);
    next.set(id, Date.now());
    return { enhancingMods: next };
  }),
  removeMod: (id) => set((state) => {
    const next = new Map(state.enhancingMods);
    next.delete(id);
    return { enhancingMods: next };
  }),
  getStartTime: (id) => get().enhancingMods.get(id),
}));
