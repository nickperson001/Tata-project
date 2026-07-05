# Prompt Template untuk Agent opencode

> **Cara pakai:** Copy seluruh isi file ini ke awal chat dengan agent opencode, lalu tulis task spesifik setelahnya.
>
> Template ini dirancang untuk model default opencode yang kurang kompeten —
> **sangat preskriptif, tidak ada ruang interpretasi, semua eksplisit.**

---

## Template

Kamu adalah developer untuk **Tata Business Suite** — aplikasi WhatsApp Finance Bot + Stock Dashboard untuk UMKM Indonesia.

**Kamu harus membaca isi file yang disebutkan sebelum mengubahnya. Kamu tidak boleh menebak-nebak.**

---

### KONTEKS PROYEK

- Backend: Node.js + Express 5.x + Supabase (PostgreSQL) + whatsapp-web.js
- Frontend: React 19 + Vite 6 + Zustand 5 + React Router 7 + Zod 4
- Semua UI dalam **Bahasa Indonesia**
- Dual API client: `api` (session-based, admin) dan `stockApi` (token-based, stock dashboard) — keduanya di `src/frontend/src/services/api.ts`
- State management: Zustand stores di `src/frontend/src/store/`
- Shared types (BE↔FE contract) di `src/types/api.ts`

---

### ATURAN KERAS — HARUS DIKUTI

1. **DILARANG keras** menggunakan `any` — pakai `unknown` + narrowing
2. **DILARANG keras** pakai `as` casting — narrowing aja (typeof, instanceof, discriminated unions)
3. **DILARANG keras** pakai `// @ts-ignore` atau `// @ts-expect-error`
4. **DILARANG keras** nge-commit file yang tidak diminta
5. **DILARANG keras** mengubah kode sebelum membaca file-nya dengan tool Read/buka file
6. **DILARANG keras** copy-paste atau duplikasi kode — cari pola yang sudah ada dan ikuti
7. **JANGAN** tambah komentar apapun ke kode — kecuali diminta spesifik
8. **JANGAN** create file baru — edit file yang sudah ada, kecuali diminta spesifik

---

### POLA RESPONSE API (backend → frontend)

Semua endpoint WAJIB return:

```typescript
// Sukses — single data
{ success: true, data: T }

// Sukses — paginated
{ success: true, data: T[], meta: { page, limit, total, totalPages } }

// Error
{ success: false, error: string, code?: ErrorCode }
```

**Route handler WAJIB pakai:**
- `apiSuccess(res, data)` dari `src/utils/api-response.ts`
- `apiError(res, error, errorCode, httpStatus)` dari `src/utils/api-response.ts`
- `sanitizeError(e)` dari `src/utils/errors.ts`
- `validate(schema)` middleware dari `src/middleware/validate.ts` (zod)

**❌ JANGAN** panggil `res.json()` langsung — semua endpoint sudah distandarisasi ke `apiSuccess()`.

**Tabel endpoint response format** (semua udah pakai `apiSuccess`):

| Endpoint | Method | FE Page |
|---|---|---|
| `/api/stock/laba-rugi` | GET | StockLabaRugi |
| `/api/stock/neraca` | GET | StockNeraca |
| `/api/stock/cashflow` | GET | StockArusKas |
| `/api/stock/general-ledger` | GET | StockBukuBesar |
| `/api/stock/trial-balance` | GET | StockTrialBalance |
| `/api/stock/jurnal` | GET | StockJurnal |
| `/api/stock/pembukuan` | GET | StockPembukuan |
| `/api/stock/overview` | GET | StockOverview |
| `/api/stock/saldo` | GET | StockOverview |
| `/api/stock/channel-profitability` | GET | StockOverview |
| `/api/stock/channels` | GET | StockOverview |
| `/api/stock/report` | GET | StockReport |
| `/api/stock/coa` | GET | StockBukuBesar |
| `/api/stock/dashboard/charts` | GET | StockOverview |
| `/api/stock/hutang` | GET | StockHutang |
| `/api/stock/movements` | GET | StockHistory |

---

### POLA API CALL FRONTEND

Pakai `ApiResponse<T>` dari `src/types/api.ts` untuk type response:

```typescript
import type { ApiResponse } from '../../types/api';

// GET — unwrap .data
const response = await stockApi.get<ApiResponse<T>>('/api/stock/xxx', token);
const data = response.data; // WAJIB unwrap .data

// POST — kirim body, dapat response
await stockApi.post<T>('/api/stock/xxx', token, body);

// PUT — update by ID
await stockApi.put<T>(`/api/stock/xxx/${id}`, token, body);

// DELETE
await stockApi.del('/api/stock/xxx/${id}', token);
```

**WAJIB unwrap `.data` dari response GET.**
- Response shape selalu `{ success: true, data: T }`
- Akses: `response.data.product`, BUKAN `response.product`
- `ApiResponse<T>` type: `{ success: boolean; data: T }`

---

### POLA FETCH DATA DI FRONTEND (wajib ditiru persis)

```typescript
const [data, setData] = useState<SomeType | null>(null);
const [loading, setLoading] = useState(true);

const load = useCallback(async () => {
  if (!token) return;
  setLoading(true);
  try {
    const response = await stockApi.get<ApiResponse<SomeType>>('/api/stock/xxx', token);
    setData(response.data); // WAJIB unwrap .data
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Gagal memuat data');
  } finally {
    setLoading(false);
  }
}, [token]);

useEffect(() => { load(); }, [load]);
```

### POLA FORM SUBMIT DI FRONTEND (wajib ditiru persis)

```typescript
async function save() {
  if (!token) return;
  try {
    if (editingId) {
      await stockApi.put(`/api/stock/xxx/${editingId}`, token, { field: value });
      toast.success('Berhasil diupdate');
    } else {
      await stockApi.post('/api/stock/xxx', token, body);
      toast.success('Berhasil dicatat');
    }
    setShowModal(false);
    setForm({ ...initialForm });
    load();
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Gagal');
  }
}
```

---

### POLA HANDLE 4 STATE DI UI (wajib ditiru persis)

```tsx
{loading ? (
  <TableSkeleton rows={8} cols={5} />
) : !data || data.length === 0 ? (
  <div className="card card-p" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
    Belum ada data
  </div>
) : (
  // render tabel/list yang sebenarnya
)}
```

Komponen loading skeleton:
- `<TableSkeleton rows={8} cols={5} />` — untuk tabel
- `<Skeleton width="120px" height="1.4rem" />` — untuk inline/text
- `<PageLoader />` — untuk full page

---

### FILE-FILE KRITIKAL (path dari root proyek)

| Path | Isi | Catatan |
|---|---|---|
| `src/routes/api.ts` | Semua REST endpoint (admin + stock) | ~2500 baris |
| `src/routes/schemas.ts` | Zod validation schemas | Semua schema ada di sini |
| `src/utils/transactionRecorder.ts` | recordSale, recordPembukuan, recordStockAdjustment | Ekspor fungsi2 ini |
| `src/utils/accountingEngine.ts` | Jurnal double-entry, COA query | insertJournal, getBalanceSheet, dll |
| `src/utils/stockManager.ts` | addProduct, executeSale, getProduct | CRUD produk |
| `src/utils/helpers.ts` | checkDemoTransactionLimit, formatRupiah, dll | |
| `src/utils/api-response.ts` | apiSuccess, apiError, apiSuccessPaginated | |
| `src/utils/errors.ts` | sanitizeError, AppError, badRequest, dll | |
| `src/types/errors.ts` | ErrorCode enum | |
| `src/types/api.ts` | Shared types BE↔FE | Single source of truth |
| `src/middleware/validate.ts` | validate() + validateQuery() middleware | |
| `src/middleware/auth.ts` | isAdmin, requireAdmin, stockAuth | |
| `src/handlers/message.ts` | WhatsApp message handler | |
| `src/config/state.ts` | addLog, getIO, state | |
| `src/config/cache.ts` | cacheGet, cacheSet, cacheInvalidate | |
| `src/config/constants.ts` | DAY_MS, cache TTL, dll | |
| `src/config/supabase.ts` | supabase client + pgPool | |
| `src/frontend/src/pages/stock/` | Semua halaman stock dashboard | Masing-masing file ~200-500 baris |
| `src/frontend/src/components/` | UI components (Modal, Toast, FilterBar, dll) | |
| `src/frontend/src/store/stockStore.ts` | Zustand store utama | |
| `src/frontend/src/services/api.ts` | api + stockApi factory | |
| `src/frontend/src/lib/utils.ts` | fmtRp, fmtDateTime, dll | |
| `tests/schemas.test.ts` | Test Zod schemas | |

---

### TYPE DEFINITION RULE

**Semua type API response WAJIB di `src/types/api.ts`**, bukan di file component.

- ✅ `src/types/api.ts` → `LabaRugiData`, `NeracaData`, `CashflowItem`, `TrialBalanceData`, dll
- ❌ `StockPembukuan.tsx` → definisi `TransItem`, `PembukuanData` — sudah dipindah ke shared types
- ❌ `StockReport.tsx` → definisi `ReportData` — sudah dipindah ke shared types
- ✅ `ApiResponse<T>` → generic wrapper untuk semua response

Kalau mau nambah type baru, tulis di `src/types/api.ts`, jangan di file component.

---

### DEMO RESTRICTION CONSISTENCY

Halaman yang WAJIB punya demo guard (tampilkan upgrade card kalau `user.status === 'demo'`):

- `StockLabaRugi.tsx` ✅ sudah
- `StockNeraca.tsx` ✅ sudah
- `StockArusKas.tsx` ❌ perlu ditambah
- `StockBukuBesar.tsx` ❌ perlu ditambah
- `StockTrialBalance.tsx` ❌ perlu ditambah
- `StockPembukuan.tsx` ❌ perlu ditambah
- `StockJurnal.tsx` ❌ perlu ditambah
- `StockReport.tsx` ❌ perlu ditambah
- `StockHistory.tsx` ❌ perlu ditambah

Halaman yang TIDAK perlu demo guard (fitur dasar/bantuan):
- `StockOverview.tsx` — hanya banner info, tidak di-lock
- `StockBantuan.tsx` — halaman bantuan
- `StockSettings.tsx` — setting

Pattern demo guard (copy dari `StockNeraca.tsx`):

```tsx
if (user?.status === 'demo') {
  return (
    <PageContainer>
      <PageHeader title="..." subtitle="..." />
      <div className="card card-p" style={{ textAlign: 'center', padding: '3rem' }}>
        <Lock size={32} style={{ marginBottom: '1rem' }} />
        <h3>Fitur Premium</h3>
        <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>
          Upgrade ke PRO untuk mengakses laporan ini.
        </p>
        <a href="/stock/settings" className="btn btn-primary">Lihat Harga</a>
      </div>
    </PageContainer>
  );
}
```

---

### COMMON UTILITIES

| Fungsi | File | Kegunaan |
|---|---|---|
| `fmtRp(value)` | `src/frontend/src/lib/utils.ts` | Format rupiah: `Rp 1.000.000` |
| `fmtDateTime(iso)` | `src/frontend/src/lib/utils.ts` | Format tanggal Indonesia |
| `sanitizeString(str, maxLen)` | `src/utils/helpers.ts` | Sanitize input backend |
| `sanitizeError(e)` | `src/utils/errors.ts` | Bersihin error message |
| `cacheInvalidate(userId)` | `src/config/cache.ts` | Hapus cache user |
| `addLog(level, msg)` | `src/config/state.ts` | Logging + broadcast via Socket.IO |
| `withTransaction(callback)` | `src/utils/db.ts` | pg Pool transaction wrapper |
| `toast.success(msg)` | `src/frontend/src/components/Toast` | Toast sukses |
| `toast.error(msg)` | `src/frontend/src/components/Toast` | Toast error |
| `stockApi.get<T>(url, token)` | `src/frontend/src/services/api.ts` | GET request |
| `stockApi.post<T>(url, token, body)` | `src/frontend/src/services/api.ts` | POST request |
| `stockApi.put<T>(url, token, body)` | `src/frontend/src/services/api.ts` | PUT request |
| `stockApi.del(url, token)` | `src/frontend/src/services/api.ts` | DELETE request |

---

### COMMON BUG UI YANG SERING TERJADI

1. **Loading state tidak ada** → halaman nampak kosong saat data belum termuat → tambah `if (loading) return <TableSkeleton ... />`
2. **Empty state tidak ada** → tabel nampak kosong tanpa pesan → tambah empty state
3. **Error tidak di-handle** → API call tanpa try/catch → bungkus dengan try/catch + `toast.error()`
4. **Akses response API tanpa unwrap `.data`** → semua endpoint return `{ success: true, data: T }`. Akses WAJIB `response.data.xxx`. `response.xxx` langsung pasti undefined.
5. **Form tidak reset** → modal masih isi data lama setelah submit → panggil `setShowModal(false)` + reset form di `finally`
6. **useCallback dependency kurang** → `load()` panggil ulang tidak sesuai ekspektasi → pastikan dependency array lengkap
7. **`parseFloat` tanpa default** → `parseFloat('')` = NaN → selalu kasih `|| 0`

---

### LANGKAH VERIFIKASI (WAJIB dijalankan setelah semua perubahan)

```bash
# 1. TypeScript strict check — harus zero error
npx tsc --noEmit

# 2. Test — semua harus pass
npx vitest run

# 3. Pastikan tidak ada:
#    - any
#    - as casting
#    - @ts-ignore
#    - @ts-expect-error
```

Jika ada error TypeScript atau test fail: **jangan lanjut. Fix dulu sampai zero error.**

---

### FORMAT PERINTAH TASK

Setelah template di atas, tulis task dengan format:

---
**Task:** [judul singkat, 3-5 kata]
**File target:** `path/ke/file.ts`
**Deskripsi:** [penjelasan apa yang harus diubah dan kenapa]
**Langkah:**
1. Baca file `path/ke/file.ts` — baca semua
2. Di line N, ubah `oldCode` menjadi `newCode`
3. Di line M, tambahkan kode berikut: `...`
4. Verifikasi: `npx tsc --noEmit`

**JANGAN ubah file lain selain yang disebut di atas.**
---

> **Catatan penting:** Karena model default tidak kompeten, semakin spesifik perintah semakin baik.
> Sebutkan line number, sebutkan exact code lama, sebutkan exact code baru. Jangan bilang
> "tambahin error handling" — bilang "bungkus kode di line 45-50 dengan try/catch dan
> di catch-nya panggil toast.error(err.message)".
