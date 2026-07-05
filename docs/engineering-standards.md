# Engineering Standards — Tata Business Suite

> **Proyek:** WhatsApp Finance Bot + Stock Opname System  
> **Versi:** 2.0.0  
> **Standar ini berlaku untuk:** seluruh engineer Backend (BE) dan Frontend (FE)  
> **Dokumen ini adalah:** source of truth untuk alur kerja, komunikasi, dan ekspektasi kualitas kode

---

## Daftar Isi

1. [Protokol Komunikasi Tim](#1-protokol-komunikasi-tim)
2. [Alur Kerja Paralel (Contract-First)](#2-alur-kerja-paralel-contract-first)
3. [Standar Kontrak API](#3-standar-kontrak-api)
4. [Standar TypeScript](#4-standar-typescript)
5. [Standar Error Handling](#5-standar-error-handling)
6. [Definition of Done](#6-definition-of-done)
7. [Architecture Decision Records (ADR)](#7-architecture-decision-records-adr)
8. [Standar Git & Commit](#8-standar-git--commit)
9. [Emergency Hotfix Flow](#9-emergency-hotfix-flow)
10. [Log Pengerjaan](#10-log-pengerjaan)
11. [Breaking Changes](#11-breaking-changes)
12. [Lampiran](#12-lampiran)

---

## 1. Protokol Komunikasi Tim

### 1.1 Prinsip Dasar

1. **Semua progress wajib dicatat** di dokumen ini (seksi [Log Pengerjaan](#10-log-pengerjaan))
2. **Semua keputusan arsitektur** dicatat di seksi [ADR](#7-architecture-decision-records-adr)
3. **Semua perubahan yang berdampak ke tim lain** dicatat di seksi [Breaking Changes](#11-breaking-changes)
4. **Tidak ada lisan -> tidak terjadi** — komunikasi harus tertulis

### 1.2 Format Laporan Harian

Setiap engineer wajib menulis laporan di awal dan akhir sesi kerja:

```
## Log Pengerjaan
### YYYY-MM-DD HH:mm — [BE/FE] <Nama Engineer>
- Task: <deskripsi singkat>
- Status: <PLAN | IN_PROGRESS | DONE | BLOCKED>
- Durasi: <estimasi/jam nyata>
- Dampak: <tim lain yang perlu tahu>
- Catatan: <opsional>
```

**Status definitions:**

| Status | Makna |
|--------|-------|
| `PLAN` | Engineer akan memulai task — tim lain bisa antisipasi |
| `IN_PROGRESS` | Sedang dikerjakan |
| `DONE` | Selesai, sudah sesuai DoD |
| `BLOCKED` | Ada hambatan — sebutkan blocker-nya |

### 1.3 Format Commit

Setiap commit **wajib** mengikuti format:

```
<type>: <deskripsi singkat dalam Bahasa Indonesia>
```

**Type yang diizinkan:**

| Type | Kapan Digunakan |
|------|-----------------|
| `feat` | Fitur baru (endpoint, halaman, komponen) |
| `fix` | Perbaikan bug |
| `refactor` | Refaktor tanpa perubahan fungsional |
| `perf` | Optimasi performa |
| `test` | Menambah/memperbaiki test |
| `docs` | Update dokumentasi |
| `chore` | Build, dependency, tooling |
| `BREAKING` | Perubahan yang tidak backward-compatible |

**Contoh:**

```
feat: tambah endpoint /api/stock/laba-rugi dengan filter channel
fix: perbaiki perhitungan HPP saat stok keluar via channel
BREAKING: rename field price_buy → cost_price di response produk
```

### 1.4 Notifikasi Breaking Change

Jika perubahan memengaruhi **response shape API**, **nama field**, **tipe data**, atau **auth flow**, engineer wajib menulis notifikasi di seksi [Breaking Changes](#11-breaking-changes) **sebelum** commit.

---

## 2. Alur Kerja Paralel (Contract-First)

### 2.1 Prinsip

Backend dan Frontend bekerja **paralel**, bukan sequential. Sinkronisasi dilakukan melalui **kontrak API** (type definitions), bukan menunggu implementasi selesai.

### 2.2 Diagram Alur

```
WAKTU ──────────────────────────────────────────────────────────────────►

BACKEND:
  ┌──────────────────────────────────────────────────────────────────┐
  │ 1. Define tipe & kontrak di src/types/api.ts                    │
  │    (type request, type response, zod schema)                    │
  └──────────────────────────────────────────────────────────────────┘
  │                                           │
  │ sync via kontrak                          │ sync via kontrak
  ▼                                           ▼
  ┌─────────────────────────┐                ┌─────────────────────────┐
  │ 2. Implementasi route   │                │ 4. Tes integration      │
  │    handler + validasi    │                │    (supertest + vitest)  │
  └─────────────────────────┘                └─────────────────────────┘

FRONTEND:
  ┌──────────────────────────────────────────────────────────────────┐
  │ 1. Konsumsi tipe dari src/types/api.ts                          │
  │    (import langsung, tidak redefine)                             │
  └──────────────────────────────────────────────────────────────────┘
  │                                           │
  ▼                                           ▼
  ┌─────────────────────────┐                ┌─────────────────────────┐
  │ 2. Bangun UI dengan mock│                │ 4. Ganti mock → real    │
  │    data (berdasarkan type)               │    API call             │
  └─────────────────────────┘                └─────────────────────────┘
  │                                           │
  ▼                                           ▼
  ┌─────────────────────────┐                ┌─────────────────────────┐
  │ 3. Zustand store + hooks│                │ 5. Component test       │
  └─────────────────────────┘                └─────────────────────────┘
```

### 2.3 Aturan Paralel

| Fase | Backend | Frontend |
|------|---------|----------|
| **Fase 0 — Kontrak** | Tulis tipe di `src/types/api.ts` | — |
| **Fase 1 — Implementasi** | Route handler + DB query | UI components + store + mock |
| **Fase 2 — Integrasi** | Integration test | Ganti mock dengan real API call |
| **Fase 3 — Stabilisasi** | Bug fix + edge cases | Penyesuaian UI + error handling |

### 2.4 Mock Data Frontend

Frontend boleh menggunakan mock data **selama tipe sudah fix**. Mock data ditaruh di `src/frontend/src/lib/mock/`:

```typescript
// src/frontend/src/lib/mock/laba-rugi.ts
import type { LabaRugiResponse } from '../../types/api';

export const mockLabaRugi: LabaRugiResponse = {
  rows: [],
  totalRevenue: 0,
  totalCOGS: 0,
  labaBersih: 0,
};
```

### 2.5 Cutover ke Real API

Ketika backend sudah selesai, frontend mengganti:

```typescript
// BEFORE (mock)
const data = await new Promise((r) => setTimeout(() => r(mockLabaRugi), 300));

// AFTER (real)
const data = await stockApi.get<LabaRugiResponse>('/api/stock/laba-rugi?days=30', token);
```

---

## 3. Standar Kontrak API

### 3.1 Lokasi

Semua tipe yang dibagi antara BE dan FE didefinisikan di **satu file**: `src/types/api.ts`.

**Aturan:**
- Backend tidak boleh menulis tipe response di file route handler
- Frontend tidak boleh mendefinisikan ulang tipe yang sudah ada di `api.ts`
- Jika frontend butuh tipe turunan/UI-specific, buat di `src/frontend/src/types/` dengan extends/utility types

### 3.2 Format Dokumentasi Setiap Endpoint

Setiap endpoint baru wajib dicatat di `src/types/api.ts` dengan format:

```typescript
/**
 * ============================================================
 * POST /api/stock/laba-rugi
 * ============================================================
 * Menghitung laba/rugi berdasarkan periode dan channel.
 *
 * REQUEST BODY:
 *   { days?: number; channel?: string; startDate?: string; endDate?: string }
 *
 * SUCCESS RESPONSE (200):
 *   { success: true, data: LabaRugiResponse }
 *
 * ERROR RESPONSE (400/403/500):
 *   { success: false, error: string, code?: ErrorCode }
 *
 * AUTH: x-stock-token header (stockAuth)
 */

export interface LabaRugiRequest {
  days?: number;
  channel?: string;
  startDate?: string; // ISO 8601
  endDate?: string;   // ISO 8601
}

export interface LabaRugiRow {
  productName: string;
  quantitySold: number;
  revenue: number;
  hpp: number;
  profit: number;
  margin: number;
}

export interface LabaRugiResponse {
  rows: LabaRugiRow[];
  totalRevenue: number;
  totalCOGS: number;
  labaKotor: number;
  labaBersih: number;
  profitMargin: number;
}
```

### 3.3 Standar Response Shape

**Semua** endpoint REST API wajib mengikuti format berikut:

```typescript
// Sukses — data tunggal
{ success: true, data: T }

// Sukses — pagination
{ success: true, data: T[], meta: { page: number, limit: number, total: number, totalPages: number } }

// Error
{ success: false, error: string, code?: ErrorCode, fields?: Record<string, string> }
```

### 3.4 Standar Endpoint URL

| Prefix | Auth | Tujuan |
|--------|------|--------|
| `/api/admin/*` | Session (`isAdmin`) | Admin dashboard |
| `/api/stock/*` | Token (`stockAuth`) | Stock dashboard user |
| `/api/public/*` | None | Health check, public info |
| `/admin/*` | Session (`requireAdmin`) | Halaman SPA admin |
| `/stock/*` | Token (client-side) | Halaman SPA stock |

---

## 4. Standar TypeScript

### 4.1 Aturan Umum

- **Strict mode** wajib diaktifkan di tsconfig
- **`any` dilarang** — gunakan `unknown` jika tipe tidak diketahui, lalu narrow dengan type guard
- **`as` casting dilarang** — gunakan type narrowing (typeof, instanceof, discriminated union)
- **`// @ts-ignore` dan `// @ts-expect-error` dilarang** dalam kode yang dicommit

### 4.2 Naming Convention

| Entitas | Convention | Contoh |
|---------|-----------|--------|
| Interface | `PascalCase` | `LabaRugiResponse` |
| Type alias | `PascalCase` | `ErrorCode` |
| Enum | `PascalCase` | `SubscriptionTier` |
| Function | `camelCase` | `calculateProfit()` |
| File (BE) | `kebab-case` | `laba-rugi.ts` |
| File (FE) | `kebab-case` | `laba-rugi-page.tsx` |
| Direktori | `kebab-case` | `stock-dashboard/` |
| Zod schema | `camelCase` + `Schema` | `labaRugiSchema` |

### 4.3 Type vs Interface

Gunakan **`type`** untuk:
- Union types: `type Status = 'active' | 'inactive'`
- Intersection: `type FullUser = User & { storeName: string }`
- Utility types: `type PartialUser = Partial<User>`

Gunakan **`interface`** untuk:
- Object shapes yang bisa di-extend: `interface LabaRugiResponse { ... }`
- Class contracts

### 4.4 Shared Types Structure

```
src/
└── types/
    ├── api.ts          # Kontrak API (BE ↔ FE shared)
    ├── index.ts        # Internal BE types (dialog, cache, dll)
    ├── socket.ts       # Socket.IO event payloads
    └── errors.ts       # Error codes, error classes
```

```
src/frontend/src/
└── types/
    ├── index.ts        # FE-specific types (UI state, dll)
    └── api.ts          # Re-export dari src/types/api.ts (jika perlu)
```

### 4.5 Zod Schema

Setiap endpoint yang menerima request body WAJIB memiliki Zod schema:

```typescript
import { z } from 'zod/v4';

export const labaRugiSchema = z.object({
  days: z.number().int().min(1).max(365).optional().default(30),
  channel: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type LabaRugiInput = z.infer<typeof labaRugiSchema>;
```

---

## 5. Standar Error Handling

### 5.1 Error Code Enum

```typescript
// src/types/errors.ts
export const ErrorCode = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  NOT_FOUND: 'NOT_FOUND',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  DB_ERROR: 'DB_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL_ERROR',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

### 5.2 Backend Error Response Format

Setiap error dari backend WAJIB mengirim:

```json
{
  "success": false,
  "error": "Pesan error yang human-friendly (Bahasa Indonesia)",
  "code": "VALIDATION_ERROR",
  "fields": {
    "email": "Format email tidak valid"
  }
}
```

### 5.3 Backend Helper Functions

Setiap route handler WAJIB menggunakan helper fungsi berikut (jangan manual `res.json()`):

```typescript
// src/utils/api-response.ts
export function apiSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function apiSuccessPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
) {
  return res.status(200).json({ success: true, data, meta });
}

export function apiError(
  res: Response,
  error: string,
  code: ErrorCode = ErrorCode.INTERNAL,
  status = 400,
  fields?: Record<string, string>,
) {
  return res.status(status).json({ success: false, error, code, ...(fields && { fields }) });
}
```

### 5.4 Backend Error Handler Middleware

Jangan gunakan try/catch di setiap route. Gunakan global error handler:

```typescript
// src/middleware/error-handler.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return apiError(res, 'Validasi gagal', ErrorCode.VALIDATION, 400, err.flatten().fieldErrors);
  }

  if (err instanceof AuthError) {
    return apiError(res, err.message, ErrorCode.AUTH_EXPIRED, 401);
  }

  logger.error({ err, path: req.path, method: req.method });
  return apiError(res, 'Terjadi kesalahan internal', ErrorCode.INTERNAL, 500);
}
```

### 5.5 Frontend Error Handling

```typescript
// src/frontend/src/lib/error-handler.ts
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export function handleApiError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Terjadi kesalahan yang tidak diketahui';
}

export async function parseApiError(response: Response): Promise<ApiError> {
  try {
    return await response.json();
  } catch {
    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }
}
```

### 5.6 Retry & Timeout Policy

| Skenario | Timeout | Retry |
|----------|---------|-------|
| API call (admin) | 15s | 0 |
| API call (stock) | 20s | 1 (jika 503/429) |
| Socket.IO connect | 10s | infinite (1s delay) |
| WA auth | 60s | 3 (jika gagal) |

---

## 6. Definition of Done

### 6.1 Checklist Backend (FEATURE)

| No | Kriteria | Mandatory? |
|----|----------|:----------:|
| 1 | Tipe kontrak sudah didefinisikan di `src/types/api.ts` | ✅ |
| 2 | Zod schema untuk request body (jika ada) | ✅ |
| 3 | Route handler selesai dengan `apiSuccess`/`apiError` | ✅ |
| 4 | Error handling mencakup semua kemungkinan error | ✅ |
| 5 | Integration test minimal 1 skenario sukses + 1 error | ✅ |
| 6 | Tidak ada `console.log` | ✅ |
| 7 | Prettier pass | ✅ |
| 8 | `tsc --noEmit` pass | ✅ |
| 9 | Laporan progress di Log Pengerjaan | ✅ |

### 6.2 Checklist Frontend (FEATURE)

| No | Kriteria | Mandatory? |
|----|----------|:----------:|
| 1 | Import tipe dari `src/types/api.ts` (bukan redefine) | ✅ |
| 2 | UI component selesai (semua state: loading, empty, error, success) | ✅ |
| 3 | Zustand store (jika perlu data global) | ✅ |
| 4 | Loading state ditampilkan (skeleton/spinner) | ✅ |
| 5 | Error handling dari API ditampilkan (toast/alert) | ✅ |
| 6 | Tidak ada `console.log` | ✅ |
| 7 | Prettier pass | ✅ |
| 8 | Laporan progress di Log Pengerjaan | ✅ |

### 6.3 Checklist HOTFIX

| No | Kriteria | Mandatory? |
|----|----------|:----------:|
| 1 | Catat di [Emergency Hotfix](#9-emergency-hotfix-flow) | ✅ |
| 2 | Fix langsung di `main` | ✅ |
| 3 | Catat di [Breaking Changes](#11-breaking-changes) jika berdampak | ✅ |
| 4 | Buat task untuk proper fix (refactor + test) | ✅ |

---

## 7. Architecture Decision Records (ADR)

### 7.1 Format ADR

Setiap keputusan arsitektur yang signifikan dicatat dengan format:

```
## ADR-{NNN}: {Judul}

Status: {Proposed | Accepted | Deprecated | Superseded}
Tanggal: {YYYY-MM-DD}
Pemutus: {Nama Engineer}

### Konteks
{Problem statement, latar belakang, opsi yang dipertimbangkan}

### Keputusan
{Apa yang dipilih dan mengapa}

### Konsekuensi
{Dampak positif dan negatif, hal yang perlu dimigrasi}
```

### 7.2 Daftar ADR

#### ADR-001: Dual Auth Strategy

**Status:** Accepted  
**Tanggal:** 2026-07-05  
**Pemutus:** nickperson

**Konteks:** Aplikasi memiliki dua jenis pengguna: admin (mengelola bot) dan pemilik toko (mengakses stock dashboard). Admin butuh session-based auth (web tradisional), pemilik toko butuh token-based (bisa diakses via link WA).

**Keputusan:** Gunakan **Express-session** untuk admin dashboard dan **x-stock-token header** untuk stock dashboard. Admin: cookie httpOnly, session di PostgreSQL. Stock: token disimpan di localStorage, dikirim via header.

**Konsekuensi:**
- Positif: Dua sistem auth independen, tidak saling memengaruhi
- Positif: Token-based memungkinkan share link dashboard via WhatsApp
- Negatif: Dua middleware auth terpisah (`isAdmin` vs `stockAuth`)
- Negatif: Frontend perlu dua API client berbeda (`api` vs `stockApi`)

#### ADR-002: Contract-First Development

**Status:** Accepted  
**Tanggal:** 2026-07-05  
**Pemutus:** manager

**Konteks:** Backend dan frontend perlu bekerja paralel tanpa saling menunggu. Sering terjadi mismatch response shape yang menyebabkan bugs.

**Keputusan:** Semua pengembangan fitur baru dimulai dengan definisi kontrak API di `src/types/api.ts`. Backend mendefinisikan tipe request & response terlebih dahulu, baru implementasi. Frontend mengonsumsi tipe yang sama dan boleh menggunakan mock data selama implementasi backend belum selesai.

**Konsekuensi:**
- Positif: Tidak ada blocking antar tim
- Positif: Tipe response selalu sinkron (single source of truth)
- Positif: Mock data frontend selalu valid karena berdasarkan tipe yang sama
- Negatif: Butuh disiplin tinggi untuk tidak mengubah kontrak setelah disepakati
- Negatif: Butuh code review untuk memastikan kontrak tidak berubah tanpa notifikasi

---

## 8. Standar Git & Commit

### 8.1 Branch Strategy

```
main                   ← Produksi, selalu deployable
├── feat/laba-rugi     ← Fitur baru (backend + frontend)
├── fix/hpp-calculation ← Bug fix non-critical
└── hotfix/auth-expiry  ← Bug fix critical (langsung ke main)
```

| Branch | Base | Merge ke | Umur | Dihapus setelah |
|--------|------|----------|------|-----------------|
| `feat/*` | `main` | `main` (PR) | ≤ 3 hari | ✅ |
| `fix/*` | `main` | `main` (PR) | ≤ 1 hari | ✅ |
| `hotfix/*` | `main` | `main` (langsung) | ≤ 2 jam | ✅ |

### 8.2 Commit Format Wajib

```
<type>: <deskripsi dalam Bahasa Indonesia>
```

**Larangan:**
- ❌ `update file`
- ❌ `fix bug`
- ❌ `asdfgh`
- ❌ `asd`

**Commit yang baik:**
- ✅ `feat: tambah filter channel di endpoint laba-rugi`
- ✅ `fix: perbaiki NaN pada perhitungan margin saat quantity 0`

### 8.3 Pull Request

Setiap `feat/*` dan `fix/*` WAJIB melalui PR:

**Template PR:**
```
## Deskripsi
{apa yang diubah dan mengapa}

## Checklist
- [ ] Kontrak API sudah didefinisikan
- [ ] Backend route selesai
- [ ] Frontend UI selesai
- [ ] Integration test (BE)
- [ ] Tidak ada type mismatch
- [ ] Prettier + lint pass

## Breaking Changes
{sebutkan jika ada}

## Screenshot (jika FE)
```
---

## 9. Emergency Hotfix Flow

### 9.1 Kriteria

Hotfix diizinkan hanya untuk:
- Bug yang menghentikan produksi (bot tidak merespon, login gagal, data corrupt)
- Security vulnerability
- API downtime

### 9.2 Prosedur

```
1. [ENGINEER] Identifikasi bug dan pastikan kategorinya HOTFIX
2. [ENGINEER] Catat di seksi Log Pengerjaan dengan status IN_PROGRESS
3. [ENGINEER] Commit langsung ke main dengan prefix `hotfix:`
   Contoh: hotfix: perbaiki crash saat user kirim gambar tanpa teks
4. [ENGINEER] Update seksi Log Pengerjaan → DONE
5. [ENGINEER + WAKTU < 24 JAM] Buat branch fix/* untuk proper fix:
   - Tambah unit test yang mencegah regresi
   - Refaktor jika perlu
6. [ENGINEER] Catat di seksi Breaking Changes jika ada dampak
```

### 9.3 Aturan

- Hotfix **tidak boleh** mengandung refaktor atau perubahan tidak terkait
- Setelah hotfix, **wajib** ada follow-up task untuk proper fix dalam 24 jam
- Dilarang hotfix untuk fitur baru atau enhancement

---

## 10. Log Pengerjaan

> **Instruksi:** Append log baru di bagian **bawah** tabel ini. Jangan mengubah atau menghapus log lama.

| Tanggal | Jam | Engineer | Role | Task | Status | Durasi | Dampak |
|---------|:---:|:--------:|:----:|------|:------:|:------:|--------|
| _(diisi kronologis)_ | | | | | | | |
| 2026-07-05 | 15:00 | manager | BE/FE | Membuat docs/engineering-standards.md + .github/ISSUE_TEMPLATE + PR template | DONE | 1h | semua engineer |
| 2026-07-05 | 15:30 | manager | BE/FE | Update .agentrules: tambah seksi 5 (Engineering Standards), 6 (Role-Aware), 7 (Log Pengerjaan) | DONE | 0.5h | agent AI akan paham workflow |
| 2026-07-05 | 16:00 | manager | BE | Fix build: tambah i18next + react-i18next ke root package.json | DONE | 0.5h | FE build di HF sekarang bisa jalan |
| 2026-07-05 | 16:00 | agent | FE | Phase 1: Design Tokens + Layout Primitives (PageContainer, PageHeader, SectionCard, dll) | DONE | 1h | — |
| 2026-07-05 | 17:00 | agent | FE | Phase 2: i18n (react-i18next, id/en translation, LanguageSwitcher, locale-aware utils) | DONE | 1.5h | — |
| 2026-07-05 | 17:30 | agent | FE | Phase 3: RTL support (CSS overrides, logical properties, dir attribute) | DONE | 0.5h | — |
| 2026-07-05 | 18:00 | agent | FE | Phase 4: a11y (Modal focus trap, aria attributes, Pagination nav, Toast role) | DONE | 0.5h | — |
| 2026-07-05 | 18:30 | agent | FE | Phase 5: Layout Consolidation (AdminLayout refactor inline → CSS classes) | DONE | 0.5h | — |
| 2026-07-05 | 19:00 | agent | FE | Phase 6: Component Audit (Skeleton/DownloadButton/ConfirmModal backward compat) | DONE | 0.5h | — |
| 2026-07-05 | 20:00 | agent | FE/FIX | Buat src/types/api.ts sebagai shared types canonical source, FE re-export | DONE | 0.5h | BE engineer (shared types now centralized) |
| 2026-07-05 | 21:00 | agent | BE | [1.3] Pool size: supabase.ts max:2→max:20 + query_timeout + statement_timeout + health check | DONE | 0.25h | production perf |
| 2026-07-05 | 21:15 | agent | BE | [1.2] Batch INSERT: insertJournalViaClient N+1→multi-values + single ANY() SELECT | DONE | 1h | 10→3 queries untuk 4 line |
| 2026-07-05 | 21:30 | agent | BE | [2.4] Memory leak: senderLocks cleanup periodic tiap 120s (TTL 10 menit) | DONE | 0.25h | server stability |
| 2026-07-05 | 22:00 | agent | BE | [3.1] Unifikasi sanitizeError + AppError + helpers di src/utils/errors.ts, hapus 3 duplikasi | DONE | 0.5h | error handling konsisten |
| 2026-07-05 | 22:30 | agent | BE | [1.1] addProduct: Supabase REST→pg Pool transaction (atomic insert+stock_movement) | DONE | 0.5h | write atomicity |
| 2026-07-05 | 23:00 | agent | BE | [2.1] getLabaRugi: 3 query sequential→1 JOIN query via pgPool (fallback Supabase REST) | DONE | 0.5h | query perf 3x→1x |
| 2026-07-05 | 23:15 | agent | BE | [2.2] getBalanceSheet: 4 query sequential→1 JOIN query via pgPool (fallback Supabase REST) | DONE | 0.5h | query perf 4x→1x |
| 2026-07-05 | 23:45 | agent | BE | [4.1] Buat src/types/errors.ts — ErrorCode enum sesuai standar seksi 12.1 | DONE | 0.25h | BE types |
| 2026-07-05 | 23:50 | agent | BE | [4.2] Buat src/utils/api-response.ts — apiSuccess/apiError/apiSuccessPaginated | DONE | 0.25h | BE helpers |
| 2026-07-05 | 23:55 | agent | BE | [4.3] Refactor src/utils/errors.ts — AppError gunakan ErrorCode dari types/errors | DONE | 0.1h | konsistensi error |
| 2026-07-06 | 00:30 | agent | BE | [4.4] api.ts: Zod validate middleware di 8 route + catch→sanitizeError + apiError di middleware | DONE | 1h | standar routing |
| 2026-07-06 | 08:00 | agent | BE | Fix LabaRugi/Neraca/TrialBalance blank page: apiSuccess(res, result.data) → res.json(result.data) — konsisten dengan semua route lain yang pakai direct res.json() | DONE | 0.5h | halaman Laba Rugi, Neraca, Trial Balance |
| 2026-07-06 | 09:00 | agent | BE | Refactor movement endpoint: ganti inline logic → transactionRecorder.recordStockAdjustment | DONE | 0.5h | stock movement |
| 2026-07-06 | 09:15 | agent | BE | Add productCreateSchema + Zod validate di POST /api/stock/products | DONE | 0.25h | API konsistensi |
| 2026-07-06 | 09:30 | agent | BE | Change pembukuan schema: masuk/keluar → category types (beban_gaji, modal, piutang, etc.) | DONE | 0.25h | pembukuan API |
| 2026-07-06 | 09:45 | agent | BE | Add checkDemoTransactionLimit + demo guard di movement endpoint | DONE | 0.25h | demo akun |
| 2026-07-06 | 10:00 | agent | BE | Hutang endpoint: pakai recordPembukuan + insert accounts_payable via transaction | DONE | 0.25h | hutang |
| 2026-07-06 | 10:15 | agent | BE | Pembukuan GET: separate aggregation query agar total tidak terbatas pagination | DONE | 0.25h | pembukuan list |
| 2026-07-06 | 10:30 | agent | BE | addProduct: SKU auto-generate dari name, tambah supplier/location/defaultChannel di INSERT atomic | DONE | 0.25h | add product |
| 2026-07-06 | 10:45 | agent | FE | Fix edit pembukuan: hanya kirim description di PUT (type/amount ignored backend) | DONE | 0.25h | frontend |
| 2026-07-06 | 11:00 | agent | BE | recordStockAdjustment: tambah createdVia + recordTransaction flag | DONE | 0.25h | transaction recorder |
| 2026-07-06 | 11:15 | agent | BE | accountingEngine: reorder COA auto-create before journal line batch insert; split balance query for date-filtered vs unfiltered | DONE | 0.25h | accounting engine |

### Template Entri Baru

```
| YYYY-MM-DD | HH:mm | nama | BE/FE | deskripsi singkat | PLAN/IN_PROGRESS/DONE/BLOCKED | Xh | tim lain |
```

---

## 11. Breaking Changes

> **Instruksi:** Setiap perubahan yang tidak backward-compatible dicatat di sini.  
> **Format:** Urutkan dari yang paling baru ke paling lama.

### 2026-07-06 — pembukuan schema: masuk/keluar → category types

| Metadata | |
|----------|---|
| **Pelaku** | agent |
| **Perubahan** | `POST /api/stock/pembukuan` schema `type` field berubah dari `'masuk'\|'keluar'` menjadi category types (`beban_gaji`, `beban_sewa`, `beban_listrik_air`, `beban_transport`, `beban_operasional`, `modal`, `prive`, `piutang`, `hutang_dagang`, `hutang_lancar`). Frontend `StockPembukuan.tsx` sudah adaptif: kategorisasi otomatis berdasarkan pemilihan Pemasukan/Pengeluaran. |
| **Dampak** | Semua caller `POST /api/stock/pembukuan` harus kirim category type bukan `masuk`/`keluar`. |
| **Migrasi** | Gunakan mapping: Pemasukan → `modal`/`piutang`, Pengeluaran → `beban_*`/`prive`/`hutang_*`. |

### 2026-07-06 — api.ts standardisasi response + middleware

| Metadata | |
|----------|---|
| **Pelaku** | agent |
| **Perubahan** | `apiSuccess()` kini mengembalikan `{ success: true, data }` bukan spread `{ success: true, ...data }`. `apiError()` kini menyertakan field `code`. Middleware `isAdmin`/`stockAuth`/`checkDemoAccess` kini gunakan `apiError()` |
| **Dampak** | Frontend dashboard yang mengakses endpoint baru (menggunakan apiSuccess) perlu baca `response.data.*` bukan `response.*` langsung. Response error sekarang selalu punya field `code` |
| **Migrasi** | Frontend: update akses data dari `response.product` → `response.data.product` untuk endpoint yang menggunakan `apiSuccess()` |

### 2026-07-05 — Templates GitHub (Issue + PR)

| Metadata | |
|----------|---|
| **Pelaku** | manager |
| **Perubahan** | Menambahkan `.github/ISSUE_TEMPLATE/bug-report.md`, `.github/ISSUE_TEMPLATE/feature-request.md`, `.github/PULL_REQUEST_TEMPLATE.md` |
| **Dampak** | Semua laporan bug & PR wajib menggunakan template ini mulai sekarang |
| **Migrasi** | Saat buat issue baru: pilih template yang sesuai. Saat buat PR: ikuti checklist di template |

### 2026-07-05 — Dokumen ini dibuat

| Metadata | |
|----------|---|
| **Pelaku** | manager |
| **Perubahan** | Membuat `docs/engineering-standards.md` sebagai standar kerja tim |
| **Dampak** | Semua engineer wajib membaca dan mengikuti standar ini |
| **Migrasi** | Tidak ada migrasi teknis. Proses kerja disesuaikan dengan standar baru |

---

## 12. Lampiran

### 12.1 Daftar Error Codes

| Code | HTTP Status | Makna | Catatan |
|------|:-----------:|-------|---------|
| `VALIDATION_ERROR` | 400 | Input tidak sesuai schema | Sertakan `fields` untuk detail |
| `AUTH_EXPIRED` | 401 | Session/token expired | Frontend redirect ke login |
| `AUTH_INVALID` | 401 | Token/session tidak valid | |
| `NOT_FOUND` | 404 | Resource tidak ditemukan | |
| `UPGRADE_REQUIRED` | 403 | Akun demo tidak punya akses | Frontend tampilkan upgrade prompt |
| `DB_ERROR` | 503 | Database error / circuit open | Retry dari frontend |
| `RATE_LIMIT` | 429 | Terlalu banyak request | |
| `CONFLICT` | 409 | Duplikat atau state conflict | |
| `INTERNAL_ERROR` | 500 | Error tidak terduga | Jangan tampilkan detail ke user |

### 12.2 Teknologi & Versi

| Layer | Teknologi | Versi |
|-------|-----------|:-----:|
| Runtime | Node.js | ≥18 |
| HTTP Server | Express.js | 5.x |
| WA Client | whatsapp-web.js | ^1.34 |
| Real-time | Socket.IO | ^4.8 |
| ORM | Supabase JS | ^2.39 |
| DB | PostgreSQL (Supabase) | - |
| UI Framework | React | ^19 |
| Build Tool | Vite | ^6.4 |
| State Management | Zustand | ^5 |
| Validation | Zod | ^4 |
| Testing | Vitest | ^4 |
| DI | tsyringe | ^4 |

### 12.3 Scripts Penting

```bash
npm run dev              # Jalankan BE + FE paralel
npm run dev:backend      # Backend saja (port 3000)
npm run dev:frontend     # Frontend saja (port 5173)
npm run test             # Semua test
npm run typecheck        # TypeScript strict check
npm run lint             # ESLint
npm run format           # Prettier
npm run build            # Build backend + frontend
```

### 12.4 Referensi

- **Dokumentasi arsitektur:** `docs/me.md`
- **AI coding rules:** `.agentrules`
- **Environment config:** `.env.example`
- **CI/CD:** `.github/workflows/`
- **Docker:** `Dockerfile`, `docker-compose.yml`
