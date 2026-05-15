import { create } from 'zustand';

type OperationType = 'setup' | 'post' | 'deleteWelcome' | 'delete7Days' | 'deleteAll' | null;

interface DiscordSetupState {
  logs: string[];
  isProcessing: boolean;
  operationType: OperationType;
  startedAt: Date | null;
  
  // Actions
  startOperation: (type: OperationType) => void;
  addLog: (log: string) => void;
  setLogs: (logs: string[]) => void;
  finishOperation: () => void;
  clearLogs: () => void;
}

export const useDiscordSetupStore = create<DiscordSetupState>((set) => ({
  logs: [],
  isProcessing: false,
  operationType: null,
  startedAt: null,
  
  startOperation: (type) => set({ 
    isProcessing: true, 
    operationType: type, 
    logs: [],
    startedAt: new Date() 
  }),
  
  addLog: (log) => set((state) => ({ 
    logs: [...state.logs, log] 
  })),
  
  setLogs: (logs) => set({ logs }),
  
  finishOperation: () => set({ 
    isProcessing: false, 
    operationType: null 
  }),
  
  clearLogs: () => set({ 
    logs: [], 
    startedAt: null 
  }),
}));
