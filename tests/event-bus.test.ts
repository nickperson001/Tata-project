import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/services/event-bus.service';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test:event', handler);
    bus.emit('test:event', { foo: 'bar' });

    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('should support multiple handlers for same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('test:multi', h1);
    bus.on('test:multi', h2);
    bus.emit('test:multi', 42);

    expect(h1).toHaveBeenCalledWith(42);
    expect(h2).toHaveBeenCalledWith(42);
  });

  it('should remove listener', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('test:remove', handler);
    bus.emit('test:remove', 'a');
    bus.removeListener('test:remove', handler);
    bus.emit('test:remove', 'b');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not crash on emit with no listeners', () => {
    const bus = new EventBus();
    expect(() => bus.emit('no:listeners', {})).not.toThrow();
  });
});
