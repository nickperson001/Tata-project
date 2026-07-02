import { EventEmitter } from 'events';
import { injectable } from 'tsyringe';
import type { IEventBus } from '../types/interfaces';

@injectable()
export class EventBus implements IEventBus {
  private ee = new EventEmitter();

  constructor() {
    this.ee.setMaxListeners(50);
  }

  emit<T>(event: string, data: T): void {
    this.ee.emit(event, data);
  }

  on<T>(event: string, handler: (data: T) => void): void {
    this.ee.on(event, handler);
  }

  removeListener(event: string, handler: (...args: any[]) => void): void {
    this.ee.off(event, handler);
  }
}
