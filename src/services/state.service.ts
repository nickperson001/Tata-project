import { injectable } from 'tsyringe';
import Redis from 'ioredis';
import type { BotState, BotStatus, DialogState, LogEntry, MaintenanceMode } from '../types';
import type { IStateService } from '../types/interfaces';

function getDefaultState(): BotState {
  return {
    botStatus: 'Initializing',
    currentQR: '',
    pairingCode: '',
    clientReady: false,
    maintenanceMode: false,
    waRetryCount: 0,
    isInitializing: false,
    isBotRunning: false,
    waDestroyLock: false,
  };
}

@injectable()
export class RedisStateService implements IStateService {
  private redis: Redis | null = null;
  private fallbackStore: Map<string, string> = new Map();
  private localState: BotState = getDefaultState();
  private logs: LogEntry[] = [];
  private stateListeners: Array<(state: BotState) => void> = [];
  private redisAvailable = false;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) {
              this.redisAvailable = false;
              return null;
            }
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });
        await this.redis.connect();
        this.redisAvailable = true;

        // Subscribe to state changes
        const sub = this.redis.duplicate();
        await sub.subscribe('bot:state:changed');
        sub.on('message', (_channel: string, message: string) => {
          try {
            this.localState = JSON.parse(message);
            this.stateListeners.forEach((cb) => cb(this.localState));
          } catch {
            // ignore parse errors
          }
        });
      } catch {
        this.redisAvailable = false;
        this.redis = null;
      }
    }
  }

  private async ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
  }

  private async redisGet(key: string): Promise<string | null> {
    if (this.redisAvailable && this.redis) {
      try {
        return await this.redis.get(key);
      } catch {
        this.redisAvailable = false;
      }
    }
    return this.fallbackStore.get(key) || null;
  }

  private async redisSet(key: string, value: string, mode?: string, ttl?: number): Promise<void> {
    if (this.redisAvailable && this.redis) {
      try {
        if (mode === 'EX' && ttl) {
          await this.redis.set(key, value, 'EX', ttl);
        } else {
          await this.redis.set(key, value);
        }
        return;
      } catch {
        this.redisAvailable = false;
      }
    }
    this.fallbackStore.set(key, value);
  }

  private async redisDel(...keys: string[]): Promise<void> {
    if (this.redisAvailable && this.redis) {
      try {
        await this.redis.del(keys);
        return;
      } catch {
        this.redisAvailable = false;
      }
    }
    keys.forEach((k) => this.fallbackStore.delete(k));
  }

  // ── Bot State ──

  async getState(): Promise<Readonly<BotState>> {
    await this.ensureInit();
    const raw = await this.redisGet('bot:state');
    if (raw) {
      try {
        this.localState = { ...this.localState, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
    }
    return Object.freeze({ ...this.localState });
  }

  async updateState(partial: Partial<BotState>): Promise<void> {
    await this.ensureInit();
    Object.assign(this.localState, partial);
    const json = JSON.stringify(this.localState);
    await this.redisSet('bot:state', json);

    if (this.redisAvailable && this.redis) {
      try {
        await this.redis.publish('bot:state:changed', json);
      } catch {
        /* ignore */
      }
    }

    this.stateListeners.forEach((cb) => {
      try {
        cb(this.localState);
      } catch {
        /* ignore */
      }
    });
  }

  onStateChange(cb: (state: BotState) => void): void {
    this.stateListeners.push(cb);
  }

  // ── QR Code ──

  async getQR(): Promise<{ qr: string; pairingCode: string } | null> {
    await this.ensureInit();
    const raw = await this.redisGet('bot:qr');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setQR(qr: string, pairingCode: string): Promise<void> {
    await this.ensureInit();
    await this.redisSet('bot:qr', JSON.stringify({ qr, pairingCode }), 'EX', 300);
  }

  async clearQR(): Promise<void> {
    await this.ensureInit();
    await this.redisDel('bot:qr');
  }

  // ── Dialog State ──

  async getDialog<T>(key: string): Promise<DialogState<T> | null> {
    await this.ensureInit();
    const raw = await this.redisGet(`dialog:${key}`);
    if (!raw) return null;
    try {
      const parsed: DialogState<T> = JSON.parse(raw);
      if (Date.now() - parsed.createdAt > parsed.ttl) {
        await this.redisDel(`dialog:${key}`);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async setDialog<T>(key: string, data: T, ttlMs = 300_000): Promise<void> {
    await this.ensureInit();
    const entry: DialogState<T> = { data, createdAt: Date.now(), ttl: ttlMs };
    await this.redisSet(`dialog:${key}`, JSON.stringify(entry), 'PX', ttlMs);
  }

  async delDialog(key: string): Promise<void> {
    await this.ensureInit();
    await this.redisDel(`dialog:${key}`);
  }

  // ── Cache ──

  async getCache<T>(key: string): Promise<T | null> {
    await this.ensureInit();
    const raw = await this.redisGet(`cache:${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setCache<T>(key: string, value: T, ttlMs = 60_000): Promise<void> {
    await this.ensureInit();
    await this.redisSet(`cache:${key}`, JSON.stringify(value), 'PX', ttlMs);
  }

  async invalidateCache(prefix: string): Promise<void> {
    await this.ensureInit();
    if (this.redisAvailable && this.redis) {
      try {
        const pattern = `cache:${prefix}:*`;
        const stream = this.redis.scanStream({ match: pattern, count: 100 });
        let pipeline = this.redis.pipeline();
        let batchSize = 0;
        for await (const keys of stream) {
          if (keys.length > 0) {
            pipeline.del(keys);
            batchSize += keys.length;
          }
          if (batchSize >= 500) {
            await pipeline.exec();
            pipeline = this.redis.pipeline();
            batchSize = 0;
          }
        }
        if (batchSize > 0) await pipeline.exec();
        return;
      } catch {
        this.redisAvailable = false;
      }
    }
    // Fallback: clear all matching keys
    for (const key of this.fallbackStore.keys()) {
      if (key.startsWith(`cache:${prefix}`)) {
        this.fallbackStore.delete(key);
      }
    }
  }

  // ── Message Dedup ──

  async isMessageProcessed(messageId: string): Promise<boolean> {
    await this.ensureInit();
    if (this.redisAvailable && this.redis) {
      try {
        return (await this.redis.sismember('msg:processed', messageId)) === 1;
      } catch {
        this.redisAvailable = false;
      }
    }
    return this.fallbackStore.has(`msg:${messageId}`);
  }

  async markMessageProcessed(messageId: string, _userId: string): Promise<void> {
    await this.ensureInit();
    if (this.redisAvailable && this.redis) {
      try {
        await this.redis.sadd('msg:processed', messageId);
        await this.redis.expire('msg:processed', 86400);
        return;
      } catch {
        this.redisAvailable = false;
      }
    }
    this.fallbackStore.set(`msg:${messageId}`, '1');
  }

  // ── Logging ──

  addLog(level: string, message: string, data?: unknown): void {
    const log: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level as LogEntry['level'],
      message,
      data,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    };
    this.logs.unshift(log);
    if (this.logs.length > 1000) {
      this.logs.pop();
    }

    if (this.redisAvailable && this.redis) {
      try {
        this.redis.lpush('logs', JSON.stringify(log));
        this.redis.ltrim('logs', 0, 999);
      } catch {
        /* ignore */
      }
    }

    console.log(`[${level.toUpperCase()}] ${message}`);
  }

  getLogs(limit = 100): LogEntry[] {
    return this.logs.slice(0, limit);
  }

  // ── Maintenance Mode ──

  async getMaintenanceMode(): Promise<MaintenanceMode> {
    const cached = await this.getCache<MaintenanceMode>('maintenance');
    if (cached) return cached;
    return { active: false, message: '' };
  }

  async invalidateMaintenanceCache(): Promise<void> {
    await this.invalidateCache('maintenance');
  }
}
