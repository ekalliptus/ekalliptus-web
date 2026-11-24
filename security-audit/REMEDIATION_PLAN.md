# Rencana Remediasi Keamanan Terprioritas (`REMEDIATION_PLAN.md`)

Seluruh perubahan kode Fase P1 disiapkan di branch non-production `security/p1-remediation` pada kedua repo (`erp-ekalliptus` dan `ekalliptus-web`). Tidak ada perubahan langsung pada `main`, tidak ada rotasi secret otomatis, dan tidak ada deployment produksi sebelum review Anda.

---

## 1. Immediate Containment (P1 - Prioritas Utama)

| Item | Quick Mitigation | Permanent Fix | Owner | Effort | Risiko Kompatibilitas | Verifikasi & Rollback |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **`APP-ERP-01` (IDOR Slip Gaji PDF & Total Payroll)** | Pantau `audit_logs` (`module='storage'`, `action='presign_download'`) untuk akses `slips/`. | **[SUDAH DI BRANCH `security/p1-remediation`]** Tambah `authorizeStorageDownload` + `isSafeObjectKey` di `erpapi/src/services/security-policy.ts`, validasi kepemilikan `payroll_items` di `modules/storage.ts`, sembunyikan `total_disbursed` non-pengelola di `modules/payroll.ts` & `PayrollPage.tsx`. | Backend (`erpapi`) + Web (`apps/web`) | Kecil | Rendah (kompatibel penuh dengan Flutter Android & Web). | Jalankan `security-p1.test.ts` + uji download slip `staff` vs `owner`. Rollback: `git revert` / redeploy versi fungsi Neon sebelumnya. |
| **`APP-ERP-02` (`/api/me` Oversharing, Realtime/SSE & Push Absensi)** | Tidak ada workaround penuh tanpa patch server. | **[SUDAH DI BRANCH `security/p1-remediation`]** Scope KPI `/api/me` via `resolveMeKpiScopes`, filter `attendancesLiveQuery` & SSE `erp:attendance` per `employee_id` untuk non-`owner`/`hr`/`finance`, pindahkan event `payroll_*` ke `erp:finance`, & gunakan `resolveModuleApprovers` di `attendance.ts`. | Backend + Web (`erp-ekalliptus`) | Sedang | Rendah (pastikan card Dashboard `staff` tampil `Terbatas RBAC` pada KPI terbatas). | Jalankan `security-p1.test.ts` & uji login semua 5 role di Web + Android. Rollback: redeploy revision Neon Functions & Pages sebelumnya. |
| **`APP-WEB-01` (Unauthenticated `order-webhook`)** | Cek apakah `order-webhook` di-deploy di Supabase `muyzxygtlwsfegzyvgcm`; set env `ORDER_WEBHOOK_SECRET` sebelum aktifkan kembali. | **[SUDAH DI BRANCH `security/p1-remediation`]** Tambah pengecekan metode `POST`, header `x-webhook-secret` (constant-time `timingSafeEqual`), validasi UUID + lookup otoritatif ke tabel `orders`, & sembunyikan detail error 500. | Backend (`ekalliptus-web`) | Kecil | Rendah (wajib sinkronkan header `x-webhook-secret` di Database Webhook / trigger Supabase). | Uji `POST` tanpa secret (`401`) & secret valid + order fiktif (`404`). Rollback: deploy versi Edge Function sebelumnya. |
| **`APP-WEB-02` (`apps/admin` Fail-Open `'admin'` & BFLA)** | Aktifkan Cloudflare Access pada admin panel sebagai kontrol perimeter. | **[SUDAH DI BRANCH `security/p1-remediation`]** Ubah `getAdminSession` agar fail-closed bila `role` tidak valid, pakai matriks role terpusat pada semua loader & action, perbaiki role `cs` di API konsultasi & blok `editor` dari order/customer/lead/konsultasi, perbaiki `redirect` import. | Full-Stack (`ekalliptus-web`) | Sedang | Rendah (memperbaiki bug akses `cs` di live chat sekaligus memperketat `editor`). | Jalankan Vitest `security-p1.test.ts` + uji login setiap role di Worker preview. Rollback: `wrangler rollback`. |
| **`INFRA-01` (Security Headers `my.ekalliptus.com` & `ekalliptus-admin`)** | Dapat dipasang sementara lewat Cloudflare Transform Rules. | **[SUDAH DI BRANCH `security/p1-remediation`]** Tambah CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` di `erp-ekalliptus/apps/web/public/_headers` dan `ekalliptus-web/apps/admin/app/lib/security-headers.ts` + `entry.worker.ts`. | Frontend / DevOps | Kecil | Sedang (pantau DevTools Console bila ada domain API/tile/FCM/CDN baru yang diblokir CSP). | Cek DevTools Network headers & uji kamera face-scan, OpenStreetMap picker, push FCM, dan Tiptap editor. Rollback: `wrangler rollback` / revert `_headers`. |
| **`INFRA-02` (Supabase `order_sync_failures` RLS & Audit Live DB)** | Audit langsung di SQL Editor Supabase `muyzxygtlwsfegzyvgcm` menggunakan query read-only di bawah. | **[SUDAH DI BRANCH `security/p1-remediation`]** Tambah migrasi `20261124000001_enable_rls_order_sync_failures.sql` dan buka tracking `supabase/migrations/*.sql` di `.gitignore`. | DBA / DevOps (`ekalliptus-web`) | Kecil | Sangat rendah (`service_role` tetap bypass RLS). | Jalankan SQL verifikasi & uji query `anon` key ke tabel sensitif -> 0 baris / `401`/`403`. Rollback: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` bila darurat. |
| **`LIVE-CF-03` (Cloudflare Access & Matikan `*.workers.dev` pada `ekalliptus-admin`)** | Batasi sementara akses admin atau aktifkan Access segera di Cloudflare Zero Trust. | Hubungkan `ekalliptus-admin` ke custom domain ber-proxy di zona `ekalliptus.com`, buat aplikasi Cloudflare Access (Email OTP / Google Workspace), lalu nonaktifkan `workers.dev` subdomain & preview URLs di dashboard Workers `ekalliptus-admin`. | DevOps (Cloudflare) | Kecil | Rendah (pastikan bookmark admin memakai custom domain baru). | Akses `*.workers.dev` -> diblokir/404; akses domain admin -> wajib autentikasi Cloudflare Access terlebih dahulu. |
| **`CVE-2026-111497` [KEV] (Node.js Lokal `v24.19.0`)** | Hindari menjalankan dev server atau skrip Node yang menerima input/kompresi tak tepercaya di mesin lokal. | Upgrade Node.js workstation & CI ke minimum aman **`24.22.3`** (menutup CISA KEV `CVE-2026-111497` serta `123863`, `123874`, `123864`, `105482`, `105483`). | Developer / DevOps | Kecil | Sangat rendah. | `node -v` >= `v24.22.3` + `npm run build` & `vitest` lulus. |

### Query SQL Read-Only untuk Audit Live Supabase (`muyzxygtlwsfegzyvgcm`)

Karena akun aktif `omnisupa` saat ini tidak memuat proyek `muyzxygtlwsfegzyvgcm`, jalankan query **read-only** berikut secara manual di **Supabase Dashboard -> SQL Editor** pada proyek `ekalliptus-web` dan verifikasi hasilnya:

```sql
-- 1. Cek apakah semua tabel public sudah mengaktifkan RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Cek seluruh policy RLS aktif pada tabel public (pastikan tidak ada akses anon ke profiles, leads, audit_logs, order_sync_failures, payments)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Cek privilege role anon & authenticated
SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

---

## 2. Near-Term Fixes (P2 - Risiko Signifikan)

| Item | Permanent Fix & Target Aman | Owner | Effort | Risiko Kompatibilitas | Verifikasi & Rollback |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **`LIVE-CF-01`, `LIVE-CF-02`, `LIVE-CF-04` (Cloudflare TLS, HSTS, WAF Rate Limit)** | Naikkan `min_tls_version` ke `"1.2"`, aktifkan edge HSTS (`max_age=31536000; includeSubDomains; nosniff`), dan tambahkan WAF Rate Limiting Rules untuk `POST /admin/login` serta `POST /api/*` pada zona `ekalliptus.com`. | DevOps | Kecil | Rendah (klien lawas TLS 1.0/1.1 tidak lagi diterima). | Uji `curl -I` atau SSL check -> TLS 1.0/1.1 ditolak, HSTS aktif, >10 login cepat -> 429. Rollback: ubah rule di Cloudflare Rulesets. |
| **`LIVE-NEON-01`, `LIVE-NEON-02`, `LIVE-NEON-03` (Neon Env, Auth & Realtime)** | Set `WEB_ALLOWED_ORIGINS=https://my.ekalliptus.com` di env `erpapi` Neon Functions, nonaktifkan `allow_localhost`, aktifkan `revoke_sessions_on_password_reset: true`, dan set `allowed_origins: ["https://my.ekalliptus.com"]` pada Neon Realtime. | DevOps / Backend | Kecil | Rendah-Sedang (dev lokal memakai branch dev/preview terpisah). | Preflight `Origin: http://localhost:5173` ke prod `erpapi` -> tanpa `ACAO`; reset password memutus token lama. |
| **`GHSA-qhgm-jj2j-75wj` & `GHSA-2rq8-3rm6-2w8f` (`react-router@8.0.0`)** | Upgrade `react-router`, `@react-router/dev`, dan `@react-router/cloudflare` di `ekalliptus-web/apps/admin` ke minimum **`8.5.1`** pada branch terpisah setelah P1. | Frontend (`ekalliptus-web`) | Sedang | Rendah-Sedang (uji kompatibilitas Cloudflare Vite plugin & SSR routes). | `bun run build:admin` + smoke test login/blog/orders/leads di preview Worker. |
| **`CVE-2026-54298` / `54299` / `45028` / `50146` (`astro@6.1.9`) & `vite@7.3.2` / `8.1.2`** | Upgrade `astro` ke minimum **`6.4.8`** (lewati `6.4.7` karena `CVE-2026-59731`), upgrade `vite` 7.x `>= 7.3.7` & 8.x `>= 8.1.6`, `sharp >= 0.35.2`, `undici >= 7.30.1`. | Frontend (`ekalliptus-web`) | Sedang | Rendah-Sedang. | `bun run test` + `bun run build:web` + uji semua 7 locale SSR di preview. |
| **`APP-WEB-03`, `APP-WEB-05` (CSRF Origin Check, Login Rate Limit, Global SignOut)** | Tambahkan verifikasi eksak `Origin`/`Sec-Fetch-Site` pada seluruh mutasi `apps/admin`, pasang `RATE_LIMITER` binding pada `/admin/login`, samakan pesan gagal login, dan panggil `signOut(token, 'global')` saat `/admin/logout`. | Full-Stack (`ekalliptus-web`) | Sedang | Rendah | Test CSRF `403`, rate limit `429`, dan replay token pasca-logout `401`. |
| **`APP-ERP-03` & `APP-ERP-04` (Attendance Anti-Fraud & S3 Upload Limits)** | Ganti bypass boolean `biometric_verified` mentah dengan signed WebAuthn/Play Integrity atau wajib face-scan; ikat `qr_token` pakai HMAC/TOTP rotating per kantor; tambah izin per kategori upload, MIME allowlist, dan `ContentLength` limit di `presign-upload`. | Backend + Mobile/Web (`erp-ekalliptus`) | Besar | Tinggi (memerlukan rilis koordinasi APK Android & Web). | End-to-end test absensi Web & Android + uji penolakan bypass. |
| **`APP-ERP-05` (JWT `alg`/`aud` Pinning, Hapus `?token=` SSE, CORS SSE)** | Pin `algorithms` & `audience` pada `jwtVerify(...)`, ganti `?token=` SSE dengan short-lived ticket sekali pakai, dan samakan CORS SSE dengan `ALLOWED_ORIGINS`. | Backend (`erp-ekalliptus`) | Kecil-Sedang | Sedang (cek kompatibilitas listener SSE di klien Flutter). | Unit test JWT invalid `alg`/`aud` + uji koneksi SSE tanpa token di URL. |
| **`INFRA-03` (`apps/admin/Dockerfile`)** | Pin `node:24.22.3-alpine@sha256:<digest>`, jalankan dengan `USER node`, tambah `.dockerignore`, atau hapus `Dockerfile` bila deployment 100% di Cloudflare Workers. | DevOps | Kecil | Sangat rendah | `docker build` + cek `whoami` bukan root. |

---

## 3. Long-Term Hardening (P3 / P4)

| Item | Permanent Fix | Owner | Effort | Risiko Kompatibilitas | Verifikasi & Rollback |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **`APP-ERP-06` & `APP-ERP-07`** | Paksa `status='pending'` saat `!finance:approve`; turunkan harga item POS inventaris dari `inventory_items.sell_price`; proksikan `erpapi` lewat domain Cloudflare ber-WAF (`api-erp.ekalliptus.com`) & jangan percaya header IP spoofing; samarkan error 500 di `app.onError`. | Backend / DevOps | Sedang | Rendah-Sedang | Integration test finance/POS & uji spoof `CF-Connecting-IP`. |
| **`LIVE-NEON-04` (Neon Backup & Branch Protection)** | Aktifkan `protected: true` di branch `production`, jadwalkan automated snapshot & lakukan uji restore periodik. | DevOps | Kecil | Sangat rendah | Verifikasi `get_snapshot_schedule` tidak kosong & branch protected aktif. |
| **`APP-WEB-06`, `INFRA-04`, `INFRA-05`, Astro v7** | Pindahkan sanitasi `parse5` ke tahap write blog di `@ekalliptus/core` (cegah DOM clobbering `id`), hapus helper legacy `supabase.ts`, hapus `'unsafe-inline'` pada `HTML_CSP` `ekalliptus.com` via nonce/hash, tambahkan GitHub Actions CI security gates (OSV-Scanner, secret scan, test otomatis), untrack `.opencode/`, pindahkan default kontak `seed.ts` ke env, dan jadwalkan upgrade mayor teruji ke Astro `7.3.3+` + `drizzle-kit` terbaru (`esbuild >= 0.25.0`). | Full-Stack / DevOps | Sedang-Besar | Sedang | CSP report 0 error, CI green, regresi visual lulus. |
