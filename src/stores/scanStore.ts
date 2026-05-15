import { create } from 'zustand';

export type ScanPhase = 
  | 'initializing'
  | 'fetching_members'
  | 'checking_database'
  | 'processing'
  | 'sending_alerts'
  | 'finishing'
  | 'done';

const PHASE_LABELS: Record<ScanPhase, string> = {
  initializing: 'Initialiserer scan…',
  fetching_members: 'Henter medlemsliste fra Discord…',
  checking_database: 'Tjekker mod cheater-database…',
  processing: 'Behandler medlemmer…',
  sending_alerts: 'Sender alerts til Discord…',
  finishing: 'Færdiggør scan…',
  done: 'Scan fuldført',
};

export function getPhaseLabel(phase: ScanPhase): string {
  return PHASE_LABELS[phase] || 'Scanner…';
}

export interface ScanProgress {
  totalMembers: number;
  checked: number;
  skipped: number;
  alerts: number;
  batch: number;
  startedAt: Date;
  scanId: string;
  lastBatchLatency: number | null;
  phase: ScanPhase;
  simulatedProgress: number;
}

const ACTIVE_SCAN_KEY = 'activeScan';

export interface ActiveScanInfo {
  scanHistoryId: string;
  serverId: string;
  serverName: string;
  scanId: string;
  startedAt: string;
  memberCount: number;
  guildId: string;
}

interface ScanState {
  isScanning: boolean;
  scanServerId: string | null;
  scanServerName: string | null;
  scanHistoryId: string | null;
  abortController: AbortController | null;
  progress: ScanProgress | null;
  startScan: (serverId: string, serverName: string, startedAt?: Date, scanId?: string) => AbortController;
  updateProgress: (p: Partial<ScanProgress>) => void;
  requestStop: () => void;
  stopScan: () => void;
  finishScan: () => void;
  setScanHistoryId: (id: string) => void;
  persistActiveScan: (info: ActiveScanInfo) => void;
  clearPersistedScan: () => void;
  getPersistedScan: () => ActiveScanInfo | null;
  restoreScan: (info: ActiveScanInfo) => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  isScanning: false,
  scanServerId: null,
  scanServerName: null,
  scanHistoryId: null,
  abortController: null,
  progress: null,

  startScan: (serverId, serverName, startedAt, scanId) => {
    const prev = get().abortController;
    if (prev) prev.abort();
    const controller = new AbortController();
    const scanStartedAt = startedAt ?? new Date();
    const activeScanId = scanId ?? crypto.randomUUID();
    set({
      isScanning: true,
      scanServerId: serverId,
      scanServerName: serverName,
      scanHistoryId: null,
      abortController: controller,
      progress: {
        totalMembers: 0,
        checked: 0,
        skipped: 0,
        alerts: 0,
        batch: 0,
        startedAt: scanStartedAt,
        scanId: activeScanId,
        lastBatchLatency: null,
        phase: 'initializing',
        simulatedProgress: 0,
      },
    });
    return controller;
  },

  setScanHistoryId: (id) => {
    set({ scanHistoryId: id });
  },

  persistActiveScan: (info) => {
    try {
      localStorage.setItem(ACTIVE_SCAN_KEY, JSON.stringify(info));
    } catch {}
  },

  clearPersistedScan: () => {
    try {
      localStorage.removeItem(ACTIVE_SCAN_KEY);
    } catch {}
  },

  getPersistedScan: () => {
    try {
      const raw = localStorage.getItem(ACTIVE_SCAN_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ActiveScanInfo;
    } catch {
      return null;
    }
  },

  restoreScan: (info) => {
    set({
      isScanning: true,
      scanServerId: info.serverId,
      scanServerName: info.serverName,
      scanHistoryId: info.scanHistoryId,
      abortController: new AbortController(),
      progress: {
        totalMembers: info.memberCount,
        checked: 0,
        skipped: 0,
        alerts: 0,
        batch: 0,
        startedAt: new Date(info.startedAt),
        scanId: info.scanId,
        lastBatchLatency: null,
        phase: 'processing',
        simulatedProgress: 0,
      },
    });
  },

  updateProgress: (p) => {
    const current = get().progress;
    if (current) {
      set({ progress: { ...current, ...p } });
    }
  },

  requestStop: () => {
    const controller = get().abortController;
    if (controller && !controller.signal.aborted) controller.abort();
  },

  stopScan: () => {
    const controller = get().abortController;
    if (controller) controller.abort();
    get().clearPersistedScan();
    set({ isScanning: false, scanServerId: null, scanServerName: null, scanHistoryId: null, abortController: null, progress: null });
  },

  finishScan: () => {
    get().clearPersistedScan();
    set({ isScanning: false, scanServerId: null, scanServerName: null, scanHistoryId: null, abortController: null, progress: null });
  },
}));
