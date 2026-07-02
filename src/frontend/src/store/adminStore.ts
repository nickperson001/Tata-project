import { create } from 'zustand';
import type { BotState, LogEntry } from '../types';

interface AdminState {
  botState: BotState | null;
  logs: LogEntry[];
  setBotState: (state: BotState) => void;
  addLog: (log: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  botState: null,
  logs: [],
  setBotState: (botState) => set({ botState }),
  addLog: (log) =>
    set((s) => ({ logs: [log, ...s.logs].slice(0, 1000) })),
  setLogs: (logs) => set({ logs }),
}));
