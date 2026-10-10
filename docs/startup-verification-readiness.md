# Startup Verification Readiness — Ekalliptus Digital

Laporan internal (bukan halaman publik). Disusun 2026-10-11 dari inspeksi repositori
`ekalliptus-web` dan situs produksi ekalliptus.com. Tujuan: menilai kesiapan situs sebagai
representasi bisnis yang dapat diverifikasi untuk aplikasi program startup
(termasuk Claude for Startups), tanpa misrepresentasi apa pun.

## 1. Identitas bisnis dan sejarah

| Fakta | Nilai | Status |
|---|---|---|
| Nama merek saat ini | Ekalliptus Digital | Verified (situs, repo) |
| Nama sebelumnya | ANRAVT, beroperasi sejak September 2021 | Owner-confirmed |
| Rebranding menjadi Ekalliptus | 2025 (tanggal pasti belum dikonfirmasi) | Perlu konfirmasi owner |
| Domain ekalliptus.com | Terdaftar 3 Desember 2025 | Owner-confirmed |
| Badan hukum (NIB/PT/CV) | Belum ada | Owner-confirmed — jangan diklaim |
| Email bisnis | salam@ekalliptus.com | Ada di seluruh situs; **deliverability belum diverifikasi** (perlu uji kirim/terima) |
| Pendiri | Haikal Akhalul Azhar (bio.ekalliptus.com ditautkan dari footer) | Publik via tautan bio; tidak ada klaim tim fiktif di situs |

Kontinuitas sejarah kini dinyatakan eksplisit di halaman `/id/about` (seksi "Sejarah Kami"):
2021 ANRAVT → 2025 rebranding + domain → 2026 situs aktif. Rebranding TIDAK diposisikan
sebagai tanggal pendirian baru.

## 2. Inventori bukti (evidence inventory)

**Terverifikasi via repositori/situs:**
- Kode sumber situs + admin (GitHub `ekalliptus/ekalliptus-web`, riwayat commit publik bila repo publik — konfirmasi visibilitas repo).
- 20 artikel blog teknis (Supabase-backed, `src/content/blog`).
- eBot widget konsultasi (integrasi AI nyata, model GLM via ZAI — **bukan Claude**).
- Kanal order + WhatsApp, kebijakan editorial/privasi/syarat (halaman publik).
- Sitemap, robots, llms.txt konsisten dengan konten aktual.

**Memerlukan konfirmasi/dokumen owner:**
- Portofolio proyek klien nyata (saat ini TIDAK ada klaim klien di situs — benar, jangan
  ditambahkan tanpa izin klien dan hasil yang bisa diverifikasi).
- Bukti operasional ANRAVT 2021-2025 (invoice, kontrak, repositori lama, akun publik lama).
- Tanggal rebranding persis; deskripsi resmi struktur tim (solo/freelance/kolaborator).
- Dokumen kepemilikan domain + email (registrar, DNS, mailbox provider).

**Tidak didukung bukti (jangan dipublikasikan):**
- Jumlah klien, rating, metrik traction, pendanaan, sertifikasi, kemitraan, afiliasi Anthropic.

## 3. Maturity produk & roadmap AI (faktual)

- Live: situs publik multi-bahasa, blog, form order + notifikasi WhatsApp, admin panel
  (auth + RBAC), eBot konsultasi AI (GLM/ZAI).
- Beta/internal: widget konsultasi handoff admin (polling, sesi cookie).
- Rencana (bukan implementasi): penerapan model Claude untuk drafting konten dan
  asisten internal — baru rencana, belum ada integrasi Claude di kode. Jangan klaim
  "powered by Claude" sebelum benar-benar diintegrasikan.

## 4. Gap yang butuh bukti manusia / keputusan owner

1. Konfirmasi tanggal rebranding persis (untuk konsistensi semua materi).
2. Uji deliverability salam@ekalliptus.com (kirim/terima, spam filter).
3. Keputusan: tampilkan nama pendiri secara eksplisit di About? (bio sudah ditautkan).
4. Portofolio: kumpulkan 1-2 studi kasus nyata dengan izin tertulis klien.
5. Visibilitas repo GitHub (publik/privat) sebagai bukti aktivitas teknis.
6. Arsip bukti era ANRAVT untuk kontinuitas usia bisnis.

## 5. Risiko eligibilitas program startup — PENTING

- Claude for Startups (dan program serupa) umumnya membatasi usia perusahaan (mis. <5 tahun).
- ANRAVT beroperasi sejak **September 2021**; per Oktober 2026 usia operasional ±5 tahun —
  berada tepat di/pada batas ketentuan 5 tahun.
- **Rebranding 2025 dan registrasi domain Desember 2025 TIDAK mereset usia bisnis.**
  Menyajikan 2025 sebagai tahun pendirian adalah misrepresentasi dan berisiko ditolak/dicabut.
- Rekomendasi: baca ketentuan usia program secara spesifik; jika ambigu, tanyakan langsung
  ke penyelenggara dengan kronologi jujur (beroperasi 2021 sebagai ANRAVT, rebrand 2025).
  Jika program mensyaratkan badan hukum, pendaftaran NIB/PT harus didahulukan.
- Laporan ini TIDAK menjamin penerimaan program apa pun, dan tidak menyatakan afiliasi
  dengan Anthropic.

## 6. Deskripsi jujur (siap pakai, 50-500 karakter)

**Bisnis saat ini (ID):**
"Ekalliptus Digital (sebelumnya ANRAVT, beroperasi sejak 2021) adalah penyedia jasa
pembuatan website, aplikasi mobile, dan maintenance untuk bisnis di Indonesia.
Kami melayani via ekalliptus.com dengan proses order transparan dan konsultasi gratis."

**Rencana penggunaan Claude (ID):**
"Kami berencana memakai Claude untuk membantu drafting artikel teknis, peninjauan kode,
dan asisten internal tim, memperpendek waktu pengerjaan proyek klien tanpa mengorbankan
kualitas. Integrasi masih tahap rencana; saat ini situs memakai model AI lain (GLM)
untuk widget konsultasi."

*(Versi bahasa Inggris dapat diterjemahkan saat pengajuan; jangan menambah klaim di luar
dua paragraf di atas tanpa bukti baru.)*

## 7. Status teknis situs (ringkas, terukur)

- 59/59 automated tests lulus; `astro check` 0 error; build produksi lulus (2026-10-11).
- Keamanan: sanitasi XSS, rate limiting per-endpoint + terdistribusi, CSP+HSTS di SSR,
  cookie HttpOnly; migrasi RLS Supabase tersedia namun **belum diterapkan** (butuh
  service-role key + persetujuan).
- Performa: edge cache Cloudflare + invalidasi per-deploy; font subset; lazy images.
- Aksesibilitas: focus trap dialog, aria-live form, target sentuh 44px, reduced-motion.

## 8. Checklist keputusan owner sebelum pengajuan

- [ ] Konfirmasi tanggal rebranding.
- [ ] Verifikasi email bisnis berfungsi.
- [ ] Tentukan visibilitas repo GitHub.
- [ ] Kumpulkan minimal 1 studi kasus klien berizin.
- [ ] Pahami batas usia program; siapkan kronologi 2021→2025 yang jujur.
- [ ] Pertimbangkan pengurusan NIB jika program mensyaratkan badan hukum.
