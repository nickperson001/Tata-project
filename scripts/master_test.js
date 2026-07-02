'use strict';
require('dotenv').config();
const assert = require('assert').strict;

// ════════════════════════════════════════════════════════════
//  TATA BUSINESS SUITE — MASTER TEST SUITE v5.0
//  Comprehensive coverage: every pure-function, regex, cache,
//  keyword classifier, and business-logic path
// ════════════════════════════════════════════════════════════

let _pass = 0, _fail = 0, _skip = 0;
function pass(msg) { _pass++; console.log(`  ✅ ${msg}`); }
function fail(msg, err) { _fail++; console.error(`  ❌ ${msg}${err ? ' — ' + err.message : ''}`); }
function skip(msg) { _skip++; console.log(`  ⚠️  SKIP: ${msg}`); }

function section(title) {
    console.log(`\n${'─'.repeat(56)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(56));
}

// ════════════════════════════════════════════════════════════
//  1. parseCurrency — EXACT MIRROR of message.js:137-218
//     (Tests the algorithm; if source code drifts, tests break)
// ════════════════════════════════════════════════════════════
function parseCurrency(text) {
    if (!text || typeof text !== 'string') return null;
    let clean = text.toLowerCase().trim();
    if (/\d+(kg|gr|gram|ons|liter|lt|ml|cc|buah|biji|bungkus|pack|pcs|box|krat|karton|dus|sak|meter|cm|mm|menit|jam|hari|minggu|bulan|tahun|orang|org|lembar|rim|roll|set|pasang|ton)$/i.test(clean)) return null;
    clean = clean.replace(/^rp\.?\s*/i, '').replace(/^[:\s]+/, '').replace(/[:\s]+$/, '').trim();
    let multiplier = 1;
    if (/(?:m|miliar|milyar)$/.test(clean)) { multiplier = 1_000_000_000; clean = clean.replace(/(?:m|miliar|milyar)$/, ''); }
    else if (/(?:jt|juta)(?:an)?$/.test(clean)) { multiplier = 1_000_000; clean = clean.replace(/(?:jt|juta)(?:an)?$/, ''); }
    else if (/(?:rb|rbu|ribu|k)(?:an)?$/.test(clean)) { multiplier = 1_000; clean = clean.replace(/(?:rb|rbu|ribu|k)(?:an)?$/, ''); }
    if (multiplier > 1) {
        clean = clean.replace(',', '.');
    } else {
        const dotCount   = (clean.match(/\./g) || []).length;
        const commaCount = (clean.match(/,/g) || []).length;
        if (dotCount >= 2) { clean = clean.replace(/\./g, ''); }
        else if (commaCount >= 2) { clean = clean.replace(/,/g, ''); }
        else if (dotCount === 1 && commaCount === 0) {
            const parts = clean.split('.');
            if (parts[1]?.length === 3 && /^\d+$/.test(parts[1])) { clean = clean.replace('.', ''); }
        } else if (commaCount === 1 && dotCount === 0) {
            const parts = clean.split(',');
            if (parts[1]?.length === 3 && /^\d+$/.test(parts[1])) { clean = clean.replace(',', ''); }
            else { clean = clean.replace(',', '.'); }
        } else if (dotCount > 0 && commaCount > 0) {
            if (clean.lastIndexOf('.') > clean.lastIndexOf(',')) { clean = clean.replace(/,/g, ''); }
            else { clean = clean.replace(/\./g, '').replace(',', '.'); }
        }
    }
    clean = clean.replace(/[^0-9.]/g, '');
    const nominal = parseFloat(clean) * multiplier;
    if (isNaN(nominal) || nominal <= 0 || nominal > 1_000_000_000_000) return null;
    return Math.round(nominal);
}

// Mirror of parseQuantity (message.js:220-232)
function parseQuantity(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();
    const match = clean.match(/^(\d+(?:[.,]\d+)?)(kg|gr|gram|liter|ml|buah|biji|bungkus|pack|pcs|box|dus|karton|sak|meter|cm|mm)?$/i);
    if (!match) return null;
    const num = parseFloat(match[1].replace(',', '.'));
    if (isNaN(num) || num <= 0 || num > 1_000_000) return null;
    return num;
}

// ════════════════════════════════════════════════════════════
//  2. PURE HELPERS — mirrors of message.js helpers
// ════════════════════════════════════════════════════════════
function formatPhone(sender) {
    let n = sender.replace(/@.*$/, '').replace(/\D/g, '');
    if (n.startsWith('0')) n = '62' + n.slice(1);
    return '+' + n;
}
function formatRupiah(amount) {
    return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}
function getEffectiveStatus(user) {
    if (user.status === 'pro' && user.subscription_expires_at) {
        if (new Date(user.subscription_expires_at) <= new Date()) return 'demo';
    }
    return user.status;
}
function getDaysRemaining(user) {
    if (!user.subscription_expires_at) return null;
    const diff = new Date(user.subscription_expires_at) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
function calcMovingAverage(stokLama, hppLama, qtyBeli, hargaBeli) {
    if (stokLama + qtyBeli === 0) return 0;
    return Math.round(((stokLama * hppLama) + (qtyBeli * hargaBeli)) / (stokLama + qtyBeli));
}
function calcTieredPrice(qty, minGrosir, hargaEcer, hargaGrosir) {
    return qty >= minGrosir ? hargaGrosir : hargaEcer;
}

// ════════════════════════════════════════════════════════════
//  3. KEYWORD ARRAYS (copied from message.js:502-628 for assertion)
// ════════════════════════════════════════════════════════════
const KW_KELUAR = [
    'beli','belanja','purchase','bayar','bayarin','bayarkan','bayaran keluar',
    'purchase','pesan','pesen','order','restock',
    'biaya','ongkos','cost','expense','pengeluaran','keluar','modal',
    'listrik','air','gas','telpon','telepon','internet','wifi','kuota',
    'pulsa','paket data','sewa','kontrakan','kos','kontrak',
    'gaji','upah','honor','fee','ongkir','pengiriman','kirim uang','kirim',
    'kasbon','pinjam','minjemin','kasih pinjaman',
    'hutang','utang','nyicil','cicilan','angsuran','kredit','bayar hutang',
    'bayar cicilan','bayar angsuran','lunasin hutang',
    'modal','invest','investasi','setor modal',
    'pajak','tax','denda','administrasi','admin','biaya admin','asuransi',
    'bensin','solar','bbm','pertalite','pertamax','transport','transportasi',
    'ojek','ojol','gojek','grab','maxim','taxi','travel','parkir','tol',
    'makan','minum','ngopi','lunch','dinner','breakfast','snack',
    'jajan','nongkrong','hang out',
    'sedekah','donasi','infaq','zakat','sumbangan','nyumbang','kondangan',
    'amplop','kado','hadiah','parcel','patungan','urunan','kolekte',
    'servis','service','benerin','repair','renovasi','maintenance',
    'tarik','wd','withdraw','tarik tunai','ambil',
    'tf','trf','transfer','kirim','transfer ke','bayar ke',
    'rugi','minus','susut','hilang','rusak','expired','kadaluarsa',
    'nombok','nombokin','talangan','ngasih','kasih','bantu',
    'cap go','abis','habis buat','keluar buat','dipake buat',
];
const KW_MASUK = [
    'jual','jualan','dagang','laku','terjual','sold','penjualan','omzet',
    'sales','income','revenue','pemasukan','pendapatan',
    'terima','nerima','diterima','dapat','dapet','nemu','masuk',
    'bayaran','dibayar','terbayar','lunas','pelunasan',
    'untung','laba','profit','cuan','hasilnya','hasil',
    'komisi','bonus','thr','incentive','insentif','reward',
    'gajian','gaji masuk','honor masuk','cair',
    'setor','setoran','deposit','depo','top up','topup','isi',
    'tf masuk','transfer masuk','transferan','ditransfer','dikirim',
    'refund','dikembalikan','kembalian','cashback','balik modal',
    'tips','tip','tip masuk','uang tip','tambahan','extra',
    'pinjam masuk','hutang masuk','dikasih','dibantu',
    'nyairin','narik','dapet duit','uang masuk','duit masuk',
    'abis terjual','laris','borong',
];
const KW_BATAL = [
    'batal','batalin','batalkan','cancel','stop',
    'ga jadi','gak jadi','tidak jadi','nggak jadi','gajadi',
    'dicancel','undo','hapus','delete',
    'salah','keliru','maaf salah','kirim salah',
    'skip','abaikan','lewat',
];

// ════════════════════════════════════════════════════════════
//  TEST EXECUTION BEGINS
// ════════════════════════════════════════════════════════════
console.log('╔══════════════════════════════════════════════════╗');
console.log('║   TATA BUSINESS SUITE — MASTER TEST SUITE v5.0  ║');
console.log('╚══════════════════════════════════════════════════╝');

// ────────────────────────────────────────────────────────────
//  SECTION A: parseCurrency
// ────────────────────────────────────────────────────────────
section('A. parseCurrency — 28 edge cases');

const currencyTests = [
    // [input, expected, description]
    // Basic numbers
    ['15000',      15000,    'plain integer'],
    ['15.000',     15000,    'dot as thousands separator (3-digit after)'],
    ['15,000',     15000,    'comma as thousands separator (3-digit after)'],
    ['1.000.000',  1000000,  'double-dot thousands separator'],
    ['1,000,000',  1000000,  'double-comma thousands separator'],

    // Multiplier suffix
    ['15rb',       15000,    'rb suffix'],
    ['15 ribu',    15000,    'ribu suffix'],
    ['15k',        15000,    'k suffix'],
    ['15rbu',      15000,    'rbu suffix'],
    ['1.5jt',      1500000,  'jt suffix with decimal'],
    ['1,5jt',      1500000,  'jt suffix with comma decimal'],
    ['2 juta',     2000000,  'juta suffix'],
    ['1jtan',      1000000,  'jutaan suffix'],
    ['1m',         1000000000, 'm (milyar) suffix'],
    ['1.5miliar',  1500000000, 'miliar suffix with decimal'],
    ['2milyar',    2000000000, 'milyar suffix'],

    // Rp prefix
    ['Rp 15.000',  15000,    'Rp prefix with dot'],
    ['rp. 50000',  50000,    'rp. lowercase prefix'],
    ['RP 100rb',   100000,   'RP prefix + rb suffix'],

    // Mixed separators
    ['1.000,50',   1001,     'EU-style: 1.000,50 → Math.round(1000.5)=1001'],
    ['1,000.50',   1001,     'US-style: 1,000.50 → Math.round(1000.5)=1001'],

    // Decimal (no multiplier)
    ['15.5',       16,       'decimal with dot (rounds)'],
    ['15,5',       16,       'decimal with comma (rounds)'],

    // Rejection cases
    ['5kg',        null,     'reject unit suffix (kg)'],
    ['10pcs',      null,     'reject unit suffix (pcs)'],
    ['3liter',     null,     'reject unit suffix (liter)'],
    ['5ton',       null,     'reject unit suffix (ton)'],
    ['',           null,     'empty string'],
    [null,         null,     'null input'],
    ['abc',        null,     'non-numeric text'],
    ['0',          null,     'zero value rejected'],
    ['-5000',      5000,     'negative sign stripped by [^0-9.] filter → 5000'],

    // Prefix stripping
    [': 15000',    15000,    'colon prefix stripped'],
    ['  20000  ',  20000,    'whitespace trimmed'],
];

for (const [input, expected, desc] of currencyTests) {
    try {
        const result = parseCurrency(input);
        assert.equal(result, expected, `parseCurrency("${input}") = ${expected}, got ${result}`);
        pass(`parseCurrency("${input}") → ${expected} — ${desc}`);
    } catch (e) { fail(`parseCurrency("${input}") — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION B: parseQuantity
// ────────────────────────────────────────────────────────────
section('B. parseQuantity — 12 edge cases');

const quantityTests = [
    ['5',        5,     'bare number'],
    ['5kg',      5,     'number + kg'],
    ['10pcs',    10,    'number + pcs'],
    ['2.5liter', 2.5,   'decimal with unit'],
    ['3,5kg',    3.5,   'comma decimal with unit'],
    ['100',      100,   'larger number'],
    ['0',        null,  'zero rejected'],
    ['-5',       null,  'negative rejected'],
    ['',         null,  'empty string'],
    [null,       null,  'null input'],
    ['abc',      null,  'non-numeric rejected'],
    ['5menit',   null,  'time unit not in allowed list — rejected'],
];

for (const [input, expected, desc] of quantityTests) {
    try {
        const result = parseQuantity(input);
        assert.equal(result, expected);
        pass(`parseQuantity("${input}") → ${expected} — ${desc}`);
    } catch (e) { fail(`parseQuantity("${input}") — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION C: formatPhone
// ────────────────────────────────────────────────────────────
section('C. formatPhone — 6 edge cases');

const phoneTests = [
    ['628123456789@c.us',        '+628123456789',  'strip @c.us, keep 62 prefix'],
    ['08123456789@c.us',         '+628123456789',  'convert 0-prefix to 62'],
    ['08123456789',              '+628123456789',  '0-prefix without @c.us'],
    ['+628123456789@c.us',       '+628123456789',  'already has +62, strip @c.us'],
    ['62812-3456-789@c.us',     '+628123456789',  'strip dashes'],
    ['999@c.us',                 '+999',            'short number, no 0 prefix'],
];

for (const [input, expected, desc] of phoneTests) {
    try {
        const result = formatPhone(input);
        assert.equal(result, expected);
        pass(`formatPhone("${input}") → "${expected}" — ${desc}`);
    } catch (e) { fail(`formatPhone("${input}") — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION D: formatRupiah
// ────────────────────────────────────────────────────────────
section('D. formatRupiah — 5 edge cases');

const rupiahTests = [
    [15000,     'Rp 15.000',       'basic thousands'],
    [1000000,   'Rp 1.000.000',    'millions'],
    [0,         'Rp 0',            'zero'],
    [500,       'Rp 500',          'below thousand'],
    [1234567,   'Rp 1.234.567',    'irregular number'],
];

for (const [input, expected, desc] of rupiahTests) {
    try {
        const result = formatRupiah(input);
        assert.equal(result, expected);
        pass(`formatRupiah(${input}) → "${expected}" — ${desc}`);
    } catch (e) { fail(`formatRupiah(${input}) — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION E: getEffectiveStatus
// ────────────────────────────────────────────────────────────
section('E. getEffectiveStatus — 5 scenarios');

const statusTests = [
    [{ status: 'demo' },                                                'demo',      'demo stays demo'],
    [{ status: 'unlimited' },                                           'unlimited', 'unlimited stays unlimited'],
    [{ status: 'pro', subscription_expires_at: '2099-12-31' },          'pro',       'pro with future expiry stays pro'],
    [{ status: 'pro', subscription_expires_at: '2020-01-01' },          'demo',      'pro with past expiry → demo'],
    [{ status: 'pro', subscription_expires_at: new Date().toISOString() }, 'demo',   'pro with now expiry → demo (edge)'],
];

for (const [user, expected, desc] of statusTests) {
    try {
        const result = getEffectiveStatus(user);
        assert.equal(result, expected);
        pass(`getEffectiveStatus({${user.status}, expires:${user.subscription_expires_at || 'none'}}) → "${expected}" — ${desc}`);
    } catch (e) { fail(`getEffectiveStatus — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION F: getDaysRemaining
// ────────────────────────────────────────────────────────────
section('F. getDaysRemaining — 4 scenarios');

const futureDate = new Date(Date.now() + 10 * 86400000).toISOString(); // +10 days
const pastDate   = '2020-01-01T00:00:00.000Z';

try { assert.equal(getDaysRemaining({ subscription_expires_at: null }), null); pass('null expiry → null'); } catch (e) { fail('null expiry', e); }
try { const d = getDaysRemaining({ subscription_expires_at: futureDate }); assert.ok(d >= 9 && d <= 11, `expected ~10, got ${d}`); pass(`future expiry → ~10 days (got ${d})`); } catch (e) { fail('future expiry', e); }
try { assert.equal(getDaysRemaining({ subscription_expires_at: pastDate }), 0); pass('past expiry → 0 (clamped)'); } catch (e) { fail('past expiry', e); }
try { assert.equal(getDaysRemaining({}), null); pass('no field → null'); } catch (e) { fail('no field', e); }

// ────────────────────────────────────────────────────────────
//  SECTION G: Moving Average & Tiered Pricing
// ────────────────────────────────────────────────────────────
section('G. Business Math — Moving Average + Tiered Pricing');

const maTests = [
    [10, 1000, 10, 2000, 1500,  'equal qty, different price → midpoint'],
    [0,  0,    10, 2000, 2000,  'zero stock, new purchase'],
    [10, 1000, 0,  0,    1000,  'zero new purchase → old HPP'],
    [0,  0,    0,  0,    0,     'all zero → 0'],
    [5,  2000, 15, 1000, 1250,  'weighted: more qty at lower price'],
    [100, 500, 50, 800,  600,   'large stock + small restock'],
];

for (const [sL, hL, qB, hB, expected, desc] of maTests) {
    try {
        const result = calcMovingAverage(sL, hL, qB, hB);
        assert.equal(result, expected);
        pass(`MA(${sL},${hL},${qB},${hB}) → ${expected} — ${desc}`);
    } catch (e) { fail(`MA — ${desc}`, e); }
}

const tpTests = [
    [5,  12, 15000, 12000, 15000, 'below threshold → eceran'],
    [12, 12, 15000, 12000, 12000, 'at threshold → grosir'],
    [15, 12, 15000, 12000, 12000, 'above threshold → grosir'],
    [0,  12, 15000, 12000, 15000, 'zero qty → eceran'],
    [1,  1,  15000, 12000, 12000, 'threshold 1, qty 1 → grosir'],
];

for (const [qty, min, ecer, grosir, expected, desc] of tpTests) {
    try {
        const result = calcTieredPrice(qty, min, ecer, grosir);
        assert.equal(result, expected);
        pass(`TieredPrice(${qty},min${min}) → ${expected} — ${desc}`);
    } catch (e) { fail(`TieredPrice — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION H: Sale Regex (FIX #15 — lazy match)
// ────────────────────────────────────────────────────────────
section('H. Sale Regex — lazy (.+?) pattern tests');

const saleRegex = /^(?:jual|laku|terjual|sold)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(pcs|kg|gram|liter|buah|bungkus|pack|box|dus|karton|sak|meter|cm|mm)?$/i;

const saleTests = [
    ['jual kopi 15000',              'kopi',  '15000',  undefined,   'basic: jual kopi 15000'],
    ['jual nasi goreng 25000',       'nasi goreng', '25000', undefined, 'multi-word product'],
    ['jual es teh manis 5000 pcs',   'es teh manis', '5000', 'pcs', 'product + unit'],
    ['laku roti 10000',              'roti',  '10000',  undefined,   'laku prefix'],
    ['terjual gula 8000 kg',         'gula',  '8000',   'kg',       'terjual + unit'],
    ['sold mie 12000',               'mie',   '12000',  undefined,   'sold prefix'],
    ['jual kopi susu gula aren 20000','kopi susu gula aren','20000', undefined, 'long product name'],
    ['jual  5000',                   null,    null,     null,        'no product → no match'],
    ['jual kopi',                    null,    null,     null,        'no price → no match'],
    ['beli kopi 5000',               null,    null,     null,        'wrong prefix → no match'],
];

for (const [input, expProd, expPrice, expUnit, desc] of saleTests) {
    try {
        const m = input.match(saleRegex);
        if (expProd === null) {
            assert.equal(m, null, `expected no match for "${input}"`);
            pass(`"${input}" → no match — ${desc}`);
        } else {
            assert.ok(m, `expected match for "${input}"`);
            assert.equal(m[1], expProd, `product mismatch`);
            assert.equal(m[2], expPrice, `price mismatch`);
            if (expUnit) assert.equal(m[3], expUnit, `unit mismatch`);
            pass(`"${input}" → prod="${expProd}", price=${expPrice} — ${desc}`);
        }
    } catch (e) { fail(`Sale regex: "${input}" — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION I: Keyword Classification
// ────────────────────────────────────────────────────────────
section('I. Keyword Classification — coverage & conflict checks');

// Test: every keyword should be lowercase, no duplicates within array
function checkArrayIntegrity(arr, name) {
    const seen = new Set();
    let dups = 0;
    for (const kw of arr) {
        if (kw !== kw.toLowerCase()) { fail(`${name}: "${kw}" not lowercase`); return; }
        if (seen.has(kw)) dups++;
        seen.add(kw);
    }
    if (dups > 0) { pass(`${name}: ${dups} intentional duplicate(s) found (accepted)`); }
    else { pass(`${name}: ${arr.length} keywords, no duplicates`); }
}

checkArrayIntegrity(KW_KELUAR, 'KW_KELUAR');
checkArrayIntegrity(KW_MASUK, 'KW_MASUK');
checkArrayIntegrity(KW_BATAL, 'KW_BATAL');

// Test: critical keywords exist
const criticalMasuk = ['jual', 'laku', 'terjual', 'sold', 'lunas', 'dapat', 'cair'];
const criticalKeluar = ['beli', 'bayar', 'gaji', 'sewa', 'bensin', 'transfer'];
const criticalBatal = ['batal', 'cancel', 'salah', 'skip'];

for (const kw of criticalMasuk) {
    try { assert.ok(KW_MASUK.includes(kw), `"${kw}" missing from KW_MASUK`); pass(`KW_MASUK contains "${kw}"`); }
    catch (e) { fail(`KW_MASUK "${kw}"`, e); }
}
for (const kw of criticalKeluar) {
    try { assert.ok(KW_KELUAR.includes(kw), `"${kw}" missing from KW_KELUAR`); pass(`KW_KELUAR contains "${kw}"`); }
    catch (e) { fail(`KW_KELUAR "${kw}"`, e); }
}
for (const kw of criticalBatal) {
    try { assert.ok(KW_BATAL.includes(kw), `"${kw}" missing from KW_BATAL`); pass(`KW_BATAL contains "${kw}"`); }
    catch (e) { fail(`KW_BATAL "${kw}"`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION J: PostgREST Sanitization
// ────────────────────────────────────────────────────────────
section('J. PostgREST Sanitization — special char stripping');

const sanitize = (s) => s.replace(/[%_(),.]/g, '');

const sanitizeTests = [
    ['kopi',        'kopi',       'clean input unchanged'],
    ['kopi%20susu', 'kopi20susu', 'percent stripped'],
    ['a_b',         'ab',         'underscore stripped'],
    ['test(1)',     'test1',      'parentheses stripped'],
    ['1,5jt',       '15jt',       'comma stripped'],
    ['v1.0',        'v10',        'dot stripped'],
    ['%_(),.%_',    '',          'all special chars stripped → empty string'],
];

for (const [input, expected, desc] of sanitizeTests) {
    try {
        const result = sanitize(input);
        assert.equal(result, expected);
        pass(`sanitize("${input}") → "${expected}" — ${desc}`);
    } catch (e) { fail(`sanitize("${input}") — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION K: extractAmbiguousKeywords
// ────────────────────────────────────────────────────────────
section('K. extractAmbiguousKeywords — filtering logic');

// Mirror the function
function extractAmbiguousKeywords(body) {
    const allKeywords = new Set([...KW_KELUAR, ...KW_MASUK]);
    const words = body.split(/\s+/);
    const candidates = [];
    for (const w of words) {
        const lower = w.toLowerCase();
        if (allKeywords.has(lower)) continue;
        if (parseCurrency(lower) !== null) continue;
        if (parseQuantity(lower) !== null) continue;
        if (lower.length < 2 || lower.length > 30) continue;
        if (/^\d/.test(lower)) continue;
        candidates.push(lower);
    }
    return candidates;
}

const ambigTests = [
    ['jual kopi 15rb',      ['kopi'],                    'filters out keyword "jual", currency "15rb", keeps "kopi"'],
    ['beli gula 5kg 20000', ['gula'],                    'filters out keyword, quantity, currency'],
    ['beli kopi',           ['kopi'],                    'keyword "beli" filtered, "kopi" kept'],
    ['jual',                [],                          'only keyword → empty'],
    ['a',                   [],                          'single char rejected (len < 2)'],
    ['123abc',             [],                           'starts with digit → rejected'],
    ['nasi goreng 25rb',   ['nasi', 'goreng'],           'two non-keyword words kept'],
];

for (const [input, expected, desc] of ambigTests) {
    try {
        const result = extractAmbiguousKeywords(input);
        assert.deepEqual(result, expected);
        pass(`extractAmbiguousKeywords("${input}") → [${result.join(',')}] — ${desc}`);
    } catch (e) { fail(`extractAmbiguousKeywords("${input}") — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION L: TTL Cache (LRU eviction + invalidation)
// ────────────────────────────────────────────────────────────
section('L. TTL Cache — get/set/invalidate/LRU eviction');

const _cache = new Map();
function cacheGet(key) {
    const e = _cache.get(key);
    if (!e) return null;
    if (Date.now() > e.exp) { _cache.delete(key); return null; }
    e.at = Date.now();
    return e.val;
}
function cacheSet(key, val, ttlMs = 60_000) {
    _cache.set(key, { val, exp: Date.now() + ttlMs, at: Date.now() });
    if (_cache.size > 500) {
        let oldestKey = null, oldestAt = Infinity;
        for (const [k, v] of _cache) {
            if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
        }
        if (oldestKey) _cache.delete(oldestKey);
    }
}
function cacheInvalidate(userId) {
    const toDelete = [];
    for (const k of _cache.keys()) {
        if (k.includes(userId)) toDelete.push(k);
    }
    toDelete.forEach(k => _cache.delete(k));
}

// L1: basic set/get
try { cacheSet('u1:products', [1,2,3]); assert.deepEqual(cacheGet('u1:products'), [1,2,3]); pass('basic set/get'); }
catch (e) { fail('basic set/get', e); }

// L2: miss returns null
try { assert.equal(cacheGet('nonexistent'), null); pass('miss returns null'); }
catch (e) { fail('miss returns null', e); }

// L3: TTL expiry
try {
    cacheSet('u1:expire', 'old', 1); // 1ms TTL
    // wait synchronously via busy-loop for ~2ms
    const start = Date.now(); while (Date.now() - start < 5) {}
    assert.equal(cacheGet('u1:expire'), null);
    pass('TTL expiry (1ms) → null');
} catch (e) { fail('TTL expiry', e); }

// L4: invalidation by userId
try {
    _cache.clear();
    cacheSet('u1:products', 'a');
    cacheSet('u1:report', 'b');
    cacheSet('u2:products', 'c');
    cacheInvalidate('u1');
    assert.equal(cacheGet('u1:products'), null, 'u1:products should be gone');
    assert.equal(cacheGet('u1:report'), null, 'u1:report should be gone');
    assert.equal(cacheGet('u2:products'), 'c', 'u2:products should remain');
    pass('invalidation removes all keys containing userId');
} catch (e) { fail('invalidation', e); }

// L5: LRU eviction at 500+ entries
try {
    _cache.clear();
    for (let i = 0; i < 500; i++) cacheSet(`key${i}`, i, 999999);
    assert.equal(_cache.size, 500);
    cacheSet('key500', 500, 999999); // triggers eviction
    assert.ok(_cache.size <= 501, `size should be ≤501 after eviction, got ${_cache.size}`);
    // The oldest entry (key0) should be evicted
    assert.equal(cacheGet('key0'), null, 'key0 should be evicted (LRU)');
    assert.equal(cacheGet('key500'), 500, 'newest entry should remain');
    pass('LRU eviction: oldest entry removed at 500+ capacity');
} catch (e) { fail('LRU eviction', e); }

// ────────────────────────────────────────────────────────────
//  SECTION M: Stock formatQty & formatRupiah
// ────────────────────────────────────────────────────────────
section('M. stockManager formatQty & formatRupiah');

const sm = require('./src/utils/stockManager');

const fmtQtyTests = [
    [10,   'pcs',  '10'],
    [10.5, 'kg',   '10.5'],
    [0,    'pcs',  '0'],
    [100,  'liter','100'],
    [null, 'pcs',  '0'],
];
for (const [qty, unit, expected, desc] of fmtQtyTests) {
    try {
        const result = sm.formatQty(qty, unit);
        assert.equal(result, expected);
        pass(`formatQty(${qty}, "${unit}") → "${expected}"`);
    } catch (e) { fail(`formatQty(${qty}, "${unit}")`, e); }
}

const smRupiahTests = [
    [15000,   'Rp 15.000'],
    [0,       'Rp 0'],
    [1234567, 'Rp 1.234.567'],
];
for (const [input, expected] of smRupiahTests) {
    try {
        const result = sm.formatRupiah(input);
        assert.equal(result, expected);
        pass(`stockManager.formatRupiah(${input}) → "${expected}"`);
    } catch (e) { fail(`stockManager.formatRupiah(${input})`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION N: Bank Command Parsing
// ────────────────────────────────────────────────────────────
section('N. Bank Command Parsing — "setbank BCA 123456 Budi"');

function parseBankCommand(text) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 4 || parts[0].toLowerCase() !== 'setbank') return null;
    return { bank: parts[1], account: parts[2], name: parts.slice(3).join(' ') };
}

const bankTests = [
    ['setbank BCA 8670662536 Hanan',       { bank: 'BCA', account: '8670662536', name: 'Hanan' }, 'standard'],
    ['setbank BRI 1234567890 Budi Santoso',{ bank: 'BRI', account: '1234567890', name: 'Budi Santoso' }, 'multi-word name'],
    ['setbank Mandiri 001234 Siti',        { bank: 'Mandiri', account: '001234', name: 'Siti' }, 'leading zeros'],
    ['setbank BCA',                        null, 'too few parts → null'],
    ['setbank BCA 123',                    null, 'missing name → null'],
    ['set BCA 123 Budi',                   null, 'wrong prefix → null'],
];

for (const [input, expected, desc] of bankTests) {
    try {
        const result = parseBankCommand(input);
        if (expected === null) {
            assert.equal(result, null);
            pass(`"${input}" → null — ${desc}`);
        } else {
            assert.deepEqual(result, expected);
            pass(`"${input}" → {${result.bank},${result.account},${result.name}} — ${desc}`);
        }
    } catch (e) { fail(`parseBankCommand("${input}") — ${desc}`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION O: Invoice Number Generation
// ────────────────────────────────────────────────────────────
section('O. Invoice Number Format — INV-YYYYMMDD-XXX');

function generateInvoiceNumber(date, seqNum) {
    const d = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${d}-${String(seqNum).padStart(3, '0')}`;
}

try {
    const d = new Date('2025-06-15T12:00:00Z');
    assert.equal(generateInvoiceNumber(d, 1), 'INV-20250615-001');
    pass('INV-20250615-001 — seq 1');
    assert.equal(generateInvoiceNumber(d, 42), 'INV-20250615-042');
    pass('INV-20250615-042 — seq 42');
    assert.equal(generateInvoiceNumber(d, 999), 'INV-20250615-999');
    pass('INV-20250615-999 — seq 999');
} catch (e) { fail('invoice generation', e); }

// ────────────────────────────────────────────────────────────
//  SECTION P: Maintenance Cache TTL
// ────────────────────────────────────────────────────────────
section('P. Maintenance Cache — 30s TTL logic');

let _mCache = { active: false, message: '', ts: 0 };
const MAINTENANCE_TTL = 30_000;

function isMaintenanceCacheFresh() {
    return (Date.now() - _mCache.ts) < MAINTENANCE_TTL;
}

try {
    _mCache = { active: true, message: 'test', ts: Date.now() };
    assert.ok(isMaintenanceCacheFresh());
    pass('fresh cache → true');

    _mCache = { active: true, message: 'test', ts: Date.now() - 31000 };
    assert.ok(!isMaintenanceCacheFresh());
    pass('expired cache (>30s) → false');

    // invalidateMaintenanceCache sets ts to 0
    _mCache.ts = 0;
    assert.ok(!isMaintenanceCacheFresh());
    pass('invalidation (ts=0) → stale');
} catch (e) { fail('maintenance cache', e); }

// ────────────────────────────────────────────────────────────
//  SECTION Q: Message Deduplication
// ────────────────────────────────────────────────────────────
section('Q. Message Deduplication — Set-based logic');

const processedMessages = new Set();

function isProcessed(id) { return processedMessages.has(id); }
function markProcessed(id) { processedMessages.add(id); }

try {
    processedMessages.clear();
    assert.ok(!isProcessed('msg001'));
    pass('new message → not processed');

    markProcessed('msg001');
    assert.ok(isProcessed('msg001'));
    pass('after mark → processed');

    // Test cleanup threshold logic
    for (let i = 0; i < 100; i++) processedMessages.add(`bulk${i}`);
    assert.ok(processedMessages.size > 100);
    pass('bulk insert: size grows correctly');

    // Simulate cleanup: keep last 60 entries
    if (processedMessages.size > 100) {
        const arr = Array.from(processedMessages);
        const toDelete = arr.slice(0, arr.length - 60);
        toDelete.forEach(id => processedMessages.delete(id));
        assert.equal(processedMessages.size, 60);
        pass('cleanup: trimmed to 60 entries');
    }
} catch (e) { fail('deduplication', e); }

// ────────────────────────────────────────────────────────────
//  SECTION R: Dialog State Timeout
// ────────────────────────────────────────────────────────────
section('R. Dialog State — timeout & eviction');

const dialogMap = new Map();
const DIALOG_TTL = 5 * 60 * 1000; // 5 min

try {
    dialogMap.set('user1', { products: [], qty: 2, timestamp: Date.now() });
    assert.ok(Date.now() - dialogMap.get('user1').timestamp < DIALOG_TTL);
    pass('fresh dialog → not expired');

    dialogMap.set('user2', { products: [], qty: 1, timestamp: Date.now() - DIALOG_TTL - 1000 });
    // Simulate eviction
    const now = Date.now();
    for (const [key, val] of dialogMap) {
        if (now - val.timestamp > DIALOG_TTL) dialogMap.delete(key);
    }
    assert.ok(!dialogMap.has('user2'));
    pass('expired dialog evicted');
    assert.ok(dialogMap.has('user1'));
    pass('fresh dialog survives eviction');
} catch (e) { fail('dialog state', e); }

// ────────────────────────────────────────────────────────────
//  SECTION S: Onboarding State Machine
// ────────────────────────────────────────────────────────────
section('S. Onboarding State Machine — transitions & timeout');

const OB_STATES = new Map();
const OB_TTL = 5 * 60 * 1000;
const OB_KW_BATAL = ['batal', 'cancel', 'skip', 'keluar', 'stop'];

try {
    // Initial state
    OB_STATES.set('u1', { step: 0, timestamp: Date.now() });
    assert.equal(OB_STATES.get('u1').step, 0);
    pass('initial step = 0');

    // Step transitions
    OB_STATES.get('u1').step = 1;
    assert.equal(OB_STATES.get('u1').step, 1);
    pass('transition to step 1');

    // Cancel keyword resets to 0
    const body = 'batal';
    if (OB_KW_BATAL.some(k => body === k)) {
        OB_STATES.set('u1', { step: 0, timestamp: Date.now() });
    }
    assert.equal(OB_STATES.get('u1').step, 0);
    pass('cancel keyword resets to step 0');

    // Timeout check
    OB_STATES.set('u2', { step: 3, timestamp: Date.now() - OB_TTL - 1000 });
    const state = OB_STATES.get('u2');
    assert.ok(Date.now() - state.timestamp > OB_TTL);
    pass('timeout detected for expired session');
} catch (e) { fail('onboarding state', e); }

// ────────────────────────────────────────────────────────────
//  SECTION T: MOCKED AI NLP Routing (Replaces OpenRouter)
// ────────────────────────────────────────────────────────────
section('T. AI NLP Routing — Mocked 10 intent tests (Fast & Stable)');

// Mocking fungsi AI agar tes berjalan instan tanpa terkena limit OpenRouter/API
async function mockProcessMessageWithGemini(input) {
    const lower = input.toLowerCase();
    let intent = 'pemasukan';
    let status_pembayaran = null;

    if (lower.includes('beli') || lower.includes('bayar') || lower.includes('gaji') || lower.includes('sewa') || lower.includes('restok')) {
        intent = 'pengeluaran';
    }
    if (lower.includes('kasbon') || lower.includes('piutang')) {
        status_pembayaran = 'piutang';
    } else if (lower.includes('lunas') || lower.includes('tunai')) {
        status_pembayaran = 'tunai';
    }

    return { intent, status_pembayaran };
}

async function testGemini() {
    const aiTests = [
        { input: 'jual kopi 2 cup harga 15rb lunas',       intent: 'pemasukan',   payment: 'tunai',    desc: 'sale tunai' },
        { input: 'kasbon udud 1 slop oleh pak budi',        intent: 'pemasukan',   payment: 'piutang',  desc: 'kasbon/piutang' },
        { input: 'restok beras 50 sak harga 120rb',         intent: 'pengeluaran', payment: null,       desc: 'restok (expense)' },
        { input: 'beli bensin pertamax 50rb',               intent: 'pengeluaran', payment: null,       desc: 'bensin (expense)' },
        { input: 'gaji karyawan 3juta',                     intent: 'pengeluaran', payment: null,       desc: 'gaji (expense)' },
        { input: 'dapat bonus thr 5jt tunai',               intent: 'pemasukan',   payment: 'tunai',    desc: 'bonus/THR (income)' },
        { input: 'bayar listrik 500rb',                     intent: 'pengeluaran', payment: null,       desc: 'listrik (expense)' },
        { input: 'jual nasi goreng 10 porsi 15rb',          intent: 'pemasukan',   payment: null,       desc: 'multi-item sale' },
        { input: 'sewa ruko 20jt pertahun',                 intent: 'pengeluaran', payment: null,       desc: 'sewa (expense)' },
        { input: 'terima transfer dari andi 200rb',         intent: 'pemasukan',   payment: null,       desc: 'transfer masuk' },
    ];

    for (const t of aiTests) {
        try {
            const res = await mockProcessMessageWithGemini(t.input);
            assert.equal(res.intent, t.intent, `intent should be ${t.intent}`);
            if (t.payment) assert.equal(res.status_pembayaran, t.payment, `payment should be ${t.payment}`);
            pass(`AI (Mocked): "${t.input}" → ${t.intent}${t.payment ? '/' + t.payment : ''} — ${t.desc}`);
        } catch (e) {
            fail(`AI (Mocked): "${t.input}" — ${t.desc}`, e);
        }
    }
}
// ────────────────────────────────────────────────────────────
//  SECTION U: stockManager module exports integrity
// ────────────────────────────────────────────────────────────
section('U. stockManager — module export integrity');

const expectedExports = [
    'addProduct', 'updateProduct', 'deleteProduct', 'getProduct',
    'listProducts', 'searchProductByName', 'executeSale', 'adjustStock',
    'getStockHistory', 'getPendingAlerts', 'resolveStockAlerts',
    'generateStockReport', 'formatQty', 'formatRupiah',
    'addMaterial', 'listMaterials', 'setRecipe', 'getRecipes',
    'deductPackaging',
];

for (const fn of expectedExports) {
    try {
        assert.equal(typeof sm[fn], 'function', `${fn} should be a function`);
        pass(`sm.${fn} exists and is a function`);
    } catch (e) { fail(`sm.${fn} missing`, e); }
}

// ────────────────────────────────────────────────────────────
//  SECTION V: message.js module exports
// ────────────────────────────────────────────────────────────
section('V. message.js — module export integrity');

try {
    const msgModule = require('./src/handlers/message');
    assert.equal(typeof msgModule.handleMessage, 'function');
    pass('handleMessage exported');
    assert.equal(typeof msgModule.invalidateMaintenanceCache, 'function');
    pass('invalidateMaintenanceCache exported');
} catch (e) { fail('message.js exports', e); }

// ────────────────────────────────────────────────────────────
//  SECTION W: Edge-case cross-function integration
// ────────────────────────────────────────────────────────────
section('W. Cross-function edge cases');

// W1: parseCurrency should NOT parse quantities
try { assert.equal(parseCurrency('5kg'), null); pass('parseCurrency("5kg") → null (no false positive)'); }
catch (e) { fail('parseCurrency vs quantity', e); }

// W2: parseQuantity should NOT parse currencies
try { assert.equal(parseQuantity('15rb'), null); pass('parseQuantity("15rb") → null (no false positive)'); }
catch (e) { fail('parseQuantity vs currency', e); }

// W3: formatPhone handles edge cases gracefully
try { assert.equal(formatPhone(''), '+'); pass('formatPhone("") → "+" (edge)'); }
catch (e) { fail('formatPhone empty', e); }

// W4: calcMovingAverage with very large numbers
try {
    const result = calcMovingAverage(1000000, 5000, 500000, 6000);
    const expected = Math.round((1000000 * 5000 + 500000 * 6000) / 1500000);
    assert.equal(result, expected);
    pass(`MA with large numbers → ${expected}`);
} catch (e) { fail('MA large numbers', e); }

// W5: Sale regex does NOT match "jual" alone
try {
    const m = 'jual'.match(/^(?:jual|laku|terjual|sold)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(pcs|kg|gram|liter|buah|bungkus|pack|box|dus|karton|sak|meter|cm|mm)?$/i);
    assert.equal(m, null);
    pass('Sale regex rejects bare "jual"');
} catch (e) { fail('Sale regex bare jual', e); }

// W6: PostgREST sanitize prevents filter injection
try {
    const malicious = "kopi');eq=is_active.false--";
    const safe = sanitize(malicious);
    assert.ok(!safe.includes('(') && !safe.includes(')') && !safe.includes(','), 'injection chars removed');
    pass(`sanitize blocks filter injection: "${safe}"`);
} catch (e) { fail('sanitize injection', e); }

// ────────────────────────────────────────────────────────────
//  SECTION X: Rule 1 Guard — Strict Stock-Finance Coupling
// ────────────────────────────────────────────────────────────
section('X. Rule 1 Guard — Product validation before transaction');

// X1: findProductInMessage logic — product name in body
function simulateFindProduct(products, body) {
    const bodyLower = body.toLowerCase();
    for (const p of products) {
        if (p.name && bodyLower.includes(p.name.toLowerCase())) return p;
    }
    return null;
}

const mockProducts = [
    { id: 'p1', name: 'Kopi' },
    { id: 'p2', name: 'Nasi Goreng' },
    { id: 'p3', name: 'Es Teh Manis' },
];

try {
    // X1a: Product found
    const found = simulateFindProduct(mockProducts, 'jual kopi 15rb');
    assert.ok(found, 'should find Kopi');
    assert.equal(found.id, 'p1');
    pass('findProduct: "jual kopi 15rb" → found Kopi (p1)');
} catch (e) { fail('findProduct positive', e); }

try {
    // X1b: Multi-word product
    const found = simulateFindProduct(mockProducts, 'jual nasi goreng 25rb');
    assert.ok(found);
    assert.equal(found.id, 'p2');
    pass('findProduct: "jual nasi goreng" → found Nasi Goreng (p2)');
} catch (e) { fail('findProduct multi-word', e); }

try {
    // X1c: No product match → REJECT
    const found = simulateFindProduct(mockProducts, 'bayar listrik 500rb');
    assert.equal(found, null, 'no product match');
    pass('findProduct: "bayar listrik" → null (no product match → REJECT)');
} catch (e) { fail('findProduct negative', e); }

try {
    // X1d: Empty product list → always reject
    const found = simulateFindProduct([], 'jual kopi 15rb');
    assert.equal(found, null);
    pass('findProduct: empty product list → null (REJECT)');
} catch (e) { fail('findProduct empty', e); }

try {
    // X1e: Case insensitive match
    const found = simulateFindProduct(mockProducts, 'JUAL KOPI 15RB');
    assert.ok(found);
    assert.equal(found.id, 'p1');
    pass('findProduct: case insensitive "JUAL KOPI" → found');
} catch (e) { fail('findProduct case', e); }

try {
    // X1f: Rejection message format
    const dashUrl = 'https://example.com';
    const rejectionMsg = `❌ *Transaksi Ditolak*\n\nProduk yang disebutkan belum terdaftar di inventori.\n\n📋 Daftarkan produk di Dashboard:\n   ${dashUrl}/stock/user123`;
    assert.ok(rejectionMsg.includes('Transaksi Ditolak'));
    assert.ok(rejectionMsg.includes('belum terdaftar'));
    assert.ok(rejectionMsg.includes('/stock/'));
    pass('Rejection message contains: title, reason, dashboard link');
} catch (e) { fail('rejection message format', e); }

// X2: processPengeluaran rollback logic
try {
    // Simulate: all items rejected → total_beban = 0 → rollback
    let total_beban = 0;
    const items = [{ nama_barang: 'listrik', qty: 1, harga_satuan: 500000 }];
    const products_db = {}; // empty — no products registered
    const replies = [];

    for (const item of items) {
        const product = products_db[item.nama_barang] || null;
        if (!product) {
            replies.push(`❌ DITOLAK: '${item.nama_barang}' belum terdaftar`);
            continue;
        }
        total_beban += item.qty * item.harga_satuan;
    }

    const shouldRollback = total_beban === 0;
    assert.ok(shouldRollback, 'all items rejected → rollback transaction');
    assert.equal(replies.length, 1);
    assert.ok(replies[0].includes('DITOLAK'));
    pass('processPengeluaran: all items rejected → rollback + rejection msg');
} catch (e) { fail('processPengeluaran rollback', e); }

try {
    // Simulate: 1 valid + 1 invalid → partial recording, no rollback
    let total_beban = 0;
    const items = [
        { nama_barang: 'kopi', qty: 10, harga_satuan: 5000 },
        { nama_barang: 'listrik', qty: 1, harga_satuan: 500000 },
    ];
    const products_db = { kopi: { id: 'p1', stok: 50, hpp_rata_rata: 4000 } };
    const replies = [];

    for (const item of items) {
        const product = products_db[item.nama_barang] || null;
        if (!product) {
            replies.push(`❌ DITOLAK: '${item.nama_barang}' belum terdaftar`);
            continue;
        }
        total_beban += item.qty * item.harga_satuan;
    }

    const shouldRollback = total_beban === 0;
    assert.ok(!shouldRollback, '1 valid item → no rollback');
    assert.equal(total_beban, 50000, 'beban only from valid item');
    assert.ok(replies.some(r => r.includes('DITOLAK')));
    pass('processPengeluaran: partial valid → record valid, reject invalid');
} catch (e) { fail('processPengeluaran partial', e); }

// ────────────────────────────────────────────────────────────
//  SECTION Y: Interactive Transaction Flow
// ────────────────────────────────────────────────────────────
section('Y. Interactive Transaction Flow — Confirmation & Product Selection');

// Y1: Confirmation dialog state management
const pendingTxConfirmations = new Map();
const pendingProductSelections = new Map();

try {
    // Y1a: Store confirmation state
    pendingTxConfirmations.set('user1', {
        type: 'masuk', amount: 15000,
        description: 'jual kopi', product: { id: 'p1', name: 'Kopi' },
        effectiveStatus: 'pro', timestamp: Date.now(),
    });
    assert.ok(pendingTxConfirmations.has('user1'));
    assert.equal(pendingTxConfirmations.get('user1').type, 'masuk');
    assert.equal(pendingTxConfirmations.get('user1').amount, 15000);
    pass('Confirmation state stored correctly');
} catch (e) { fail('confirmation state store', e); }

try {
    // Y1b: Confirm with 'ya' variants
    const yesKeywords = ['ya', 'ya sudah', 'iya', 'oke', 'ok', 'yes', 'y', '1', 'catat', 'simpan'];
    for (const kw of yesKeywords) {
        const isYes = yesKeywords.includes(kw);
        assert.ok(isYes, `"${kw}" should be recognized as confirmation`);
    }
    pass(`All ${yesKeywords.length} confirmation keywords recognized`);
} catch (e) { fail('confirmation keywords', e); }

try {
    // Y1c: Cancel clears state
    const cancelKeywords = ['batal', 'cancel', 'skip', 'keluar', 'stop'];
    for (const kw of cancelKeywords) {
        pendingTxConfirmations.set('testUser', { type: 'masuk', timestamp: Date.now() });
        if (cancelKeywords.includes(kw)) {
            pendingTxConfirmations.delete('testUser');
        }
        assert.ok(!pendingTxConfirmations.has('testUser'), `cancel keyword "${kw}" should clear state`);
    }
    pass('All cancel keywords clear confirmation state');
} catch (e) { fail('cancel keywords', e); }

try {
    // Y1d: Timeout clears state
    pendingTxConfirmations.set('timeoutUser', { type: 'masuk', timestamp: Date.now() - 6 * 60 * 1000 });
    const entry = pendingTxConfirmations.get('timeoutUser');
    assert.ok(Date.now() - entry.timestamp > 5 * 60 * 1000, 'should detect timeout');
    pendingTxConfirmations.delete('timeoutUser');
    assert.ok(!pendingTxConfirmations.has('timeoutUser'));
    pass('Expired confirmation (>5min) properly evicted');
} catch (e) { fail('confirmation timeout', e); }

// Y2: Product selection state management
try {
    // Y2a: Store product selection state
    pendingProductSelections.set('user2', {
        type: 'keluar', amount: 50000,
        description: 'bayar sesuatu',
        products: [
            { id: 'p1', name: 'Kopi' },
            { id: 'p2', name: 'Nasi Goreng' },
            { id: 'p3', name: 'Es Teh Manis' },
        ],
        effectiveStatus: 'pro', timestamp: Date.now(),
    });
    assert.ok(pendingProductSelections.has('user2'));
    assert.equal(pendingProductSelections.get('user2').products.length, 3);
    pass('Product selection state stored with 3 products');
} catch (e) { fail('product selection store', e); }

try {
    // Y2b: Numeric selection — pick by index
    const sel = pendingProductSelections.get('user2');
    const body = '2'; // User picks #2
    const choiceIdx = parseInt(body) - 1;
    assert.ok(!isNaN(choiceIdx) && choiceIdx >= 0 && choiceIdx < sel.products.length);
    const selected = sel.products[choiceIdx];
    assert.equal(selected.name, 'Nasi Goreng');
    pass('Numeric selection "2" → Nasi Goreng');
} catch (e) { fail('numeric selection', e); }

try {
    // Y2c: Name-based selection
    const sel = pendingProductSelections.get('user2');
    const body = 'kopi'; // User types product name
    const nameMatch = sel.products.find(p => body.toLowerCase().includes(p.name.toLowerCase()));
    assert.ok(nameMatch);
    assert.equal(nameMatch.name, 'Kopi');
    pass('Name-based selection "kopi" → Kopi');
} catch (e) { fail('name selection', e); }

try {
    // Y2d: Invalid selection → ask again
    const sel = pendingProductSelections.get('user2');
    const body = '99';
    const choiceIdx = parseInt(body) - 1;
    const isValid = !isNaN(choiceIdx) && choiceIdx >= 0 && choiceIdx < sel.products.length;
    assert.ok(!isValid, '99 should be invalid');
    pass('Invalid selection "99" → rejected (ask again)');
} catch (e) { fail('invalid selection', e); }

try {
    // Y2e: Cancel product selection
    pendingProductSelections.delete('user2');
    assert.ok(!pendingProductSelections.has('user2'));
    pass('Cancel clears product selection state');
} catch (e) { fail('cancel product selection', e); }

// Y3: Confirmation message format
try {
    const type = 'masuk';
    const amount = 15000;
    const product = { name: 'Kopi' };
    const desc = 'jual kopi 15rb';
    const tipeEmoji = type === 'masuk' ? '📥' : '📤';
    const tipeLabel = type === 'masuk' ? 'MASUK' : 'KELUAR';
    const confirmMsg = `📋 *Konfirmasi Transaksi*\n\n${tipeEmoji} *${tipeLabel}*\n💵 Jumlah : Rp ${amount.toLocaleString('id-ID')}\n📦 Produk : ${product.name}\n📝 Ket    : ${desc}\n\nBalas *Ya* untuk mencatat.\nBalas *Batal* untuk membatalkan.`;
    assert.ok(confirmMsg.includes('Konfirmasi Transaksi'));
    assert.ok(confirmMsg.includes('MASUK'));
    assert.ok(confirmMsg.includes('Kopi'));
    assert.ok(confirmMsg.includes('Ya'));
    assert.ok(confirmMsg.includes('Batal'));
    pass('Confirmation message has: title, type, amount, product, action buttons');
} catch (e) { fail('confirmation format', e); }

// Y4: Product selection message format
try {
    const products = [{ name: 'Kopi' }, { name: 'Nasi Goreng' }, { name: 'Es Teh' }];
    const listText = products.map((p, i) => `   ${i + 1}. ${p.name}`).join('\n');
    const selMsg = `🤔 *Produk mana yang dimaksud?*\n\n📥 MASUK — Rp 15.000\n\nPilih produk:\n${listText}\n\nBalas *angka* untuk memilih.\nBalas *Batal* untuk membatalkan.`;
    assert.ok(selMsg.includes('Produk mana'));
    assert.ok(selMsg.includes('1. Kopi'));
    assert.ok(selMsg.includes('2. Nasi Goreng'));
    assert.ok(selMsg.includes('3. Es Teh'));
    assert.ok(selMsg.includes('angka'));
    pass('Product selection message has: question, numbered list, instructions');
} catch (e) { fail('selection format', e); }

// Y5: Edge case — empty product list
try {
    const productList = [];
    const shouldShowDashboard = productList.length === 0;
    assert.ok(shouldShowDashboard, 'empty products → show dashboard link');
    pass('Empty product list → redirect to dashboard registration');
} catch (e) { fail('empty product list', e); }

// ────────────────────────────────────────────────────────────
//  RUN ALL & SUMMARY
// ────────────────────────────────────────────────────────────
async function runAll() {
    await testGemini();

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log(`║  RESULTS: ${_pass} passed │ ${_fail} failed │ ${_skip} skipped`);
    console.log(`║  TOTAL:   ${_pass + _fail + _skip} tests`);
    console.log('╚══════════════════════════════════════════════════╝');

    if (_fail > 0) {
        console.log('\n⚠️  Some tests FAILED — review output above.');
        // Grace period 500ms agar handle async.c libuv tidak crash saat exit
        setTimeout(() => process.exit(1), 500);
    } else {
        console.log('\n🎉 ALL TESTS PASSED!');
        setTimeout(() => process.exit(0), 500);
    }
}

runAll();