import type { Message } from 'whatsapp-web.js';
import supabase from './supabase';
import { addLog } from './state';

export { sanitizeError } from '../utils/errors';

// ── Message Deduplication ──
const processedMessages = new Set<string>();

export async function isMessageProcessed(messageId: string): Promise<boolean> {
  if (processedMessages.has(messageId)) return true;
  try {
    const { data } = await supabase.from('message_processed').select('message_id').eq('message_id', messageId).single();
    if (data) {
      processedMessages.add(messageId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function markMessageProcessed(messageId: string, userId: string): Promise<void> {
  processedMessages.add(messageId);
  try {
    await (supabase.from('message_processed') as any).insert([{ message_id: messageId, user_id: userId }]);
  } catch (err: any) {
    addLog('error', `[MSG-STATE] markMessageProcessed gagal: ${err.message}`);
  }
  if (processedMessages.size > 50000) {
    const arr = Array.from(processedMessages);
    const toDelete = arr.slice(0, arr.length - 30000);
    toDelete.forEach((id) => processedMessages.delete(id));
  }
}

// ── Per-Sender Lock ──
const senderLocks = new Map<string, Promise<void>>();
const senderLockTimestamps = new Map<string, number>();
const SENDER_LOCK_TTL = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of senderLockTimestamps) {
    if (now - ts > SENDER_LOCK_TTL && !senderLocks.has(key)) {
      senderLockTimestamps.delete(key);
    }
  }
  if (senderLockTimestamps.size > 10000) {
    const keysToDelete: string[] = [];
    for (const [key, ts] of senderLockTimestamps) {
      if (now - ts > SENDER_LOCK_TTL) keysToDelete.push(key);
    }
    keysToDelete.forEach((k) => {
      senderLockTimestamps.delete(k);
      senderLocks.delete(k);
    });
  }
}, 120_000).unref();

export async function withSenderLock<T>(sender: string, fn: () => Promise<T>): Promise<T> {
  const prev = senderLocks.get(sender) || (Promise.resolve() as Promise<unknown>);
  const next = prev.then(fn, fn).finally(() => {
    if (senderLocks.get(sender) === cleanupPromise) {
      senderLocks.delete(sender);
      senderLockTimestamps.set(sender, Date.now());
    }
  });
  const cleanupPromise = next.then(
    () => {},
    () => {},
  );
  senderLocks.set(sender, cleanupPromise);
  return next;
}

// ── Dialog States ──
export const pendingSaleDialogs = new Map<string, any>();
export const pendingClassificationDialogs = new Map<string, any>();
export const pendingTxConfirmations = new Map<string, any>();
export const pendingProductSelections = new Map<string, any>();

const DIALOG_TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingSaleDialogs) {
    if (now - val.timestamp > DIALOG_TTL) pendingSaleDialogs.delete(key);
  }
  for (const [key, val] of pendingClassificationDialogs) {
    if (now - val.timestamp > DIALOG_TTL) pendingClassificationDialogs.delete(key);
  }
  for (const [key, val] of pendingTxConfirmations) {
    if (now - val.timestamp > DIALOG_TTL) pendingTxConfirmations.delete(key);
  }
  for (const [key, val] of pendingProductSelections) {
    if (now - val.timestamp > DIALOG_TTL) pendingProductSelections.delete(key);
  }
}, 120_000).unref();

// ── Onboarding State ──
export const onboardingStates = new Map<string, { step: number; storeName?: string; timestamp: number }>();
export const graduatedVirtualUsers = new Map<string, number>();
export const ONBOARDING_TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of onboardingStates) {
    if (now - val.timestamp > ONBOARDING_TTL) onboardingStates.delete(key);
  }
  const GRADUATED_VIRTUAL_USER_TTL = 24 * 60 * 60 * 1000;
  for (const [key, timestamp] of graduatedVirtualUsers) {
    if (now - timestamp > GRADUATED_VIRTUAL_USER_TTL) graduatedVirtualUsers.delete(key);
  }
}, 120_000).unref();

// ── Safe Reply ──

export async function safeReply(msg: Message, text: string): Promise<void> {
  try {
    await msg.reply(text);
    if (msg?.id?._serialized && msg?.from) {
      markMessageProcessed(msg.id._serialized, msg.from).catch((e: any) => {
        addLog('error', `[SAFE-REPLY] markMessageProcessed gagal: ${e?.message || e}`);
      });
    }
  } catch {
    // non-critical
  }
}

// ── Maintenance Mode Cache ──
let _mCache = { active: false, message: '', ts: 0 };

export async function getMaintenanceMode(): Promise<{ active: boolean; message: string }> {
  if (Date.now() - _mCache.ts < 30_000) return _mCache;
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['maintenance_mode', 'maintenance_message']);
    const map: Record<string, string> = {};
    (data || []).forEach((r: { key: string; value: string }) => {
      map[r.key] = r.value;
    });
    _mCache = {
      active: map['maintenance_mode'] === 'true',
      message:
        map['maintenance_message'] ||
        '🔧 Tata Sedang Perbaikan\n\nMohon maaf atas ketidaknyamanannya Bos.\nTata akan segera kembali normal. Terima kasih! 🙏',
      ts: Date.now(),
    };
  } catch {
    _mCache.ts = Date.now();
  }
  return _mCache;
}

export function invalidateMaintenanceCache(): void {
  _mCache.ts = 0;
}
