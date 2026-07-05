## Deskripsi

<!-- Jelaskan apa yang diubah dan mengapa -->

## Checklist Definition of Done

### Backend (jika ada perubahan BE)

- [ ] Tipe kontrak sudah didefinisikan di `src/types/api.ts`
- [ ] Zod schema untuk request body (jika ada)
- [ ] Route handler menggunakan `apiSuccess` / `apiError`
- [ ] Error handling mencakup semua kemungkinan error
- [ ] Integration test minimal 1 skenario sukses + 1 error
- [ ] Tidak ada `console.log`
- [ ] Prettier pass

### Frontend (jika ada perubahan FE)

- [ ] Import tipe dari `src/types/api.ts` (bukan redefine)
- [ ] UI mencakup state: loading, empty, error, success
- [ ] Zustand store (jika perlu data global)
- [ ] Error handling dari API ditampilkan (toast/alert)
- [ ] Tidak ada `console.log`
- [ ] Prettier pass

### Keduanya

- [ ] `tsc --noEmit` pass
- [ ] `npm test` pass
- [ ] Laporan progress sudah dicatat di `docs/engineering-standards.md`

## Breaking Changes

<!-- Jika ada perubahan response shape, rename field, atau perubahan auth flow, sebutkan -->

## Screenshot (jika FE)

<!-- Tempel screenshot sebelum/sesudah -->

## Referensi Issue

<!-- Closes #N atau relates to #N -->
