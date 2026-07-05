import supabase, { pgPool } from '../config/supabase';
import { addLog } from '../config/state';
import type { PoolClient } from 'pg';
import { formatRupiah } from './helpers';

interface PostJournalOpts {
  userId: string;
  entryDate?: Date;
  referenceType: string;
  referenceId?: string;
  description?: string;
  lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }>;
}

interface JournalResult {
  success: boolean;
  journalId?: string;
  error?: string;
}

interface CoAResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface LabaRugiResult {
  success: boolean;
  data?: {
    rows: Array<Record<string, unknown>>;
    totalRevenue: number;
    totalCOGS: number;
    totalExpense: number;
    labaKotor: number;
    labaBersih: number;
  };
  error?: string;
}

interface BalanceSheetResult {
  success: boolean;
  data?: {
    date: string;
    totalAset: number;
    totalLiabilitasEkuitas: number;
    aset: { items: unknown[]; total: number };
    liabilitas: { items: unknown[]; total: number };
    ekuitas: { items: unknown[]; total: number };
    selisih: number;
    warning?: string;
  };
  error?: string;
}

interface TrialBalanceResult {
  success: boolean;
  data?: {
    rows: Array<{
      code: string;
      name: string;
      type: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
  };
  error?: string;
}

class AccountingEngine {
  async insertJournalViaClient(
    client: PoolClient,
    userId: string,
    opts: {
      entryDate?: Date;
      referenceType: string;
      referenceId?: string;
      description?: string;
      channel?: string;
      lines: Array<{ accountCode: string; debit: number; credit: number; description?: string }>;
    },
  ): Promise<{ journalId: string }> {
    const {
      entryDate = new Date(),
      referenceType,
      referenceId,
      description = '',
      channel = 'Offline',
      lines = [],
    } = opts;
    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Debit (${totalDebit}) tidak sama dengan Credit (${totalCredit})`);
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (!l.accountCode) throw new Error(`Line ${i + 1}: accountCode required`);
      if (d > 0 && c > 0) throw new Error(`Line ${i + 1}: tidak boleh debit dan credit > 0`);
      if (d === 0 && c === 0) throw new Error(`Line ${i + 1}: debit atau credit harus > 0`);
    }
    const je = await client.query(
      `INSERT INTO journal_entries (user_id, entry_date, reference_type, reference_id, description, channel, is_posted)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [userId, entryDate.toISOString().slice(0, 10), referenceType, referenceId || null, description, channel],
    );
    const journalId = je.rows[0].id;

    // Auto-create missing COA accounts before journal lines (trigger requires accounts to exist)
    const codes = [...new Set(lines.map((l) => l.accountCode).filter(Boolean))];
    if (codes.length > 0) {
      const { rows: existing } = await client.query(
        `SELECT code, type, normal_balance FROM chart_of_accounts WHERE user_id = $1 AND code = ANY($2::text[])`,
        [userId, codes],
      );
      const existingCodes = new Set(existing.map((r: any) => r.code));
      const missingCodes = codes.filter((c) => !existingCodes.has(c));
      if (missingCodes.length > 0) {
        const coaValues: string[] = [];
        const coaParams: any[] = [];
        let coaIdx = 1;
        for (const code of missingCodes) {
          const prefix = code.charAt(0);
          let type: string, normalBalance: string;
          if (prefix === '1') {
            type = 'asset';
            normalBalance = 'debit';
          } else if (prefix === '2') {
            type = 'liability';
            normalBalance = 'credit';
          } else if (prefix === '3') {
            type = 'equity';
            normalBalance = 'credit';
          } else if (prefix === '4') {
            type = 'revenue';
            normalBalance = 'credit';
          } else if (prefix === '5') {
            type = 'cogs';
            normalBalance = 'debit';
          } else {
            type = 'expense';
            normalBalance = 'debit';
          }
          coaValues.push(`($${coaIdx}, $${coaIdx + 1}, $${coaIdx + 2}, $${coaIdx + 3}, $${coaIdx + 4}, true)`);
          coaParams.push(userId, code, `Akun ${code}`, type, normalBalance);
          coaIdx += 5;
        }
        await client.query(
          `INSERT INTO chart_of_accounts (user_id, code, name, type, normal_balance, is_active)
           VALUES ${coaValues.join(', ')}
           ON CONFLICT (user_id, code) DO NOTHING`,
          coaParams,
        );
        addLog('info', `[ACCTG-ENGINE] Auto-created missing accounts: ${missingCodes.join(', ')} for user ${userId}`);
      }
    }

    if (lines.length > 0) {
      const values: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;
      for (const l of lines) {
        values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`);
        params.push(journalId, l.accountCode, Number(l.debit) || 0, Number(l.credit) || 0, l.description || '');
        paramIdx += 5;
      }
      await client.query(
        `INSERT INTO journal_lines (entry_id, account_code, debit, credit, description) VALUES ${values.join(', ')}`,
        params,
      );
    }

    return { journalId };
  }

  async postJournal(opts: PostJournalOpts): Promise<JournalResult> {
    const { userId, entryDate = new Date(), referenceType, referenceId, description = '', lines = [] } = opts;

    if (!userId) return { success: false, error: 'userId required' };
    if (!referenceType) return { success: false, error: 'referenceType required' };
    if (!lines.length) return { success: false, error: 'at least 1 journal line required' };

    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `Debit (${totalDebit}) tidak sama dengan Credit (${totalCredit})`,
      };
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (!l.accountCode) {
        return { success: false, error: `Line ${i + 1}: accountCode required` };
      }
      if (d > 0 && c > 0) {
        return { success: false, error: `Line ${i + 1}: tidak boleh debit dan credit > 0` };
      }
      if (d === 0 && c === 0) {
        return { success: false, error: `Line ${i + 1}: debit atau credit harus > 0` };
      }
    }

    try {
      const { data, error } = await supabase.rpc('post_journal', {
        p_user_id: userId,
        p_entry_date: entryDate.toISOString(),
        p_reference_type: referenceType,
        p_reference_id: referenceId || null,
        p_description: description,
        p_lines: lines.map((l) => ({
          account_code: l.accountCode,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || '',
        })),
      });

      if (error) {
        addLog('error', '[ACCTG-ENGINE] postJournal error: ' + error.message);
        return { success: false, error: `Gagal posting jurnal: ${error.message}` };
      }

      return { success: true, journalId: data as string };
    } catch (err: any) {
      addLog('error', '[ACCTG-ENGINE] postJournal exception: ' + err.message);
      return { success: false, error: `Gagal posting jurnal: ${err.message}` };
    }
  }

  async getCoA(userId: string): Promise<CoAResult> {
    if (!userId) return { success: false, error: 'userId required' };
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getLabaRugi(userId: string, startDate: string, endDate: string): Promise<LabaRugiResult> {
    if (!userId) return { success: false, error: 'userId required' };
    try {
      if (pgPool) {
        const { rows: aggRows } = await pgPool.query(
          `SELECT
             jl.account_code,
             coa.name AS account_name,
             coa.type AS account_type,
             coa.normal_balance,
             SUM(jl.debit) AS total_debit,
             SUM(jl.credit) AS total_credit
           FROM journal_entries je
           JOIN journal_lines jl ON jl.entry_id = je.id
           JOIN chart_of_accounts coa ON coa.code = jl.account_code AND coa.user_id = je.user_id
           WHERE je.user_id = $1
             AND je.entry_date >= $2
             AND je.entry_date <= $3
             AND je.is_posted = true
           GROUP BY jl.account_code, coa.name, coa.type, coa.normal_balance
           ORDER BY jl.account_code`,
          [userId, startDate, endDate],
        );
        if (aggRows.length > 0) {
          const rows: any[] = aggRows.map((r: any) => {
            const debit = parseFloat(r.total_debit) || 0;
            const credit = parseFloat(r.total_credit) || 0;
            let total: number;
            if (r.normal_balance === 'credit') total = credit - debit;
            else total = debit - credit;
            return { account_code: r.account_code, account_name: r.account_name, account_type: r.account_type, total };
          });
          let totalRevenue = 0,
            totalCOGS = 0,
            totalExpense = 0;
          rows.forEach((r: any) => {
            if (r.account_type === 'revenue') totalRevenue += r.total;
            else if (r.account_type === 'cogs') totalCOGS += r.total;
            else if (r.account_type === 'expense') totalExpense += r.total;
          });
          return {
            success: true,
            data: {
              rows,
              totalRevenue,
              totalCOGS,
              totalExpense,
              labaKotor: totalRevenue - totalCOGS,
              labaBersih: totalRevenue - totalCOGS - totalExpense,
            },
          };
        }
      }

      // Fallback via Supabase REST (when pgPool unavailable)
      const { data: entries, error: entriesError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);
      if (entriesError) throw entriesError;
      const entryIds = ((entries as any[]) || []).map((e) => e.id);
      if (entryIds.length) {
        const { data: lines, error: linesError } = await supabase
          .from('journal_lines')
          .select('account_code, debit, credit')
          .in('entry_id', entryIds);
        if (linesError) throw linesError;
        const accountCodes = [...new Set(((lines as any[]) || []).map((l: any) => l.account_code).filter(Boolean))];
        const coaMap: Record<string, { code: string; type: string; name: string; normal_balance: string }> = {};
        if (accountCodes.length) {
          const { data: coaList } = await supabase
            .from('chart_of_accounts')
            .select('code, type, name, normal_balance')
            .in('code', accountCodes)
            .eq('user_id', userId);
          ((coaList as any[]) || []).forEach((a: any) => {
            coaMap[a.code] = a;
          });
        }
        const rows: Record<string, any> = {};
        ((lines as any[]) || []).forEach((line: any) => {
          const coa = coaMap[line.account_code];
          if (!coa) return;
          const code = line.account_code;
          if (!rows[code]) {
            rows[code] = { account_code: code, account_name: coa.name, account_type: coa.type, total: 0 };
          }
          const debit = Number(line.debit) || 0;
          const credit = Number(line.credit) || 0;
          if (coa.normal_balance === 'credit') {
            rows[code].total += credit - debit;
          } else {
            rows[code].total += debit - credit;
          }
        });
        const rowsArr = Object.values(rows);
        let totalRevenue = 0,
          totalCOGS = 0,
          totalExpense = 0;
        rowsArr.forEach((r: any) => {
          if (r.account_type === 'revenue') totalRevenue += r.total;
          else if (r.account_type === 'cogs') totalCOGS += r.total;
          else if (r.account_type === 'expense') totalExpense += r.total;
        });
        return {
          success: true,
          data: {
            rows: rowsArr,
            totalRevenue,
            totalCOGS,
            totalExpense,
            labaKotor: totalRevenue - totalCOGS,
            labaBersih: totalRevenue - totalCOGS - totalExpense,
          },
        };
      }

      // Fallback: compute from transactions table when no journal entries exist
      const { data: trans, error: transError } = await supabase
        .from('transactions')
        .select('type, amount, reference_type, quantity, price_buy')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (transError) throw transError;

      let totalRevenue = 0,
        totalExpense = 0;
      const revenueRows: Record<string, number> = {};
      const expenseRows: Record<string, number> = {};
      ((trans as any[]) || []).forEach((t: any) => {
        const v = Number(t.amount) || 0;
        if (t.type === 'masuk' && t.reference_type !== 'modal' && t.reference_type !== 'receivable') {
          totalRevenue += v;
          revenueRows['4101'] = (revenueRows['4101'] || 0) + v;
        } else if (t.type === 'keluar') {
          totalExpense += v;
          expenseRows['6105'] = (expenseRows['6105'] || 0) + v;
        }
      });

      let totalCOGS = 0;
      const { data: salesWithStock } = (await supabase
        .from('transactions')
        .select('quantity, price_buy')
        .eq('user_id', userId)
        .not('product_id', 'is', null)
        .not('quantity', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate)) as any;
      (salesWithStock || []).forEach((t: any) => {
        totalCOGS += (Number(t.quantity) || 0) * (Number(t.price_buy) || 0);
      });

      const rows: any[] = [];
      Object.entries(revenueRows).forEach(([code, total]) => {
        rows.push({ account_code: code, account_name: 'Pendapatan Penjualan', account_type: 'revenue', total });
      });
      if (totalCOGS > 0) {
        rows.push({
          account_code: '5101',
          account_name: 'Harga Pokok Penjualan',
          account_type: 'cogs',
          total: totalCOGS,
        });
      }
      Object.entries(expenseRows).forEach(([code, total]) => {
        rows.push({ account_code: code, account_name: 'Beban Operasional', account_type: 'expense', total });
      });

      return {
        success: true,
        data: {
          rows,
          totalRevenue,
          totalCOGS,
          totalExpense,
          labaKotor: totalRevenue - totalCOGS,
          labaBersih: totalRevenue - totalCOGS - totalExpense,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getAccount(userId: string, accountCode: string): Promise<CoAResult> {
    if (!userId || !accountCode) return { success: false, error: 'userId and accountCode required' };
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('code', accountCode)
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getBalanceSheet(userId: string, endDate?: string): Promise<BalanceSheetResult> {
    if (!userId) return { success: false, error: 'userId required' };
    try {
      let accounts: any[];

      if (pgPool) {
        if (endDate) {
          const { rows } = await pgPool.query(
            `SELECT a.code, a.name, a.type, a.normal_balance,
                    COALESCE(jn.journal_net, 0) AS journal_net
             FROM chart_of_accounts a
             LEFT JOIN (
               SELECT jl.account_code, SUM(jl.debit - jl.credit) AS journal_net
               FROM journal_lines jl
               JOIN journal_entries je ON je.id = jl.entry_id
               WHERE je.user_id = $1 AND je.is_posted = true
                 AND je.entry_date <= $2::date
               GROUP BY jl.account_code
             ) jn ON jn.account_code = a.code
             WHERE a.user_id = $1 AND a.is_active = true
             ORDER BY a.code`,
            [userId, endDate],
          );
          accounts = rows.map((r: any) => {
            const raw = parseFloat(r.journal_net) || 0;
            const bal = r.normal_balance === 'credit' ? -raw : raw;
            return { code: r.code, name: r.name, type: r.type, normal_balance: r.normal_balance, balance: bal };
          });
        } else {
          const { rows } = await pgPool.query(
            `SELECT code, name, type, normal_balance, balance
             FROM chart_of_accounts
             WHERE user_id = $1 AND is_active = true
             ORDER BY code`,
            [userId],
          );
          accounts = rows.map((r: any) => ({
            code: r.code,
            name: r.name,
            type: r.type,
            normal_balance: r.normal_balance,
            balance: parseFloat(r.balance) || 0,
          }));
        }
      } else {
        const { data: accData, error } = await supabase
          .from('chart_of_accounts')
          .select('code, name, type, normal_balance, balance')
          .eq('user_id', userId)
          .eq('is_active', true);
        if (error) throw error;
        accounts = (accData as any[]) || [];

        if (endDate && accounts.length) {
          const codes = accounts.map((a: any) => a.code);
          const { data: entries } = (await supabase
            .from('journal_entries')
            .select('id')
            .eq('user_id', userId)
            .lte('entry_date', endDate)) as any;
          if (entries?.length) {
            const entryIds = entries.map((e: any) => e.id);
            const { data: lines } = (await supabase
              .from('journal_lines')
              .select('account_code, debit, credit')
              .in('entry_id', entryIds)) as any;
            const balanceMap: Record<string, number> = {};
            (lines || []).forEach((l: any) => {
              if (!codes.includes(l.account_code)) return;
              balanceMap[l.account_code] =
                (balanceMap[l.account_code] || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0);
            });
            accounts = accounts.map((a: any) => {
              const raw = balanceMap[a.code] || 0;
              const bal = a.normal_balance === 'credit' ? -raw : raw;
              return { ...a, balance: bal };
            });
          }
        }
      }

      const items: { aset: any[]; liabilitas: any[]; ekuitas: any[] } = { aset: [], liabilitas: [], ekuitas: [] };
      accounts.forEach((a: any) => {
        const bal = Number(a.balance) || 0;
        if (bal === 0) return;
        let group: string;
        if (a.type === 'asset') group = 'aset';
        else if (a.type === 'liability') group = 'liabilitas';
        else if (a.type === 'equity') group = 'ekuitas';
        else return;
        items[group as keyof typeof items].push({ code: a.code, name: a.name, absolute: Math.abs(bal) });
      });
      const totalAset = items.aset.reduce((s: number, a: any) => s + a.absolute, 0);
      const totalLiabilitas = items.liabilitas.reduce((s: number, a: any) => s + a.absolute, 0);
      const totalEkuitas = items.ekuitas.reduce((s: number, a: any) => s + a.absolute, 0);
      const dateStr = endDate
        ? new Date(endDate).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          } as any)
        : new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          } as any);
      const selisih = totalAset - (totalLiabilitas + totalEkuitas);
      return {
        success: true,
        data: {
          date: dateStr,
          totalAset,
          totalLiabilitasEkuitas: totalLiabilitas + totalEkuitas,
          aset: { items: items.aset, total: totalAset },
          liabilitas: { items: items.liabilitas, total: totalLiabilitas },
          ekuitas: { items: items.ekuitas, total: totalEkuitas },
          selisih,
          warning:
            Math.abs(selisih) > 0
              ? `⚠️ Neraca tidak balance (selisih: ${formatRupiah(Math.abs(selisih))}). Periksa jurnal double-entry atau hubungi admin.`
              : undefined,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getTrialBalance(userId: string): Promise<TrialBalanceResult> {
    if (!userId) return { success: false, error: 'userId required' };
    try {
      const { data: accounts, error } = await supabase
        .from('chart_of_accounts')
        .select('code, name, type, normal_balance, balance')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      const rows = ((accounts as any[]) || []).map((a: any) => ({
        code: a.code,
        name: a.name,
        type: a.type,
        debit: a.normal_balance === 'debit' ? Number(a.balance) || 0 : 0,
        credit: a.normal_balance === 'credit' ? Number(a.balance) || 0 : 0,
        balance: Number(a.balance) || 0,
      }));
      return { success: true, data: { rows } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

const accountingEngine = new AccountingEngine();
export default accountingEngine;
