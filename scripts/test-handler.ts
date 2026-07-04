import dotenv from 'dotenv';
dotenv.config();

import { handleMessage } from '../src/handlers/message';
import supabase from '../src/config/supabase';

const TEST_SENDER = '628888888888';
const TEST_PRODUCT = 'Test-Kopi-Handler';
const TEST_PRODUCT_2 = 'Test-Gula-Handler';

interface TestCase {
  label: string;
  body: string;
}

function createMockMsg(body: string, sender: string) {
  const replies: string[] = [];
  const msgId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    msg: {
      from: sender,
      fromMe: false,
      body,
      hasMedia: false,
      type: null,
      id: { _serialized: msgId },
      reply: async (text: string) => {
        replies.push(text);
        process.stdout.write(`\n  └─[REPLY ${replies.length}] ${text.split('\n')[0]}${text.includes('\n') ? '...' : ''}\n`);
        if (text.includes('\n')) {
          const lines = text.split('\n');
          for (let i = 1; i < Math.min(lines.length, 5); i++) {
            process.stdout.write(`        ${lines[i]}\n`);
          }
          if (lines.length > 5) process.stdout.write(`        ... (${lines.length - 1} lines total)\n`);
        }
        process.stdout.write('\n');
      },
      getChat: async () => ({ sendStateTyping: async () => {} }),
      downloadMedia: async () => { throw new Error('no media'); },
    },
    getReplies: () => replies,
  };
}

async function ensureTestUser() {
  console.log('[SETUP] Checking test user...');
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('id', TEST_SENDER)
    .maybeSingle();

  if (existing) {
    console.log(`[SETUP] User: ${existing.store_name} | status: ${existing.status} | onboarding: ${existing.onboarding_status}`);
    await supabase.from('products').delete().eq('user_id', TEST_SENDER);
    await supabase.from('users').update({ status: 'pro', onboarding_status: 'completed' }).eq('id', TEST_SENDER);
    return existing;
  }

  await supabase.from('users').insert({
    id: TEST_SENDER,
    store_name: 'Test Store',
    store_slug: 'test-store',
    status: 'pro',
    onboarding_status: 'completed',
    is_upgrading: false,
  });
  console.log('[SETUP] Test user created (PRO)');
  return { id: TEST_SENDER, store_name: 'Test Store' };
}

async function createTestProducts() {
  console.log('[SETUP] Creating test products...');
  const { error: e1 } = await supabase.from('products').insert({
    user_id: TEST_SENDER, name: TEST_PRODUCT, sku: 'TST-KOPI-001',
    stock_current: 0, unit: 'pcs', price_buy: 15000, price_sell: 25000,
    stock_min: 2, is_active: true,
  });
  if (e1) throw new Error(`Create ${TEST_PRODUCT} failed: ${e1.message}`);
  console.log(`[SETUP] + ${TEST_PRODUCT} (hpp 15rb, jual 25rb)`);

  const { error: e2 } = await supabase.from('products').insert({
    user_id: TEST_SENDER, name: TEST_PRODUCT_2, sku: 'TST-GULA-001',
    stock_current: 0, unit: 'pcs', price_buy: 12000, price_sell: 18000,
    stock_min: 5, is_active: true,
  });
  if (e2) throw new Error(`Create ${TEST_PRODUCT_2} failed: ${e2.message}`);
  console.log(`[SETUP] + ${TEST_PRODUCT_2} (hpp 12rb, jual 18rb)`);
}

async function cleanup() {
  console.log('[CLEANUP] Cleaning test data...');
  await supabase.from('stock_movements').delete().eq('user_id', TEST_SENDER);
  await supabase.from('journal_entries').delete().eq('user_id', TEST_SENDER);
  await supabase.from('transactions').delete().eq('user_id', TEST_SENDER);
  await supabase.from('products').delete().eq('user_id', TEST_SENDER);
  await supabase.from('users').delete().eq('id', TEST_SENDER);
  console.log('[CLEANUP] Done');
}

async function runTest(test: TestCase) {
  process.stdout.write(`\n─── ${test.label} ───────────────────────\n`);
  process.stdout.write(`  Input: "${test.body}"\n`);

  const { msg, getReplies } = createMockMsg(test.body, TEST_SENDER);

  try {
    await handleMessage(msg, null as any);
    const replies = getReplies();
    if (replies.length > 0) {
      process.stdout.write(`  ✅ ${replies.length} reply(ies)\n`);
      return true;
    }
    process.stdout.write(`  ⚠️  No reply (handler returned without response)\n`);
    return false;
  } catch (err: any) {
    process.stdout.write(`  ❌ Error: ${err.message}\n`);
    if (err.stack) {
      const lines = err.stack.split('\n').slice(0, 4).join('\n');
      process.stdout.write(`     ${lines}\n`);
    }
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    WA HANDLER TEST — Tata Business Suite ║');
  console.log('╚══════════════════════════════════════════╝\n');

  await ensureTestUser();
  await createTestProducts();

  const allTests: TestCase[] = [
    { label: 'Routing: bantuan', body: 'bantuan' },
    { label: 'Routing: catat transaksi', body: 'catat transaksi' },
    { label: 'Stock IN: Masuk Test-Kopi-Handler 5', body: `Masuk ${TEST_PRODUCT} 5` },
    { label: 'Stock IN lagi: Masuk Test-Kopi-Handler 3', body: `Masuk ${TEST_PRODUCT} 3` },
    { label: 'Stock IN: Masuk Test-Gula-Handler 10', body: `Masuk ${TEST_PRODUCT_2} 10` },
    { label: 'Stock OUT: Keluar Test-Kopi-Handler 2', body: `Keluar ${TEST_PRODUCT} 2` },
    { label: 'Stock OUT: Keluar Test-Gula-Handler 3', body: `Keluar ${TEST_PRODUCT_2} 3` },
    { label: 'Sale: jual Test-Kopi-Handler 1', body: `jual ${TEST_PRODUCT} 1` },
    { label: 'Transaksi: jual Test-Kopi-Handler 25rb', body: `jual ${TEST_PRODUCT} 25000` },
    { label: 'Menu: 1', body: '1' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of allTests) {
    const ok = await runTest(test);
    if (ok) passed++; else failed++;
  }

  // Verifikasi stok akhir
  console.log(`\n─── VERIFIKASI ───────────────────────`);
  const { data: products } = await supabase
    .from('products').select('*').eq('user_id', TEST_SENDER).order('name');
  for (const p of (products || [])) {
    const { count: movements } = await supabase
      .from('stock_movements').select('*', { count: 'exact', head: true }).eq('product_id', p.id);
    const { count: journalRows } = await supabase
      .from('journal_entries').select('*', { count: 'exact', head: true }).eq('product_id', p.id);
    console.log(`  📦 ${p.name}: stok=${p.stock_current}, movements=${movements}, journal_entries=${journalRows}`);
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}  |  Total: ${allTests.length}`);

  await cleanup();
}

main().catch((err) => {
  console.error('FATAL:', err);
  cleanup().catch(() => {});
  process.exit(1);
});
