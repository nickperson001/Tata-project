import type { Server as SocketIOServer } from 'socket.io';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogEntry, BotStatus } from '../types';

let ioRef: SocketIOServer | null = null;
let supabaseRef: SupabaseClient | null = null;

export function setIO(io: SocketIOServer): void {
  ioRef = io;
}
export function setSupabase(supabase: SupabaseClient): void {
  supabaseRef = supabase;
}
export function getIO(): SocketIOServer | null {
  return ioRef;
}
export function getSupabase(): SupabaseClient | null {
  return supabaseRef;
}

export interface CircuitState {
  failures: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  openedAt: number;
}

export const state: {
  botStatus: BotStatus;
  currentQR: string;
  pairingCode: string;
  clientReady: boolean;
  maintenanceMode: boolean;
  waClient: any;
  isInitializing: boolean;
  isBotRunning: boolean;
  waDestroyLock: boolean;
  pendingRetryTimer: NodeJS.Timeout | null;
  waRetryCount: number;
  pgPool: any;
  _cache: Map<string, { val: unknown; ts: number; ttl: number }>;
  _circuit: CircuitState;
  systemLogs: LogEntry[];
  activeBroadcasts: Map<string, unknown>;
  emergencySent: boolean;
} = {
  botStatus: 'Initializing',
  currentQR: '',
  pairingCode: '',
  clientReady: false,
  maintenanceMode: false,
  waClient: null,
  isInitializing: false,
  isBotRunning: false,
  waDestroyLock: false,
  pendingRetryTimer: null,
  waRetryCount: 0,
  pgPool: null,
  _cache: new Map(),
  _circuit: { failures: 0, state: 'CLOSED', openedAt: 0 },
  systemLogs: [],
  activeBroadcasts: new Map(),
  emergencySent: false,
};

export function addLog(level: string, message: string, data?: unknown): void {
  const log: LogEntry = {
    timestamp: new Date().toISOString(),
    level: level as LogEntry['level'],
    message,
    data,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  };
  state.systemLogs.unshift(log);
  if (state.systemLogs.length > 1000) state.systemLogs.pop();
  try {
    if (ioRef) (ioRef as any).emit('system_log', log);
  } catch {
    /* ignore */
  }
  console.log(`[${level.toUpperCase()}] ${message}`);
}
