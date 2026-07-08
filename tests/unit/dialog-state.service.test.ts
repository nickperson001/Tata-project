import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('DialogStateService', () => {
  let mod: typeof import('../../src/services/dialog-state.service');

  beforeEach(async () => {
    vi.resetModules();
    mod = await import('../../src/services/dialog-state.service');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set and get a dialog', () => {
    mod.setDialog('user1', 'tx_confirmation', { amount: 50000, type: 'masuk' });
    const d = mod.getDialog('user1', 'tx_confirmation');
    expect(d).not.toBeNull();
    expect(d!.type).toBe('tx_confirmation');
    expect(d!.data.amount).toBe(50000);
  });

  it('should overwrite existing dialog of same type', () => {
    mod.setDialog('user1', 'classification', { word: 'test' });
    mod.setDialog('user1', 'classification', { word: 'updated' });
    const d = mod.getDialog('user1', 'classification');
    expect(d!.data.word).toBe('updated');
  });

  it('should return null for nonexistent dialog', () => {
    expect(mod.getDialog('nobody', 'classification')).toBeNull();
  });

  it('should detect hasDialog', () => {
    expect(mod.hasDialog('user1')).toBe(false);
    mod.setDialog('user1', 'tx_confirmation', {});
    expect(mod.hasDialog('user1')).toBe(true);
    expect(mod.hasDialog('user1', 'tx_confirmation')).toBe(true);
    expect(mod.hasDialog('user1', 'classification')).toBe(false);
  });

  it('should remove single dialog type', () => {
    mod.setDialog('user1', 'tx_confirmation', {});
    mod.setDialog('user1', 'classification', {});
    mod.removeDialog('user1', 'tx_confirmation');
    expect(mod.hasDialog('user1', 'tx_confirmation')).toBe(false);
    expect(mod.hasDialog('user1', 'classification')).toBe(true);
  });

  it('should clear all dialogs for sender', () => {
    mod.setDialog('user1', 'tx_confirmation', {});
    mod.setDialog('user1', 'classification', {});
    mod.setDialog('user1', 'product_selection', {});
    mod.clearAllDialogs('user1');
    expect(mod.hasDialog('user1')).toBe(false);
    expect(mod.getActiveCount()).toBe(0);
  });

  it('should return sorted dialogs by priority', () => {
    mod.setDialog('user1', 'classification', {});
    mod.setDialog('user1', 'tx_confirmation', {});
    mod.setDialog('user1', 'product_selection', {});
    const sorted = mod.sortedDialogs('user1');
    expect(sorted[0].type).toBe('tx_confirmation');
    expect(sorted[1].type).toBe('product_selection');
    expect(sorted[2].type).toBe('classification');
  });

  it('should get next dialog via sortedDialogs (highest priority first)', () => {
    mod.setDialog('user1', 'classification', {});
    mod.setDialog('user1', 'tx_confirmation', {});
    const sorted = mod.sortedDialogs('user1');
    expect(sorted[0].type).toBe('tx_confirmation');
  });

  it('should return expired dialog types', () => {
    vi.useFakeTimers();
    mod.setDialog('user1', 'tx_confirmation', {});
    vi.advanceTimersByTime(6 * 60 * 1000);
    const expired = mod.getExpiredDialogTypes('user1');
    expect(expired).toContain('tx_confirmation');
    expect(mod.hasDialog('user1', 'tx_confirmation')).toBe(false);
    vi.useRealTimers();
  });

  it('should not return non-expired dialogs', () => {
    vi.useFakeTimers();
    mod.setDialog('user1', 'tx_confirmation', {});
    vi.advanceTimersByTime(60 * 1000);
    const expired = mod.getExpiredDialogTypes('user1');
    expect(expired).toEqual([]);
    expect(mod.hasDialog('user1', 'tx_confirmation')).toBe(true);
    vi.useRealTimers();
  });

  it('should track active count across senders', () => {
    expect(mod.getActiveCount()).toBe(0);
    mod.setDialog('user1', 'tx_confirmation', {});
    mod.setDialog('user2', 'classification', {});
    expect(mod.getActiveCount()).toBe(2);
    mod.clearAllDialogs('user1');
    expect(mod.getActiveCount()).toBe(1);
    mod.clearAllDialogs('user2');
    expect(mod.getActiveCount()).toBe(0);
  });

  it('should handle removeDialog without type by deleting all', () => {
    mod.setDialog('user1', 'tx_confirmation', {});
    mod.setDialog('user1', 'classification', {});
    mod.removeDialog('user1');
    expect(mod.hasDialog('user1')).toBe(false);
  });
});
