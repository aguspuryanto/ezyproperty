# Panduan Deploy EzyProperty (tanpa Vercel)

EzyProperty terdiri dari tiga bagian:

| Bagian | Teknologi | Butuh apa di server |
|---|---|---|
| Web (`apps/web`) | Next.js 15 (SSR, middleware, login) | **Proses Node.js** yang terus berjalan |
| API (`apps/api`) | Hono di Node.js | **Proses Node.js** yang terus berjalan |
| Database, Auth, Storage | Supabase (cloud) | Tidak perlu di-host — sudah ada |

Karena web dan API **sama-sama butuh Node.js yang berjalan terus**, pilihan hosting-nya:

| Pilihan | Bisa? | Catatan |
|---|---|---|
| **A. VPS** (Ubuntu + Nginx + PM2) | ✅ **Disarankan** | Paling stabil, kontrol penuh, build bisa di server |
| **B. Shared hosting cPanel dengan menu "Setup Node.js App"** | ⚠️ Bisa, dengan batasan | Build harus di luar hosting; RAM/CPU terbatas; app bisa "tidur" |
| Shared hosting yang **hanya PHP** (tanpa Node.js) | ❌ Tidak bisa | Next.js versi ini tidak bisa diekspor jadi HTML statis (ada login, dashboard, middleware) |
| PaaS (Railway, Render, Fly.io, Coolify di VPS) | ✅ Bisa | Mirip opsi A tapi dikelola platform; tidak dibahas detail di sini |

Contoh domain di panduan ini: web di `https://ezyproperty.id`, API di `https://api.ezyproperty.id`. Ganti dengan domain Anda.

---

## 0. Persiapan (wajib untuk semua opsi)

### 0.1 Variabel environment

**Web** (`apps/web`) — semua `NEXT_PUBLIC_*` **ditanam saat build**, jadi harus sudah benar *sebelum* `next build`. Mengubahnya setelah build tidak berpengaruh — harus build ulang.

| Variabel | Contoh nilai produksi |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://ezyproperty.id` |
| `NEXT_PUBLIC_API_URL` | `https://api.ezyproperty.id/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`) |

**API** (`apps/api`) — dibaca saat runtime.

| Variabel | Contoh nilai produksi |
|---|---|
| `PORT` | `4000` (di shared hosting diatur otomatis) |
| `CORS_ORIGIN` | `https://ezyproperty.id` (origin web, tanpa garis miring di akhir) |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) — **hanya di server API, jangan pernah di web** |

### 0.2 Pengaturan Supabase

Project Supabase ini **dipakai bersama aplikasi lain** (schema `public` milik aplikasi lain; EzyProperty memakai schema `ezy`).

1. **Authentication → URL Configuration → Redirect URLs**: tambahkan `https://ezyproperty.id/**`.
   - **Jangan ubah "Site URL"** — itu milik aplikasi lain. Form daftar EzyProperty sudah mengirim alamat kembaliannya sendiri (`emailRedirectTo`), jadi cukup didaftarkan di Redirect URLs.
2. **Project Settings → Data API → Exposed schemas**: pastikan `ezy` tercantum (sudah dilakukan).
3. Migrasi `supabase/migrations/0001_init.sql` sudah dijalankan (sudah dilakukan).

### 0.3 DNS

Buat dua record yang mengarah ke server/hosting Anda:
- `ezyproperty.id` (dan `www` bila perlu) → web
- `api.ezyproperty.id` → API

---

## Opsi A — VPS (disarankan)

Spesifikasi minimum: **Ubuntu 22.04/24.04, 2 GB RAM** (1 GB bisa, tapi tambahkan swap karena `next build` cukup boros memori).

### A.1 Siapkan server

```bash
# Login sebagai root/sudo user
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw

# Node.js 22 + pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable && corepack prepare pnpm@10.10.0 --activate
sudo npm install -g pm2

# (Opsional, untuk RAM 1 GB) swap 2 GB
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Firewall
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### A.2 Ambil kode & isi environment

```bash
sudo mkdir -p /var/www && sudo chown $USER /var/www
cd /var/www
git clone <URL-REPO-ANDA> ezyproperty
cd ezyproperty
```

Buat `apps/web/.env.production` dan `apps/api/.env` sesuai tabel di bagian 0.1:

```bash
nano apps/web/.env.production
nano apps/api/.env
chmod 600 apps/api/.env
```

### A.3 Build

```bash
pnpm install --frozen-lockfile
pnpm build          # build web (next build) + API (tsc)
```

### A.4 Jalankan dengan PM2

Buat `ecosystem.config.cjs` di root repo:

```js
module.exports = {
  apps: [
    {
      name: "ezy-web",
      cwd: "./apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M"
    },
    {
      name: "ezy-api",
      cwd: "./apps/api",
      script: "dist/index.js",
      node_args: "--env-file-if-exists=.env",
      env: { NODE_ENV: "production" },
      max_memory_restart: "300M"
    }
  ]
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # jalankan perintah yang ditampilkan, agar otomatis hidup setelah reboot
```

Cek: `curl http://127.0.0.1:4000/api/v1/health` dan `curl -I http://127.0.0.1:3000`.

### A.5 Nginx + HTTPS

`/etc/nginx/sites-available/ezyproperty`:

```nginx
server {
    server_name ezyproperty.id www.ezyproperty.id;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    server_name api.ezyproperty.id;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ezyproperty /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Sertifikat SSL gratis (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ezyproperty.id -d www.ezyproperty.id -d api.ezyproperty.id
```

### A.6 Update aplikasi (deploy berikutnya)

```bash
cd /var/www/ezyproperty
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 reload all
```

---

## Opsi B — Shared hosting cPanel (Node.js App)

### B.0 Cek dulu apakah hosting Anda mendukung

Di cPanel, cari menu **"Setup Node.js App"** (nama lain: "Node.js Selector", "Application Manager"). Syarat:

- Menu itu **ada**, dan tersedia **Node.js 20 atau 22**.
- Bisa membuat **2 aplikasi Node.js** (web dan API), masing-masing dengan domain/subdomain sendiri.
- RAM per akun idealnya **≥ 1 GB** (Next.js butuh ±200–400 MB saat berjalan).

Kalau menu itu tidak ada, hosting tersebut **tidak bisa** menjalankan EzyProperty — pakai VPS.

**Batasan yang perlu diterima:**
- **Jangan build di shared hosting** — `next build` biasanya kehabisan RAM/CPU di sana. Build dilakukan di komputer Linux / WSL / GitHub Actions, lalu hasilnya di-upload.
- Aplikasi bisa **"tidur"** saat sepi pengunjung; akses pertama setelahnya lebih lambat (cold start).
- Batas proses & CPU bisa membuat situs lambat saat ramai.

### B.1 Build paket untuk shared hosting

Build **harus di Linux** (WSL di Windows, server Linux lain, atau GitHub Actions). Build di Windows menghasilkan library native (mis. `sharp` untuk optimasi gambar) versi Windows yang tidak jalan di server Linux.

Repo sudah disiapkan: `NEXT_OUTPUT=standalone` membuat Next.js menghasilkan satu folder mandiri yang siap di-upload.

**Cara 1 — di WSL / Linux:**

```bash
cd ezyproperty
# node-linker=hoisted: node_modules tanpa symlink, aman di-zip & di-extract di cPanel
pnpm install --frozen-lockfile --config.node-linker=hoisted

# ---- Web ----
export NEXT_OUTPUT=standalone
export NEXT_PUBLIC_SITE_URL=https://ezyproperty.id
export NEXT_PUBLIC_API_URL=https://api.ezyproperty.id/api/v1
export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
# Opsional: matikan optimasi gambar untuk menghemat CPU/RAM hosting
# export NEXT_IMAGES_UNOPTIMIZED=1
pnpm --filter @ezyproperty/web build

cd apps/web
cp -r .next/static .next/standalone/apps/web/.next/static
[ -d public ] && cp -r public .next/standalone/apps/web/public
rm -f .next/standalone/apps/web/.env*          # jangan ikut upload file .env lokal
(cd .next/standalone && zip -qry ../../../../web-standalone.zip .)
cd ../..

# ---- API ----
pnpm --filter @ezyproperty/api build
(cd apps/api && zip -qr ../../api.zip dist package.json)
```

Hasilnya: `web-standalone.zip` dan `api.zip` di root repo.

**Cara 2 — GitHub Actions** (kalau repo ada di GitHub). Simpan sebagai `.github/workflows/build-shared-hosting.yml`, isi nilai `NEXT_PUBLIC_*` di *Settings → Secrets and variables → Actions → Variables*, lalu jalankan manual dari tab Actions. Zip bisa diunduh dari halaman run tersebut.

```yaml
name: Build for shared hosting
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install --frozen-lockfile --config.node-linker=hoisted
      - name: Build web (standalone)
        env:
          NEXT_OUTPUT: standalone
          NEXT_PUBLIC_SITE_URL: ${{ vars.NEXT_PUBLIC_SITE_URL }}
          NEXT_PUBLIC_API_URL: ${{ vars.NEXT_PUBLIC_API_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        run: pnpm --filter @ezyproperty/web build
      - name: Package web
        run: |
          cd apps/web
          cp -r .next/static .next/standalone/apps/web/.next/static
          if [ -d public ]; then cp -r public .next/standalone/apps/web/public; fi
          cd .next/standalone && zip -qry "$GITHUB_WORKSPACE/web-standalone.zip" .
      - name: Build & package API
        run: |
          pnpm --filter @ezyproperty/api build
          cd apps/api && zip -qr "$GITHUB_WORKSPACE/api.zip" dist package.json
      - uses: actions/upload-artifact@v4
        with:
          name: ezyproperty-shared-hosting
          path: "*.zip"
```

### B.2 Upload & pasang Web

1. cPanel → **File Manager** → buat folder `ezyproperty-web` di home (di luar `public_html`).
2. Upload `web-standalone.zip` ke folder itu → **Extract**.
   Isinya: `apps/web/server.js`, `apps/web/.next/...`, `node_modules/`, `package.json`.
3. cPanel → **Setup Node.js App** → **Create Application**:
   - Node.js version: **22** (atau 20)
   - Application mode: **Production**
   - Application root: `ezyproperty-web`
   - Application URL: `ezyproperty.id`
   - Application startup file: `apps/web/server.js`
   - Environment variables: `NODE_ENV=production`
4. **Jangan** klik "Run NPM Install" untuk web — `node_modules` sudah ikut di dalam zip.
5. Klik **Start/Restart**, lalu buka `https://ezyproperty.id`.

### B.3 Upload & pasang API

1. Buat folder `ezyproperty-api`, upload `api.zip` → **Extract** (isi: `dist/`, `package.json`).
2. **Setup Node.js App** → **Create Application**:
   - Node.js version: **22** (atau 20)
   - Application root: `ezyproperty-api`
   - Application URL: `api.ezyproperty.id`
   - Application startup file: `dist/index.js`
   - Environment variables: `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (lihat 0.1). `PORT` **tidak perlu** — diatur oleh hosting.
3. Klik **Run NPM Install** (memasang dependensi dari `package.json`), lalu **Restart**.
4. Cek `https://api.ezyproperty.id/api/v1/health` → harus `{"success":true,...}`.

### B.4 SSL

cPanel → **SSL/TLS Status** → jalankan **AutoSSL** untuk `ezyproperty.id` dan `api.ezyproperty.id`.

### B.5 Update aplikasi

Ulangi B.1 (build ulang), lalu upload & extract zip baru menimpa folder lama, dan klik **Restart** di Setup Node.js App. Untuk API, klik **Run NPM Install** lagi hanya bila dependensi berubah.

### B.6 Troubleshooting shared hosting

| Gejala | Kemungkinan penyebab |
|---|---|
| "Incomplete response" / 503 | Lihat `stderr.log` di folder aplikasi. Sering karena startup file salah atau versi Node < 20 |
| Halaman tampil tanpa CSS | Folder `.next/static` belum disalin ke `apps/web/.next/static` (langkah B.1) |
| Error `sharp` / gambar tidak tampil | Paket di-build di Windows. Build ulang di Linux, atau build dengan `NEXT_IMAGES_UNOPTIMIZED=1` |
| Daftar properti kosong | `NEXT_PUBLIC_API_URL` salah saat build, atau API mati — cek URL health API |
| Form tambah listing gagal (CORS) | `CORS_ORIGIN` di API tidak sama persis dengan alamat web (cek `https`, `www`) |
| Link verifikasi email ke aplikasi lain | `https://ezyproperty.id/**` belum ditambahkan di Supabase Redirect URLs |
| Proses dimatikan hosting / sering restart | Batas RAM tercapai — pertimbangkan VPS |

---

## Checklist setelah deploy

- [ ] `https://api.ezyproperty.id/api/v1/health` mengembalikan `success: true`
- [ ] Beranda dan `/properti` menampilkan listing beserta foto
- [ ] Filter & pagination di `/properti` berfungsi
- [ ] Halaman detail listing terbuka (klik salah satu kartu)
- [ ] Daftar akun baru → email verifikasi mengarah ke `https://ezyproperty.id/login`
- [ ] Login → dashboard menampilkan listing milik akun
- [ ] Tambah listing baru (dengan foto) berhasil masuk ke "Menunggu moderasi"
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **tidak** ada di environment web maupun di file yang ter-upload ke web
