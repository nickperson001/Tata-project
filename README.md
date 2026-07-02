---
title: Tata Business Suite
emoji: 📦
colorFrom: green
colorTo: blue
sdk: docker
app_file: app.js
pinned: false
---

# Tata Business Suite v2.0.0

Sistem otomasi manajemen stok dan integrasi WhatsApp bot berbasis AI untuk UKM Indonesia.

## Fitur

- **WhatsApp Bot** — Catat transaksi masuk/keluar, cek stok, laporan harian via chat
- **AI Intent Classification** — NLP untuk memahami pesan natural (OpenRouter multi-model)
- **OCR Struk** — Scan foto struk belanja via Google Cloud Vision
- **Voice Note** — Transkripsi audio via Whisper (HuggingFace)
- **Manajemen Stok** — Produk, BOM/packaging, opname, alert minimum stock
- **Double-Entry Accounting** — Jurnal, neraca, laba-rugi, trial balance
- **Invoice PDF** — Kirim tagihan profesional dengan PDF
- **Web Dashboard** — 9 halaman: overview, financial, produk, movement, opname, report, history, piutang, pembukuan
- **Multi-Level Subscription** — Demo (5 transaksi/hari), PRO (30 hari), UNLIMITED (seumur hidup)

## Tech Stack

- **Runtime:** Node.js 20+, Express 5
- **Database:** PostgreSQL via Supabase
- **AI:** OpenRouter (Qwen, Nemotron, Llama)
- **WA:** whatsapp-web.js
- **Session:** express-session + pgSession
- **Realtime:** Socket.IO

## Setup

1. Clone & install:
```bash
npm install
```

2. Copy `.env.example` ke `.env` dan isi semua variabel:
```bash
cp .env.example .env
```

3. Jalankan migrasi database dari folder `migrations/` di Supabase SQL Editor

4. Start:
```bash
npm start        # Production
npm run dev      # Development (nodemon)
```

## Environment Variables

| Variable | Wajib | Keterangan |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL project Supabase |
| `SUPABASE_KEY` | ✅ | Service role key |
| `DATABASE_URL` | ✅ | Connection string PostgreSQL |
| `SESSION_SECRET` | ✅ | Minimal 32 karakter random |
| `ADMIN_USERNAME` | ✅ | Username dashboard admin |
| `ADMIN_PASSWORD` | ✅ | Password dashboard admin |
| `OPENROUTER_API_KEY` | ✅ | API key untuk AI NLP |
| `GOOGLE_APPLICATION_CREDENTIALS` | ⬜ | Path file JSON Google Vision (OCR) |
| `HF_TOKEN` | ⬜ | HuggingFace token (voice transcription) |
| `PAYMENT_BANK` | ⬜ | Nama bank untuk info pembayaran |
| `PAYMENT_ACCOUNT` | ⬜ | No rekening untuk info pembayaran |
| `PAYMENT_NAME` | ⬜ | Nama pemilik rekening |

## Scripts

| Script | Keterangan |
|---|---|
| `npm start` | Jalankan production |
| `npm run dev` | Jalankan development (nodemon) |
| `npm test` | Jalankan unit test |
| `npm run test:e2e` | Jalankan E2E dashboard test |

## Architecture

```
index.js → src/app.js (Express + Socket.IO)
  ├── routes/
  │   ├── api.js        — REST endpoints
  │   ├── auth.js       — Login/logout
  │   └── health.js     — Health check
  ├── handlers/
  │   ├── message.js    — WA message handler (orchestrator)
  │   ├── stock-handler.js
  │   ├── invoice-handler.js
  │   └── onboarding.js
  ├── services/
  │   ├── whatsapp.js          — WA client
  │   ├── session-persistence.js
  │   ├── circuit-breaker.js
  │   └── emergency.js
  ├── utils/
  │   ├── geminiRouter.js      — AI intent classification
  │   ├── chatbot.js           — Conversational AI
  │   ├── mediaProcessor.js    — OCR & voice transcription
  │   ├── accountingEngine.js  — Double-entry accounting
  │   ├── transactionRecorder.js
  │   ├── stockManager.js
  │   └── helpers.js
  ├── config/
  │   ├── supabase.js
  │   ├── session.js
  │   └── state.js
  ├── jobs/
  │   └── scheduler.js
  └── middleware/
      └── auth.js
```

## Deployment

Docker:
```bash
docker compose up --build
```

Supported platforms: Hugging Face Spaces (Docker), Railway.
