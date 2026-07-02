'use strict';

/**
 * Backfill historical transactions → journal_entries + journal_lines.
 *
 * Reads ALL transactions that do NOT yet have a matching journal entry
 * (checked via reference_id = transactions.id::text) and calls the
 * post_journal RPC for each one.
 *
 * Usage:
 *   node scripts/backfill-journal.js          # prompt before execute
 *   node scripts/backfill-journal.js --force   # skip prompt
 *   node scripts/backfill-journal.js --dry-run # count only, no inserts
 *
 * Dependencies: dotenv, @supabase/supabase-js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BATCH_SIZE = 50;

const CHANNEL_ACCOUNTS = {
    'Offline': '4101',
    'Tokopedia': '4102',
    'TikTok Shop': '4103',
    'Lazada': '4104',
    'Shopee': '4105',
};

// ── Helpers ──────────────────────────────────────────────────────────

function rupiah(v) {
    return 'Rp ' + (Number(v) || 0).toLocaleString('id-ID');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isForce = args.includes('--force');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        db: { schema: 'public' },
    });

    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║   Backfill: transactions → journal_entries         ║');
    console.log(isDryRun
        ? '║   MODE: DRY RUN (no changes will be made)               ║'
        : '║   MODE: LIVE                                            ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    // Step 1: Get all transactions
    console.log('📦 Fetching transactions...');
    let allTransactions = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('transactions')
            .select('id, user_id, type, amount, channel, reference_type, quantity, price_buy, hpp, beban_operasional, customer_name, description, created_at')
            .order('created_at', { ascending: true })
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            console.error('ERROR fetching transactions:', error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allTransactions = allTransactions.concat(data);
            offset += data.length;
            process.stdout.write(`\r  Loaded ${allTransactions.length} transactions...`);
        }
    }
    console.log(`\r  ✅ Total transactions: ${allTransactions.length}`);

    if (allTransactions.length === 0) {
        console.log('No transactions to process. Exiting.');
        return;
    }

    // Step 2: Find which transactions already have journal entries
    console.log('\n🔍 Checking for existing journal entries...');
    const txIds = allTransactions.map(t => String(t.id));

    const alreadyJournaled = new Set();
    for (let i = 0; i < txIds.length; i += 100) {
        const batch = txIds.slice(i, i + 100);
        const { data: existing } = await supabase
            .from('journal_entries')
            .select('reference_id')
            .in('reference_id', batch);

        if (existing) {
            existing.forEach(e => alreadyJournaled.add(e.reference_id));
        }
        process.stdout.write(`\r  Checked ${Math.min(i + 100, txIds.length)}/${txIds.length}...`);
    }
    console.log(`\r  ✅ ${alreadyJournaled.size} already journaled, ${txIds.length - alreadyJournaled.size} pending`);

    const pending = allTransactions.filter(t => !alreadyJournaled.has(String(t.id)));

    if (pending.length === 0) {
        console.log('\n✅ All transactions already have journal entries. Nothing to do.');
        return;
    }

    console.log(`\n📋 Transactions to backfill: ${pending.length}`);

    // Step 3: Show preview
    const byType = {};
    pending.forEach(t => {
        byType[t.type] = (byType[t.type] || 0) + 1;
    });
    console.log('  Breakdown by type:');
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
    });

    // Step 4: Build journal lines for each transaction
    function buildJournalLines(tx) {
        const lines = [];
        const amount = Number(tx.amount) || 0;
        const qty = Number(tx.quantity) || 0;
        const buy = Number(tx.price_buy) || 0;
        const hpp = Number(tx.hpp) || (qty * buy);
        const beban = Number(tx.beban_operasional) || amount;
        const refType = tx.reference_type || 'manual';

        if (tx.type === 'masuk') {
            const channel = tx.channel || 'Offline';
            const revenueAccount = CHANNEL_ACCOUNTS[channel] || '4101';

            // Kas / Bank (debit)
            lines.push({
                accountCode: '1101',
                debit: amount,
                credit: 0,
                description: 'Penerimaan penjualan',
            });

            // Revenue (credit)
            lines.push({
                accountCode: revenueAccount,
                debit: 0,
                credit: amount,
                description: `Penjualan via ${channel}`,
            });

            // HPP & Inventori (if it's a cashier sale or has quantity*price_buy)
            if (refType === 'cashier' && (hpp > 0 || (qty > 0 && buy > 0))) {
                const cost = hpp > 0 ? hpp : qty * buy;

                lines.push({
                    accountCode: '5101',
                    debit: cost,
                    credit: 0,
                    description: `HPP ${qty} item`,
                });

                lines.push({
                    accountCode: '1201',
                    debit: 0,
                    credit: cost,
                    description: 'Pengurangan inventori',
                });
            }
        } else if (tx.type === 'keluar') {
            lines.push({
                accountCode: '6105',
                debit: beban,
                credit: 0,
                description: tx.description || 'Beban operasional',
            });

            lines.push({
                accountCode: '1101',
                debit: 0,
                credit: beban,
                description: 'Pembayaran beban',
            });
        } else if (tx.type === 'barang_rusak') {
            const loss = beban > 0 ? beban : (qty * buy);

            lines.push({
                accountCode: '6105',
                debit: loss,
                credit: 0,
                description: 'Kerugian barang rusak',
            });

            lines.push({
                accountCode: '1201',
                debit: 0,
                credit: loss,
                description: 'Pengurangan inventori rusak',
            });
        }

        return lines;
    }

    function getReferenceType(tx) {
        if (tx.type === 'masuk') return 'sale';
        if (tx.type === 'keluar') return 'expense';
        if (tx.type === 'barang_rusak') return 'damaged_goods';
        return 'manual';
    }

    // Step 5: Preview first 3
    console.log('\n🔎 Preview (first 3 transactions):');
    pending.slice(0, 3).forEach((tx, i) => {
        const lines = buildJournalLines(tx);
        console.log(`\n  ${i + 1}. TX #${tx.id} | ${tx.type} | ${rupiah(tx.amount)} | ${tx.channel || '-'} | ${tx.created_at}`);
        lines.forEach(l => {
            const dr = l.debit > 0 ? ` Dr ${rupiah(l.debit)}` : '';
            const cr = l.credit > 0 ? ` Cr ${rupiah(l.credit)}` : '';
            console.log(`     ${l.accountCode}${dr}${cr} — ${l.description}`);
        });
    });

    // Step 6: Confirm
    if (isDryRun) {
        console.log(`\n📊 DRY RUN SUMMARY:`);
        console.log(`  Total transactions      : ${allTransactions.length}`);
        console.log(`  Already journaled       : ${alreadyJournaled.size}`);
        console.log(`  To be backfilled        : ${pending.length}`);
        console.log(`  Total debit lines       : ${pending.reduce((s, t) => s + buildJournalLines(t).filter(l => l.debit > 0).length, 0)}`);
        console.log(`  Total credit lines      : ${pending.reduce((s, t) => s + buildJournalLines(t).filter(l => l.credit > 0).length, 0)}`);
        console.log('\n✅ Dry run complete. No changes were made.');
        console.log('   Run without --dry-run to execute.\n');
        return;
    }

    if (!isForce) {
        console.log(`\n⚠️  About to backfill ${pending.length} transactions into journal_entries.`);
        console.log('   This will INSERT new rows and UPDATE account balances.');
        console.log('   It is RECOMMENDED to take a database backup first.\n');

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answer = await new Promise(resolve => {
            rl.question('   Continue? (yes/no): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('Aborted.');
            return;
        }
    }

    // Step 7: Execute backfill
    console.log('\n🚀 Executing backfill...');
    let success = 0;
    let errors = 0;
    let skipped = 0;
    const startTime = Date.now();

    for (let i = 0; i < pending.length; i++) {
        const tx = pending[i];
        const lines = buildJournalLines(tx);

        if (lines.length === 0) {
            skipped++;
            continue;
        }

        const entryDate = tx.created_at
            ? tx.created_at.slice(0, 10)
            : new Date().toISOString().slice(0, 10);

        const refType = getReferenceType(tx);
        const desc = tx.description || `Backfill ${tx.type} #${tx.id}`;

        const { error } = await supabase.rpc('post_journal', {
            p_user_id: tx.user_id,
            p_entry_date: entryDate,
            p_reference_type: refType,
            p_reference_id: String(tx.id),
            p_description: desc,
            p_lines: lines.map(l => ({
                account_code: l.accountCode,
                debit: l.debit,
                credit: l.credit,
                description: l.description || '',
            })),
        });

        if (error) {
            errors++;
            if (errors <= 5) {
                console.error(`  ✗ TX #${tx.id}: ${error.message}`);
            }
        } else {
            success++;
        }

        if ((i + 1) % 10 === 0 || i === pending.length - 1) {
            const elapsed = Date.now() - startTime;
            const rate = ((i + 1) / elapsed * 1000).toFixed(1);
            process.stdout.write(`\r  Progress: ${i + 1}/${pending.length} | ✅ ${success} | ❌ ${errors} | ⏭️ ${skipped} | ${rate}/s `);
        }

        // Small delay to avoid overwhelming the DB
        if ((i + 1) % BATCH_SIZE === 0) {
            await sleep(500);
        }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n\n✅ Backfill complete in ${formatDuration(totalTime)}`);
    console.log(`  Total processed : ${pending.length}`);
    console.log(`  Successful      : ${success}`);
    console.log(`  Errors          : ${errors}`);
    console.log(`  Skipped         : ${skipped}`);
    console.log('');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
