import { describe, it, expect, beforeEach } from 'vitest';
import { RedisStateService } from '../src/services/state.service';

describe('RedisStateService (in-memory fallback)', () => {
  let service: RedisStateService;

  beforeEach(() => {
    service = new RedisStateService();
  });

  it('should return initial state', async () => {
    const state = await service.getState();
    expect(state.botStatus).toBe('Initializing');
    expect(state.clientReady).toBe(false);
    expect(state.waRetryCount).toBe(0);
  });

  it('should update state partially', async () => {
    await service.updateState({ botStatus: 'Ready', clientReady: true });
    const state = await service.getState();
    expect(state.botStatus).toBe('Ready');
    expect(state.clientReady).toBe(true);
    expect(state.waRetryCount).toBe(0);
  });

  it('should preserve unmodified fields', async () => {
    await service.updateState({ waRetryCount: 5 });
    const state = await service.getState();
    expect(state.waRetryCount).toBe(5);
    expect(state.botStatus).toBe('Initializing');
  });

  it('should set and get QR', async () => {
    await service.setQR('qr-data', 'pairing-123');
    const qr = await service.getQR();
    expect(qr).toEqual({ qr: 'qr-data', pairingCode: 'pairing-123' });
  });

  it('should clear QR', async () => {
    await service.setQR('qr-data', 'pairing-123');
    await service.clearQR();
    const qr = await service.getQR();
    expect(qr).toBeNull();
  });

  it('should manage dialog state with TTL', async () => {
    await service.setDialog('test-dialog', { foo: 'bar' }, 5000);
    const dialog = await service.getDialog<{ foo: string }>('test-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog!.data).toEqual({ foo: 'bar' });
  });

  it('should delete dialog', async () => {
    await service.setDialog('del-dialog', { x: 1 });
    await service.delDialog('del-dialog');
    const dialog = await service.getDialog('del-dialog');
    expect(dialog).toBeNull();
  });

  it('should manage cache with TTL', async () => {
    await service.setCache('test-cache', { data: 42 }, 5000);
    const cached = await service.getCache<{ data: number }>('test-cache');
    expect(cached).toEqual({ data: 42 });
  });

  it('should invalidate cache by prefix', async () => {
    await service.setCache('prefix:1', 'a');
    await service.setCache('prefix:2', 'b');
    await service.setCache('other:1', 'c');
    await service.invalidateCache('prefix:');
    const a = await service.getCache('prefix:1');
    const b = await service.getCache('prefix:2');
    const c = await service.getCache('other:1');
    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(c).toBe('c');
  });

  it('should deduplicate messages', async () => {
    const processed = await service.isMessageProcessed('msg-1');
    expect(processed).toBe(false);

    await service.markMessageProcessed('msg-1', 'user-1');
    const nowProcessed = await service.isMessageProcessed('msg-1');
    expect(nowProcessed).toBe(true);
  });

  it('should add and retrieve logs', () => {
    service.addLog('info', 'test log');
    service.addLog('error', 'error log');
    const logs = service.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].level).toBe('error');
    expect(logs[1].level).toBe('info');
  });

  it('should get maintenance mode', async () => {
    const mm = await service.getMaintenanceMode();
    expect(mm).toBeDefined();
    expect(typeof mm.active).toBe('boolean');
  });

  it('should call state change callbacks', async () => {
    const cb = vi.fn();
    service.onStateChange(cb);
    await service.updateState({ botStatus: 'Ready' });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
