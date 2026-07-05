import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/container';
import type { ILogger } from '../types/interfaces';

export interface JobDefinition {
  name: string;
  interval: string;
  handler: () => Promise<void>;
}

@injectable()
export class QueueService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private redisAvailable = false;
  private logger: ILogger;

  constructor(@inject(TOKENS.Logger) logger?: ILogger) {
    this.logger = logger || (console as unknown as ILogger);
  }

  register(jobs: JobDefinition[]): void {
    for (const job of jobs) {
      this.scheduleJob(job);
    }
  }

  private scheduleJob(job: JobDefinition): void {
    if (this.redisAvailable) {
      this.scheduleBullMQ(job);
    } else {
      this.scheduleFallback(job);
    }
  }

  private scheduleFallback(job: JobDefinition): void {
    const ms = parseCronToMs(job.interval);
    if (ms <= 0) {
      this.logger.warn(`[QueueService] Cannot parse interval "${job.interval}" for job "${job.name}"`);
      return;
    }

    const timer = setInterval(async () => {
      try {
        await job.handler();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[QueueService] Job "${job.name}" failed: ${msg}`);
      }
    }, ms);

    this.timers.set(job.name, timer);
    this.logger.info(`[QueueService] Scheduled fallback job "${job.name}" every ${job.interval}`);
  }

  private async scheduleBullMQ(_job: JobDefinition): Promise<void> {
    // TODO: Implement BullMQ scheduling when Redis is confirmed available
  }

  stopAll(): void {
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      this.logger.info(`[QueueService] Stopped job "${name}"`);
    }
    this.timers.clear();
  }
}

function parseCronToMs(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return -1;

  const minute = parts[0];
  const hour = parts[1];

  if (minute === '*' && hour === '*') return 60_000; // every minute
  if (minute === '*/20') return 20 * 60_000;
  if (minute === '*/2') return 2 * 60_000;
  if (minute === '*/5') return 5 * 60_000;
  if (minute === '*/10') return 10 * 60_000;
  if (minute === '*/30') return 30 * 60_000;
  if (minute === '0') {
    if (hour === '*') return 60 * 60_000;
    if (hour === '*/6') return 6 * 60 * 60_000;
    if (hour.match(/^\d+$/)) {
      // specific hour: run once daily at that hour
      const ms = parseInt(hour) * 60 * 60_000;
      if (ms > Date.now() % (24 * 60 * 60_000)) {
        return ms - (Date.now() % (24 * 60 * 60_000));
      }
      return ms + 24 * 60 * 60_000 - (Date.now() % (24 * 60 * 60_000));
    }
  }
  if (minute === '5' && hour === '0') return 24 * 60 * 60_000;
  if (minute === '59' && hour === '23') return 24 * 60 * 60_000;

  return -1;
}
