# Panduan Migrasi EzyProperty: Supabase → Google Cloud (GCP)

> Status data saat panduan ini ditulis (20 Nov 2026): 110 listing, 252 foto (semua URL CDN Brighton, bukan file di Supabase), 1 akun agen, bucket Storage `ezyproperty-documents` **kosong**.
> Artinya **memindahkan data itu ringan** — pekerjaan utamanya ada di **kode aplikasi**.

---

## 1. Apa saja yang saat ini dikerjakan Supabase

| Fungsi Supabase | Dipakai untuk | Padanan di GCP |
|---|---|---|
| **PostgreSQL** (schema `ezy`) | Semua data listing, foto, profil, leads | **Cloud SQL for PostgreSQL** |
| **Data API (PostgREST) + RLS** | Web & API membaca/menulis tabel lewat `supabase.from(...)`; RLS membatasi siapa melihat apa | **Tidak ada padanan langsung** → query SQL di API (Cloud Run) + aturan akses di kode |
| **Auth** | Daftar, login, sesi (cookie), verifikasi email, token JWT untuk API | **Identity Platform** (Firebase Authentication) |
| **Storage** | Upload foto listing baru (`ezyproperty-documents`) | **Cloud Storage** |
| *(hosting web & API — belum ada)* | — | **Cloud Run** |

Catatan penting: project Supabase saat ini **dipakai bersama aplikasi lain** (schema `public` dan semua user di `auth.users`). Yang dimigrasi **hanya schema `ezy` dan user milik EzyProperty**. Jangan pernah menghapus project Supabase — hanya schema `ezy` setelah migrasi selesai.

---

## 2. Pilih jalur

| | **Jalur A — Self-host Supabase di GCP** | **Jalur B — GCP-native** (disarankan) |
|---|---|---|
| Isi | Menjalankan Supabase open-source (Docker) di Compute Engine | Cloud SQL + Identity Platform + Cloud Storage + Cloud Run |
| Perubahan kode | **Hampir nol** — cukup ganti URL & kunci | **Besar** — ±12 file (lihat bagian 7) |
| Waktu | ± 1 hari | ± 3–5 hari kerja developer + uji |
| Beban operasional | **Tinggi**: Anda yang mengurus update, backup, keamanan, SMTP email, monitoring belasan container | **Rendah**: semua layanan terkelola (managed) Google |
| Cocok jika | Ingin cepat keluar dari Supabase cloud / pisah dari aplikasi lain, tanpa ubah kode | Ingin benar-benar di GCP untuk jangka panjang |

**Rekomendasi: Jalur B.** Datanya kecil dan titik sentuh Supabase di kode sedikit, jadi biaya rewrite sekali bayar lebih murah daripada merawat stack Supabase sendiri selamanya. Pilih Jalur A hanya jika butuh pindah dalam hitungan hari.

Region yang disarankan untuk semua layanan: **`asia-southeast2` (Jakarta)**.

---

## 3. Persiapan (kedua jalur)

```bash
# Install Google Cloud CLI, lalu:
gcloud auth login
gcloud projects create ezyproperty-prod          # atau pakai project yang ada
gcloud config set project ezyproperty-prod
gcloud config set run/region asia-southeast2
# Aktifkan billing di Console, lalu aktifkan API yang dibutuhkan:
gcloud services enable sqladmin.googleapis.com run.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  identitytoolkit.googleapis.com storage.googleapis.com compute.googleapis.com
```

Alat lain: `psql` & `pg_dump` (PostgreSQL 15+), Node.js 22, `firebase-tools` (`npm i -g firebase-tools`), dan [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy).

**Connection string Supabase**: Dashboard → **Connect** → *Session pooler* (atau *Direct connection*), formatnya:
`postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
Simpan sebagai variabel `SUPABASE_DB_URL` di terminal Anda (jangan di-commit).

---

## 4. Jalur A — Self-host Supabase di Compute Engine (ringkas)

1. Buat VM: `e2-standard-2` (2 vCPU, 8 GB), Ubuntu 24.04, disk 50 GB, region Jakarta. Install Docker.
2. Ikuti panduan resmi *Self-Hosting with Docker* Supabase: clone repo `supabase/supabase`, salin folder `docker/`, isi `.env` (**ganti semua secret default**: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, password dashboard), set `PGRST_DB_SCHEMAS=public,storage,graphql_public,ezy`, dan konfigurasi SMTP agar email verifikasi terkirim.
3. Pasang Nginx + SSL di depan Kong (port 8000), mis. `https://supabase.ezyproperty.id`.
4. Jalankan `supabase/migrations/0001_init.sql` lalu `0002_public_archived_listings.sql` di instance baru.
5. Pindahkan user EzyProperty (lengkap dengan hash password) dan data `ezy`:

```bash
# User EzyProperty saja (yang punya baris di ezy.profiles), beserta hash password-nya
psql "$SUPABASE_DB_URL" -c "\copy (select u.* from auth.users u join ezy.profiles p on p.id = u.id) to 'users.csv' csv header"
psql "$SUPABASE_DB_URL" -c "\copy (select i.* from auth.identities i join ezy.profiles p on p.id = i.user_id) to 'identities.csv' csv header"
pg_dump "$SUPABASE_DB_URL" --data-only --schema=ezy --no-owner --no-privileges -f ezy-data.sql

# Di instance baru (urutan penting: user dulu, baru data ezy)
psql "$NEW_DB_URL" -c "\copy auth.users from 'users.csv' csv header"
psql "$NEW_DB_URL" -c "\copy auth.identities from 'identities.csv' csv header"
psql "$NEW_DB_URL" -f ezy-data.sql
```
   Jika versi Supabase berbeda dan kolom `auth.users` tidak cocok, sebutkan kolom secara eksplisit di kedua `\copy`.
6. Ganti env di web & API ke URL/kunci baru, deploy (lihat [DEPLOY.md](DEPLOY.md)). Selesai — tidak ada perubahan kode.

Kewajiban rutin setelahnya: backup database (mis. `pg_dump` terjadwal ke Cloud Storage), update image Supabase berkala, pantau disk & memori VM.

---

## 5. Jalur B — GCP-native: infrastruktur

### 5.1 Cloud SQL

```bash
gcloud sql instances create ezy-db \
  --database-version=POSTGRES_16 --region=asia-southeast2 \
  --edition=enterprise --tier=db-g1-small \
  --storage-size=10GB --storage-auto-increase \
  --backup-start-time=18:00 --availability-type=zonal
gcloud sql databases create ezyproperty --instance=ezy-db
gcloud sql users create ezy_app --instance=ezy-db --password='<PASSWORD-KUAT>'
```

Koneksi dari laptop (untuk migrasi): jalankan `cloud-sql-proxy <PROJECT>:asia-southeast2:ezy-db` lalu
`export GCP_DB_URL=postgresql://ezy_app:<PASSWORD>@127.0.0.1:5432/ezyproperty`.

### 5.2 Skema database untuk Cloud SQL

`0001_init.sql` tidak bisa dipakai apa adanya karena bergantung pada fitur Supabase. Buat salinan `gcp/sql/0001_schema.sql` dari `supabase/migrations/0001_init.sql` dengan perubahan berikut:

| Di `0001_init.sql` (Supabase) | Ubah menjadi (Cloud SQL) | Alasan |
|---|---|---|
| `id uuid primary key references auth.users(id)` di `ezy.profiles` | `id text primary key` | Tidak ada `auth.users`; UID Identity Platform berupa teks (user lama tetap memakai UUID-nya sebagai teks) |
| `agent_id uuid` (properties, leads), `user_id uuid` (favorites) | `text` | Mengikuti tipe `profiles.id` |
| Semua `grant ... to anon, authenticated, service_role` | Hapus; cukup `grant usage on schema ezy to ezy_app; grant select, insert, update, delete on all tables in schema ezy to ezy_app;` | Role tersebut khas Supabase |
| Semua `alter table ... enable row level security` dan `create policy ...` | Hapus | `auth.uid()` tidak ada; aturan akses pindah ke kode API (bagian 7) |
| `notify pgrst, 'reload schema'` | Hapus | Tidak ada PostgREST |

Bagian lain (enum, tabel, index, trigger `set_updated_at`, kolom `search_vector`) tetap sama. Jalankan:

```bash
psql "$GCP_DB_URL" -f gcp/sql/0001_schema.sql
```

### 5.3 Pindahkan data `ezy`

```bash
# Ekspor data saja (kolom generated search_vector otomatis tidak ikut & dihitung ulang)
pg_dump "$SUPABASE_DB_URL" --data-only --schema=ezy --no-owner --no-privileges \
  --table=ezy.profiles --table=ezy.properties --table=ezy.property_images \
  --table=ezy.leads --table=ezy.property_favorites -f ezy-data.sql

psql "$GCP_DB_URL" -v ON_ERROR_STOP=1 -f ezy-data.sql

# Cek jumlah — harus sama dengan di Supabase
psql "$GCP_DB_URL" -c "select status, count(*) from ezy.properties group by status;"
psql "$GCP_DB_URL" -c "select count(*) from ezy.property_images;"
```

### 5.4 Pindahkan akun ke Identity Platform (password tetap berlaku)

1. Console → **Identity Platform** → Enable → **Add a provider** → *Email / Password*. Aktifkan juga di project Firebase yang sama (Identity Platform = Firebase Auth).
2. Ekspor **hanya** user EzyProperty dari Supabase:

```bash
psql "$SUPABASE_DB_URL" -At -c "
  select json_agg(json_build_object(
    'id', u.id, 'email', u.email, 'hash', u.encrypted_password,
    'verified', u.email_confirmed_at is not null,
    'name', coalesce(u.raw_user_meta_data->>'full_name','')))
  from auth.users u join ezy.profiles p on p.id = u.id" > supabase-users.json
```

3. Ubah ke format impor Firebase (hash Supabase = bcrypt):

```bash
node -e '
const u = require("./supabase-users.json");
const users = u.map(x => ({
  localId: x.id,                                   // pakai UUID lama → agent_id di database tetap cocok
  email: x.email, emailVerified: x.verified, displayName: x.name,
  passwordHash: Buffer.from(x.hash).toString("base64")
}));
require("fs").writeFileSync("firebase-users.json", JSON.stringify({ users }, null, 2));
'
firebase auth:import firebase-users.json --hash-algo=BCRYPT --project ezyproperty-prod
```

4. Hapus `supabase-users.json` & `firebase-users.json` setelah selesai (berisi hash password).
5. Uji login dengan akun lama di aplikasi versi baru (bagian 7).

### 5.5 Cloud Storage

```bash
gcloud storage buckets create gs://ezyproperty-media --location=asia-southeast2 --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://ezyproperty-media \
  --member=allUsers --role=roles/storage.objectViewer        # foto listing dapat dilihat publik
```

Saat ini bucket Supabase **kosong** — tidak ada file yang perlu disalin. Jika nanti sudah ada isinya sebelum migrasi:
1. Salin dengan `rclone` (remote S3 ke endpoint S3 Supabase Storage → remote GCS), lalu
2. Perbarui URL di database:
```sql
update ezy.properties set cover_image_url = replace(cover_image_url,
  'https://<ref>.supabase.co/storage/v1/object/public/ezyproperty-documents/',
  'https://storage.googleapis.com/ezyproperty-media/') where cover_image_url like '%supabase.co%';
update ezy.property_images set image_url = replace(image_url,
  'https://<ref>.supabase.co/storage/v1/object/public/ezyproperty-documents/',
  'https://storage.googleapis.com/ezyproperty-media/') where image_url like '%supabase.co%';
```

Tambahkan `storage.googleapis.com` ke `images.remotePatterns` di `apps/web/next.config.ts`.

### 5.6 Secret Manager & service account

```bash
printf '%s' 'postgresql://ezy_app:<PASSWORD>@/ezyproperty?host=/cloudsql/<PROJECT>:asia-southeast2:ezy-db' \
  | gcloud secrets create ezy-database-url --data-file=-

gcloud iam service-accounts create ezy-api
for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/storage.objectAdmin roles/iam.serviceAccountTokenCreator; do
  gcloud projects add-iam-policy-binding ezyproperty-prod \
    --member=serviceAccount:ezy-api@ezyproperty-prod.iam.gserviceaccount.com --role=$role
done
```
(`serviceAccountTokenCreator` diperlukan untuk membuat signed URL upload dari Cloud Run.)

---

## 6. Jalur B — Deploy ke Cloud Run

**API**

```bash
gcloud run deploy ezy-api --source apps/api \
  --service-account=ezy-api@ezyproperty-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances=ezyproperty-prod:asia-southeast2:ezy-db \
  --set-secrets=DATABASE_URL=ezy-database-url:latest \
  --set-env-vars=CORS_ORIGIN=https://ezyproperty.id,GCS_BUCKET=ezyproperty-media,FIREBASE_PROJECT_ID=ezyproperty-prod \
  --allow-unauthenticated
```

**Web** — pakai mode standalone yang sudah ada. Tambahkan `apps/web/Dockerfile`:

```dockerfile
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_API_URL NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_OUTPUT=standalone
RUN pnpm --filter @ezyproperty/web build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
CMD ["node", "apps/web/server.js"]
```

Build & deploy (dijalankan dari root repo):

```bash
gcloud artifacts repositories create ezy --repository-format=docker --location=asia-southeast2
gcloud builds submit --tag asia-southeast2-docker.pkg.dev/ezyproperty-prod/ezy/web \
  --file apps/web/Dockerfile .      # sertakan --build-arg / cloudbuild.yaml untuk NEXT_PUBLIC_*
gcloud run deploy ezy-web --image asia-southeast2-docker.pkg.dev/ezyproperty-prod/ezy/web --allow-unauthenticated
```

**Domain**: Cloud Run → *Manage custom domains* (atau Global External Application Load Balancer untuk kontrol penuh) → petakan `ezyproperty.id` ke `ezy-web` dan `api.ezyproperty.id` ke `ezy-api`.

---

## 7. Jalur B — Perubahan kode

Semua akses database dipusatkan di **API**; web tidak lagi membaca database langsung. Aturan akses yang dulu dikerjakan RLS sekarang ditulis di query API.

| File | Sekarang (Supabase) | Diganti menjadi |
|---|---|---|
| `apps/api/src/lib/supabase.ts` | `supabase-js` (anon & service key) | `lib/db.ts` — koneksi `pg` / `postgres` ke Cloud SQL lewat `DATABASE_URL` |
| `apps/api/src/middleware/auth.ts` | `supabase.auth.getUser(token)` | `firebase-admin`: `getAuth().verifyIdToken(token)` → `uid` |
| `apps/api/src/modules/properties.ts` | `supabase.from(...)` + RLS | SQL eksplisit. Filter publik **wajib**: `status in ('published','archived')`. Pencarian: `search_vector @@ websearch_to_tsquery('simple', $1)`. Halaman: `limit/offset` + `count(*) over()` |
| *(baru)* `apps/api/src/modules/me.ts` | — | `GET /me` (profil, dibuat otomatis jika belum ada), `GET /me/properties?status&page` + jumlah per status — menggantikan query di dashboard. Semua query difilter `agent_id = uid` |
| *(baru)* `POST /uploads` di API | — | Membuat **signed URL v4** Cloud Storage (PUT) untuk 1 file foto; validasi tipe & ukuran |
| `apps/web/src/lib/supabase/*` | Klien Supabase | `lib/firebase.ts` (Firebase JS SDK, client) + `lib/session.ts` (`firebase-admin` `verifySessionCookie`, server) |
| `apps/web/src/components/auth-form.tsx` | `signUp` / `signInWithPassword` | `createUserWithEmailAndPassword` + `sendEmailVerification` / `signInWithEmailAndPassword`, lalu kirim ID token ke route `/api/session` |
| *(baru)* `apps/web/src/app/api/session/route.ts` | — | `POST`: tukar ID token → **session cookie** httpOnly (`createSessionCookie`); `DELETE`: hapus cookie (logout) |
| `apps/web/src/middleware.ts` | `supabase.auth.getUser()` | Cek keberadaan cookie sesi; redirect ke `/login` jika tidak ada (verifikasi penuh di server component) |
| `apps/web/src/components/header.tsx`, `dashboard/page.tsx`, `dashboard/properties/new/page.tsx` | `supabase.auth.getUser()` + `supabase.from(...)` | `verifySessionCookie()` + panggil `GET /me...` di API |
| `apps/web/src/app/dashboard/actions.ts` | `supabase.auth.signOut()` | Hapus cookie sesi + `signOut` Firebase di client |
| `apps/web/src/components/new-property-form.tsx` | `supabase.storage.upload` | Minta signed URL ke `POST /uploads`, `PUT` file langsung ke Cloud Storage, simpan URL publiknya |
| `scripts/brighton_to_sql.py` | Menulis SQL untuk Supabase | Hapus bagian `auth.users`; ambil `agent_id` dari `ezy.profiles` berdasarkan email |

Dependensi: tambah `pg` (atau `postgres`), `firebase-admin`, `@google-cloud/storage` di API; `firebase` dan `firebase-admin` di web. Hapus `@supabase/supabase-js` dan `@supabase/ssr` setelah semua beralih.

Variabel environment baru:

| Web | API |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` | `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `GCS_BUCKET`, `CORS_ORIGIN` |

Di Cloud Run, `firebase-admin` dan `@google-cloud/storage` otomatis memakai service account — tidak perlu file kunci JSON.

---

## 8. Rencana cutover (hari-H)

1. **Seminggu sebelumnya**: selesaikan bagian 5–7 di environment staging; uji penuh dengan data salinan.
2. **Bekukan perubahan**: minta agen tidak menambah/mengubah listing selama ± 1 jam.
3. **Sinkron terakhir**: ulangi 5.3 (kosongkan tabel di Cloud SQL dulu dengan `truncate ezy.property_favorites, ezy.leads, ezy.property_images, ezy.properties, ezy.profiles;`) dan 5.4 untuk user baru, bila ada.
4. **Pindahkan DNS** `ezyproperty.id` & `api.ezyproperty.id` ke Cloud Run.
5. **Uji checklist** (bagian 10).
6. **Masa aman 2 minggu**: biarkan data `ezy` di Supabase apa adanya sebagai cadangan (rollback = kembalikan DNS ke deployment lama).
7. **Bersihkan Supabase** — hanya bagian EzyProperty:
   ```sql
   drop schema ezy cascade;   -- JANGAN hapus project: dipakai aplikasi lain
   ```
   Hapus juga user EzyProperty dari Supabase Auth (Dashboard → Authentication → Users) **hanya jika** mereka bukan pengguna aplikasi lain, dan keluarkan `ezy` dari *Exposed schemas*.

---

## 9. Biaya & operasional (Jalur B)

- **Cloud SQL** adalah komponen termahal karena berjalan 24 jam; `db-g1-small` cukup untuk awal, naikkan tier bila CPU/RAM sering penuh. Aktifkan backup otomatis (sudah di 5.1).
- **Cloud Run** ditagih saat melayani request; set `--min-instances=1` pada `ezy-web` bila ingin menghindari cold start (menambah biaya).
- **Identity Platform** gratis untuk jumlah pengguna aktif bulanan yang kecil; cek kuota di halaman harga.
- Pasang **Budget alert** di Billing agar tidak kaget.
- Cek harga terkini di [cloud.google.com/pricing](https://cloud.google.com/pricing) — angka berubah dari waktu ke waktu.

---

## 10. Checklist setelah migrasi

- [ ] Jumlah listing per status & jumlah foto di Cloud SQL sama dengan di Supabase
- [ ] Beranda & `/properti`: 110 listing, filter, pencarian kata kunci, pagination berjalan
- [ ] Halaman detail listing aktif & kadaluarsa terbuka; listing draft/pending **tidak** bisa dibuka publik
- [ ] Login dengan akun lama berhasil **tanpa reset password**
- [ ] Daftar akun baru → email verifikasi diterima → bisa login
- [ ] Dashboard hanya menampilkan listing milik akun yang login
- [ ] Tambah listing + upload foto → file masuk `gs://ezyproperty-media`, listing berstatus "Menunggu moderasi"
- [ ] Logout menghapus sesi; `/dashboard` kembali mengarah ke `/login`
- [ ] Tidak ada lagi variabel `SUPABASE_*` di Cloud Run maupun di build web
