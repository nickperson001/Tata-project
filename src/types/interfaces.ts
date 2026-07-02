import type { Client } from 'whatsapp-web.js';
import type { BotState, BotStatus, DialogState, LogEntry, MaintenanceMode } from './index';

export interface IStateService {
  getState(): Promise<Readonly<BotState>>;
  updateState(partial: Partial<BotState>): Promise<void>;
  getQR(): Promise<{ qr: string; pairingCode: string } | null>;
  setQR(qr: string, pairingCode: string): Promise<void>;
  clearQR(): Promise<void>;
  getDialog<T>(key: string): Promise<DialogState<T> | null>;
  setDialog<T>(key: string, data: T, ttlMs?: number): Promise<void>;
  delDialog(key: string): Promise<void>;
  getCache<T>(key: string): Promise<T | null>;
  setCache<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  invalidateCache(prefix: string): Promise<void>;
  isMessageProcessed(messageId: string): Promise<boolean>;
  markMessageProcessed(messageId: string, userId: string): Promise<void>;
  addLog(level: string, message: string, data?: unknown): void;
  getLogs(limit?: number): LogEntry[];
  getMaintenanceMode(): Promise<MaintenanceMode>;
  invalidateMaintenanceCache(): Promise<void>;
  onStateChange(cb: (state: BotState) => void): void;
}

export interface IWhatsAppService {
  getClient(): Client | null;
  init(): Promise<void>;
  destroy(): Promise<void>;
  getStatus(): Promise<BotStatus>;
  isReady(): Promise<boolean>;
}

export interface IEventBus {
  emit<T>(event: string, data: T): void;
  on<T>(event: string, handler: (data: T) => void): void;
  removeListener(event: string, handler: (...args: any[]) => void): void;
}

export interface ILogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}
