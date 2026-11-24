# Rencana & Bukti Verifikasi Keamanan (`SECURITY_TEST_PLAN.md`)

**Branch Kerja:** `security/p1-remediation` (non-production)  
**Target:** `erp-ekalliptus` (`functions/erpapi`, `apps/web`) dan `ekalliptus-web` (`apps/web`, `apps/admin`, `packages/core`, `supabase/`)

---

## 1. Pemeriksaan Read-Only yang Dijalankan pada Audit Awal (`2026-11-24`)

| Pemeriksaan | Target | Hasil |
| :--- | :--- | :--- |
| Ekstraksi SBOM/versi lockfile lokal | `erp-ekalliptus/package-lock.json` (399 pkg), `ekalliptus-web/bun.lock` (761 pkg) | **Lulus (Terpetakan 100%)** : Versi exact direct & transitive terkonfirmasi. |
| Pemeriksaan runtime workstation | CLI Windows (`node -v`, `npm -v`, `bun -v`) | **Terkonfirmasi:** `Node.js v24.19.0` (terdampak `CVE-2026-111497` KEV), `npm 11.17.0`, `Bun 1.4.0`. |
| Korelasi advisori `CVE-2026-*`, GHSA, NVD, CISA KEV | Komponen terpasang di kedua proyek (`search_web` 2026-11-24) | **Selesai** : Lihat `CVE_2026_FINDINGS.md`. |
| Static code & dataflow audit | Seluruh modul `erpapi`, `apps/web`, `apps/admin`, `packages/core`, `supabase/` | **Selesai** : 13 temuan aplikasi + 5 temuan konfigurasi repo. |
| Git metadata secret history & CI workflow audit | `git log --all --name-only` path `.env*`, `.secrets/*`, `*.pem`, `*.key`, `.github` | **Selesai** : Nihil `.env`/`.secrets` di history; `.opencode/` ter-commit; tidak ada `.github/workflows`. |
| Audit Cloud Live Read-Only (Cloudflare MCP & Neon MCP) | Zone `ekalliptus.com`, Workers, Pages, Neon `myekalliptus` (`pg_tables`, `pg_roles`, Auth, Realtime, Storage, Functions) | **Selesai** : 8 temuan live (`LIVE-CF-01..04`, `LIVE-NEON-01..04`) + konfirmasi Neon Data API disabled & bucket S3/R2 `private`. |
| Audit Cloud Live Supabase `ekalliptus-web` (`muyzxygtlwsfegzyvgcm`) | MCP `omnisupa` | **NOT VERIFIED** : Akun Supabase aktif tidak memuat proyek `muyzxygtlwsfegzyvgcm`. |

---

## 2. Suite Test Regresi Keamanan P1 yang Dijalankan di Branch `security/p1-remediation`

Seluruh eksekusi di bawah dijalankan setelah seluruh edit kode P1 selesai (termasuk penambahan directive `// @vitest-environment node` pada `apps/web/src/__tests__/security-p1.test.ts` agar pengujian server `Response`/`Set-Cookie` tidak terblokir guard browser `happy-dom`).

### A. `erp-ekalliptus`
1. **Unit & Policy Security Regression Tests** (`functions/erpapi/src/__tests__/security-p1.test.ts`):
   - Perintah: `node --import tsx --test functions/erpapi/src/__tests__/security-p1.test.ts`
   - Cakupan kasus uji:
     - `isSafeObjectKey`: menolak traversal `..`, backslash, leading slash, NUL bytes, dan key tunggal; mengizinkan key terstruktur valid.
     - `authorizeStorageDownload` (`APP-ERP-01`): menolak `staff` mengunduh slip karyawan lain (`slips/<run>/EK-001.pdf`); mengizinkan `staff` mengunduh slip miliknya sendiri bila verifikasi DB mengembalikan `true`; menolak `staff` mengakses avatar/selfie/receipt karyawan lain; mengizinkan `owner`/`hr`/`finance`.
     - `resolveMeKpiScopes` & `canViewAllEmployeesData` (`APP-ERP-02`): memvalidasi scoping KPI & data absensi lintas peran (`staff`, `warehouse`, `hr`, `finance`, `owner`).
     - Verifikasi statis `apps/web/public/_headers` (`INFRA-01`): memeriksa keberadaan `Content-Security-Policy` dengan `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, dan `Permissions-Policy`.
   - Status: **LULUS (10/10 tes, 4 suite, 0 gagal, 0 dilewati, durasi ~1,43 dtk, exit code 0)**
2. **Full Workspace Typecheck & Production Build Verification**:
   - Perintah: `npm run build` (`tokens:sync`, `build:db`, `build:contracts`, `build:api`, `build:web`)
   - Status: **LULUS (exit code 0; `tsc --noEmit` bersih di `packages/db`, `packages/contracts`, `functions/erpapi`, `apps/web`, serta Vite build 2.086 modul selesai dalam 25,49 dtk)**

### B. `ekalliptus-web`
1. **Vitest Suite + Security Regression P1 Tests** (`apps/web/src/__tests__/security-p1.test.ts`):
   - Perintah: `Set-Location c:\dev\ekalliptus-web\apps\web; bun run test` (`vitest run`)
   - Cakupan kasus uji:
     - Fail-closed role validation (`VALID_USER_ROLES`) & `requireRole` lintas matriks (`ADMIN_BLOG_ROLES`, `ADMIN_ORDER_ROLES`, `ADMIN_CUSTOMER_ROLES`, `ADMIN_LEAD_ROLES`, `ADMIN_LEAD_DELETE_ROLES`, `ADMIN_CONSULTATION_ROLES`, `ADMIN_AUDIT_ROLES`): memastikan `editor` ditolak di order/customer/lead/konsultasi/audit, `cs` diizinkan di konsultasi & order namun ditolak di blog/audit/delete lead, `owner` & `admin` tetap berfungsi, dan role null/tak dikenal ditolak (`APP-WEB-02`).
     - `sanitizePostgrestSearch`: memastikan injeksi koma/operator PostgREST (`.or`, `.neq`) terhapus (`APP-WEB-04`).
     - `applyAdminSecurityHeaders`: memastikan header keamanan wajib & `Cache-Control: no-store` terpasang sekaligus mempertahankan `Set-Cookie` (`INFRA-01`).
     - Static policy check terhadap `supabase/functions/order-webhook/index.ts` (validasi `ORDER_WEBHOOK_SECRET`, `x-webhook-secret`, lookup `orders`, tanpa `String(err)` leak) dan migrasi `20261124000001_enable_rls_order_sync_failures.sql` (`APP-WEB-01`, `INFRA-02`).
   - Status: **LULUS (15/15 file tes, 73/73 kasus uji lulus, 0 gagal, 0 dilewati, durasi 4,01 dtk, exit code 0; mencakup 10/10 tes P1 di `security-p1.test.ts`)**
2. **Build Verification**:
   - Catatan eksekusi CLI: perintah root `bun --cwd apps/web run build` / `bun --cwd apps/admin run build` pada versi Bun lokal hanya mencetak pesan bantuan `bun run` dan langsung keluar `0`, sehingga verifikasi build dijalankan langsung dari masing-masing direktori workspace.
   - Web (`Set-Location c:\dev\ekalliptus-web\apps\web; bun run build` -> `astro build && node ../../scripts/post-build.mjs`): **LULUS (exit code 0, Server built dalam 40,27 dtk)**
   - Admin (`Set-Location c:\dev\ekalliptus-web\apps\admin; bun run build` -> `vite build`): **LULUS (exit code 0, client 633 modul 15,19 dtk & SSR 627 modul 1,81 dtk)**
   - Admin Typecheck (`Set-Location c:\dev\ekalliptus-web\apps\admin; bun run typecheck` -> `react-router typegen && tsc`): **Exit code 2 (pra-eksisting)** pada `app/__tests__/admin-*.test.ts` (modul `../lib/admin/*` tidak ditemukan), `ExportedHandler` di `app/entry.worker.ts`, ambiguitas ekspor `BlogPost` di `packages/core/src/index.ts`, properti `description` di `admin.blog-new.tsx` / `admin.blog-edit.tsx` / `admin.order-detail.tsx`, tipe literal filter di `admin.orders.tsx` (baris 56-57), `sender_type` string pada `api.admin.consultations.$id.messages.ts`, serta `app/routes/home.tsx`. Tidak ditemukan error TypeScript baru yang berasal dari patch P1 (`auth.ts`, `security-headers.ts`, guard `requireRole`, maupun `sanitizePostgrestSearch`).

---

## 3. Verifikasi yang Masih Harus Dilakukan Pengguna Sebelum Merge/Deploy Produksi

1. Jalankan query SQL read-only pada `REMEDIATION_PLAN.md` di akun Supabase pemilik `muyzxygtlwsfegzyvgcm`.
2. Konfigurasikan env `ORDER_WEBHOOK_SECRET` pada Supabase Edge Function `order-webhook` dan Database Webhook header `x-webhook-secret` sebelum men-deploy `supabase/functions/order-webhook/index.ts` dan migrasi SQL RLS.
3. Pasang Cloudflare Access & matikan `workers.dev` untuk `ekalliptus-admin`, serta uji di lingkungan preview/staging sebelum mempromosikan ke `main`.
4. Lakukan active DAST / uji penetrasi terotorisasi pada staging setelah seluruh perbaikan P1 & P2 terpasang.
