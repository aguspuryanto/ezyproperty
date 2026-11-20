# Panduan Deploy EzyProperty ke Vercel

> Untuk VPS atau shared hosting, lihat [DEPLOY.md](DEPLOY.md).

## Gambaran

Repo ini monorepo berisi dua aplikasi. Di Vercel keduanya dibuat sebagai **dua project terpisah dari repo yang sama**:

| Project Vercel | Root Directory | Framework (terdeteksi otomatis) | Domain contoh |
|---|---|---|---|
| `ezyproperty-web` | `apps/web` | Next.js | `ezyproperty.id` |
| `ezyproperty-api` | `apps/api` | Hono | `api.ezyproperty.id` |

Database, login, dan penyimpanan foto tetap di **Supabase** — tidak ada yang perlu dipindah.

Kode sudah siap untuk Vercel:
- API (`apps/api/src/index.ts`) meng-export `app` Hono. Di Vercel, `app` dijalankan sebagai Vercel Function; di luar Vercel tetap menyalakan server biasa.
- Web **tidak** memakai `NEXT_OUTPUT=standalone` di Vercel (itu khusus shared hosting).

**Urutan deploy:** API dulu → web (butuh URL API) → kembali ke API untuk mengisi `CORS_ORIGIN` (butuh URL web).

### Catatan paket Vercel
- **Hobby (gratis)** hanya untuk penggunaan **non-komersial**. EzyProperty adalah marketplace komersial, jadi untuk produksi gunakan **Pro**. Hobby cukup untuk uji coba.
- Optimasi gambar (`next/image`) dihitung dalam kuota Vercel. Jika kuota terasa berat, set `NEXT_IMAGES_UNOPTIMIZED=1` di project web (lihat langkah 2).

---

## Langkah 0 — Persiapan

1. Push repo ke GitHub / GitLab / Bitbucket.
2. Pastikan `pnpm-lock.yaml` ikut ter-commit (Vercel memakai pnpm sesuai lockfile dan field `packageManager` di `package.json` root).
3. Siapkan nilai dari Supabase (**Project Settings → API Keys**):
   - Project URL
   - Publishable key (`sb_publishable_...`)
   - Secret key (`sb_secret_...`) — **hanya untuk project API**
4. Cek **region** project Supabase Anda (**Project Settings → General**). Fungsi Vercel sebaiknya ditempatkan di region terdekat (lihat langkah 1.4).

---

## Langkah 1 — Project API

1. Vercel Dashboard → **Add New… → Project** → pilih repo EzyProperty → **Import**.
2. Isi:
   - **Project Name**: `ezyproperty-api`
   - **Root Directory**: klik *Edit* → pilih `apps/api`
   - **Framework Preset**: harus terdeteksi **Hono**. Biarkan Build/Install/Output command default.
3. **Environment Variables** (centang Production dan Preview):

   | Nama | Nilai |
   |---|---|
   | `SUPABASE_URL` | Project URL Supabase |
   | `SUPABASE_ANON_KEY` | Publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key |
   | `CORS_ORIGIN` | Sementara isi `http://localhost:3000`; diganti di langkah 3 |

   `PORT` **tidak perlu** di Vercel.
4. Klik **Deploy**. Setelah selesai, buka **Settings → Functions → Function Region** dan pilih region terdekat dengan Supabase (mis. Supabase di Singapura → `Singapore (sin1)`), lalu **Redeploy**.
5. Uji: buka `https://<project-api>.vercel.app/api/v1/health` → harus tampil `{"success":true,...}`.
   Uji juga `https://<project-api>.vercel.app/api/v1/properties?limit=1` → harus berisi 1 listing.

Catat URL API ini, mis. `https://ezyproperty-api.vercel.app`.

---

## Langkah 2 — Project Web

1. **Add New… → Project** → repo yang sama → **Import**.
2. Isi:
   - **Project Name**: `ezyproperty-web`
   - **Root Directory**: `apps/web`
   - **Framework Preset**: **Next.js** (otomatis)
3. **Environment Variables** (Production dan Preview):

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://ezyproperty.id` (atau URL `.vercel.app` jika belum punya domain) |
   | `NEXT_PUBLIC_API_URL` | `https://ezyproperty-api.vercel.app/api/v1` (URL dari langkah 1 + `/api/v1`) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
   | `NEXT_IMAGES_UNOPTIMIZED` | *(opsional)* `1` untuk mematikan optimasi gambar |

   ⚠️ **Jangan** masukkan Secret key Supabase ke project web.
   ⚠️ Variabel `NEXT_PUBLIC_*` ditanam saat build — setiap kali nilainya diubah, **Redeploy** project web.
4. Klik **Deploy**, lalu set **Function Region** sama seperti API dan Redeploy.

---

## Langkah 3 — Hubungkan keduanya

1. **Project API → Settings → Environment Variables** → ubah `CORS_ORIGIN` menjadi alamat web, persis tanpa garis miring di akhir:
   - `https://ezyproperty.id` (jika memakai domain sendiri), atau
   - `https://ezyproperty-web.vercel.app`
2. **Deployments → … → Redeploy** project API.

> `CORS_ORIGIN` hanya menerima **satu** origin. Deployment *preview* web (URL acak `*.vercel.app`) tidak bisa memanggil API dari browser — misalnya form tambah listing. Halaman lain tetap jalan karena memanggil API dari server.

---

## Langkah 4 — Pengaturan Supabase

Project Supabase ini **dipakai bersama aplikasi lain**.

1. **Authentication → URL Configuration → Redirect URLs** → tambahkan:
   - `https://ezyproperty.id/**` (domain produksi)
   - `https://ezyproperty-web.vercel.app/**`
   - *(opsional, untuk preview)* `https://ezyproperty-web-*.vercel.app/**`
2. **Jangan ubah "Site URL"** — itu milik aplikasi lain. Form daftar EzyProperty sudah mengirim alamat kembaliannya sendiri.
3. **Project Settings → Data API → Exposed schemas** → pastikan `ezy` tercantum.

---

## Langkah 5 — Domain sendiri (opsional)

1. **Project web → Settings → Domains** → tambah `ezyproperty.id` (dan `www.ezyproperty.id`).
2. **Project API → Settings → Domains** → tambah `api.ezyproperty.id`.
3. Ikuti instruksi DNS yang ditampilkan Vercel di pengelola domain Anda (record `A` untuk domain utama, `CNAME` untuk subdomain). SSL dibuat otomatis.
4. Setelah domain aktif, perbarui:
   - Web: `NEXT_PUBLIC_SITE_URL=https://ezyproperty.id`, `NEXT_PUBLIC_API_URL=https://api.ezyproperty.id/api/v1` → **Redeploy web**
   - API: `CORS_ORIGIN=https://ezyproperty.id` → **Redeploy API**
   - Supabase Redirect URLs: pastikan `https://ezyproperty.id/**` ada

---

## Deploy berikutnya

Setiap `git push`:
- ke branch produksi (`main`) → deploy **Production** otomatis;
- ke branch lain / pull request → deploy **Preview** dengan URL sendiri.

Kedua project ikut ter-deploy setiap push. Supaya project tidak di-build ulang saat bagian lain yang berubah, isi **Settings → Git → Ignored Build Step** dengan:

- project web: `git diff --quiet HEAD^ HEAD -- . ../../pnpm-lock.yaml`
- project API: `git diff --quiet HEAD^ HEAD -- . ../../pnpm-lock.yaml`

(perintah dijalankan dari Root Directory masing-masing; build dilewati jika tidak ada perubahan di folder tersebut maupun di lockfile.)

### Alternatif: Vercel CLI

```bash
npm i -g vercel
vercel login

cd apps/api && vercel link     # pilih/buat project ezyproperty-api
vercel deploy --prod

cd ../web && vercel link       # pilih/buat project ezyproperty-web
vercel deploy --prod
```

`vercel link` membuat folder `.vercel/` — sudah dimasukkan ke `.gitignore`.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| Build web gagal `ERR_REQUIRE_ESM ... magic-string` | Versi Tailwind naik ke ≥ 4.3.4. Repo sudah mengunci `tailwindcss` & `@tailwindcss/postcss` di **4.3.3** — jangan di-upgrade tanpa uji `next build` |
| API: `Missing environment variable: SUPABASE_...` | Env API belum diisi untuk environment tersebut (Production/Preview) → isi lalu Redeploy |
| API `/` menampilkan "Route not found" | Normal — semua endpoint ada di bawah `/api/v1/...` |
| Daftar properti di web kosong | `NEXT_PUBLIC_API_URL` salah / tanpa `/api/v1`, atau API error → cek Runtime Logs project API, lalu Redeploy web |
| `Invalid schema: ezy` | Schema `ezy` belum ada di Exposed schemas Supabase |
| Form tambah listing gagal (CORS) | `CORS_ORIGIN` di API tidak sama persis dengan alamat web yang dibuka |
| Link verifikasi email membuka aplikasi lain | Domain web belum ada di Supabase Redirect URLs |
| Gambar tidak tampil | Hostname gambar belum ada di `images.remotePatterns` (`apps/web/next.config.ts`) |
| Halaman lambat di akses pertama | Region fungsi jauh dari Supabase → samakan region (langkah 1.4) |

Log error: **Project → Deployments → (deployment) → Logs / Runtime Logs**.

---

## Checklist setelah deploy

- [ ] `https://api.ezyproperty.id/api/v1/health` → `success: true`
- [ ] Beranda & `/properti` menampilkan listing beserta foto; filter & pagination jalan
- [ ] Halaman detail listing terbuka
- [ ] Daftar akun baru → email verifikasi mengarah ke `https://ezyproperty.id/login`
- [ ] Login → dashboard menampilkan listing milik akun
- [ ] Tambah listing (dengan foto) berhasil masuk "Menunggu moderasi"
- [ ] Secret key Supabase hanya ada di project **API**, tidak di project web
