import Link from "next/link";
import { Header } from "@/components/header";
import { PropertyCard } from "@/components/property-card";
import { getCities, searchProperties } from "@/lib/api";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Pager } from "@/components/pager";

export const metadata = { title: "Cari Properti", description: "Cari rumah, apartemen, tanah, dan properti di EzyProperty." };

const PAGE_SIZE = 9; // 3 rows x 3 cards

const TRANSACTIONS = [
  { value: "", label: "Semua" },
  { value: "sale", label: "Dijual" },
  { value: "rent", label: "Disewa" },
];

const TYPES = [
  { value: "house", label: "Rumah" },
  { value: "apartment", label: "Apartemen" },
  { value: "land", label: "Tanah" },
  { value: "shop", label: "Ruko" },
  { value: "villa", label: "Villa" },
  { value: "warehouse", label: "Gudang" },
  { value: "other", label: "Lainnya" },
];

const STATUSES = [
  { value: "", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "expired", label: "Kadaluarsa" },
];

const PRICES = [100e6, 250e6, 500e6, 750e6, 1e9, 2e9, 5e9, 10e9];
const BEDROOMS = ["1", "2", "3", "4"];

// Filter keys accepted from the URL and forwarded to the API.
const FILTER_KEYS = ["q", "status", "transaction", "type", "city", "minPrice", "maxPrice", "bedrooms"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Partial<Record<FilterKey, string>>;

function priceLabel(value: number) {
  return value >= 1e9 ? `Rp${value / 1e9} M` : `Rp${value / 1e6} jt`;
}

function hrefWith(filters: Filters, changes: Partial<Record<FilterKey | "page", string | undefined>>) {
  const sp = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...filters, ...changes };
  for (const [key, value] of Object.entries(merged)) {
    if (value && !(key === "page" && value === "1")) sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `/properti?${s}` : "/properti";
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = params[key]?.trim();
    if (value) filters[key] = value;
  }
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [{ data: properties, pagination, ok }, cities] = await Promise.all([
    searchProperties({ ...(filters as Record<string, string>), limit: String(PAGE_SIZE), page: String(page) }),
    getCities(),
  ]);

  const { total, totalPages } = pagination;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);

  const activeChips: { key: FilterKey; label: string }[] = [];
  if (filters.q) activeChips.push({ key: "q", label: `"${filters.q}"` });
  if (filters.status) activeChips.push({ key: "status", label: STATUSES.find(s => s.value === filters.status)?.label ?? filters.status });
  if (filters.transaction) activeChips.push({ key: "transaction", label: TRANSACTIONS.find(t => t.value === filters.transaction)?.label ?? filters.transaction });
  if (filters.type) activeChips.push({ key: "type", label: TYPES.find(t => t.value === filters.type)?.label ?? filters.type });
  if (filters.city) activeChips.push({ key: "city", label: filters.city });
  if (filters.minPrice) activeChips.push({ key: "minPrice", label: `≥ ${priceLabel(Number(filters.minPrice))}` });
  if (filters.maxPrice) activeChips.push({ key: "maxPrice", label: `≤ ${priceLabel(Number(filters.maxPrice))}` });
  if (filters.bedrooms) activeChips.push({ key: "bedrooms", label: `${filters.bedrooms}+ KT` });

  return <><Header/><main className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <p className="text-sm font-bold text-[#087a55]">Jelajahi properti</p>
    <h1 className="mt-2 text-3xl font-black text-slate-900">Temukan properti pilihan</h1>

    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[280px_1fr]">
      {/* Sidebar filter */}
      <aside className="lg:sticky lg:top-24">
        <details open className="group rounded-2xl border border-slate-100 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-extrabold text-slate-900 lg:hidden">
            <span className="flex items-center gap-2"><SlidersHorizontal size={18}/> Filter{activeChips.length ? ` (${activeChips.length})` : ""}</span>
            <span className="text-xs font-bold text-[#087a55] group-open:hidden">Tampilkan</span>
            <span className="hidden text-xs font-bold text-[#087a55] group-open:inline">Sembunyikan</span>
          </summary>
          <form action="/properti" className="space-y-6 border-t border-slate-100 p-5 lg:border-t-0">
            <h2 className="hidden items-center gap-2 font-extrabold text-slate-900 lg:flex"><SlidersHorizontal size={18}/> Filter</h2>

            <Field label="Kata kunci" htmlFor="f-q">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-[#087a55]">
                <Search size={16} className="shrink-0 text-slate-400"/>
                <input id="f-q" name="q" defaultValue={filters.q} placeholder="Lokasi, perumahan…" className="w-full bg-transparent py-2.5 text-sm outline-none"/>
              </div>
            </Field>

            <Field label="Status listing">
              <div className="grid grid-cols-3 gap-2">
                {STATUSES.map(s => <label key={s.value || "all"} className="cursor-pointer">
                  <input type="radio" name="status" value={s.value} defaultChecked={(filters.status ?? "") === s.value} className="peer sr-only"/>
                  <span className="block rounded-lg border border-slate-200 px-1 py-2 text-center text-xs font-bold text-slate-600 peer-checked:border-[#087a55] peer-checked:bg-[#087a55] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#087a55]/40">{s.label}</span>
                </label>)}
              </div>
            </Field>

            <Field label="Jenis transaksi">
              <div className="grid grid-cols-3 gap-2">
                {TRANSACTIONS.map(t => <label key={t.value || "all"} className="cursor-pointer">
                  <input type="radio" name="transaction" value={t.value} defaultChecked={(filters.transaction ?? "") === t.value} className="peer sr-only"/>
                  <span className="block rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-600 peer-checked:border-[#087a55] peer-checked:bg-[#087a55] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#087a55]/40">{t.label}</span>
                </label>)}
              </div>
            </Field>

            <Field label="Tipe properti" htmlFor="f-type">
              <select id="f-type" name="type" defaultValue={filters.type ?? ""} className={selectClass}>
                <option value="">Semua tipe</option>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>

            <Field label="Kota" htmlFor="f-city">
              <select id="f-city" name="city" defaultValue={filters.city ?? ""} className={selectClass}>
                <option value="">Semua kota</option>
                {cities.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
                {filters.city && !cities.some(c => c.name === filters.city) && <option value={filters.city}>{filters.city}</option>}
              </select>
            </Field>

            <Field label="Rentang harga">
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Harga minimum" name="minPrice" defaultValue={filters.minPrice ?? ""} className={selectClass}>
                  <option value="">Min</option>
                  {PRICES.map(p => <option key={p} value={p}>{priceLabel(p)}</option>)}
                </select>
                <select aria-label="Harga maksimum" name="maxPrice" defaultValue={filters.maxPrice ?? ""} className={selectClass}>
                  <option value="">Maks</option>
                  {PRICES.map(p => <option key={p} value={p}>{priceLabel(p)}</option>)}
                </select>
              </div>
            </Field>

            <Field label="Kamar tidur">
              <div className="grid grid-cols-5 gap-2">
                {["", ...BEDROOMS].map(b => <label key={b || "all"} className="cursor-pointer">
                  <input type="radio" name="bedrooms" value={b} defaultChecked={(filters.bedrooms ?? "") === b} className="peer sr-only"/>
                  <span className="block rounded-lg border border-slate-200 py-2 text-center text-xs font-bold text-slate-600 peer-checked:border-[#087a55] peer-checked:bg-[#087a55] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#087a55]/40">{b ? `${b}+` : "Semua"}</span>
                </label>)}
              </div>
            </Field>

            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-[#087a55] px-4 py-3 text-sm font-bold text-white hover:bg-[#075b42]">Terapkan</button>
              {activeChips.length > 0 && <Link href="/properti" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Reset</Link>}
            </div>
          </form>
        </details>
      </aside>

      {/* Results */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-sm text-slate-500">
            {properties.length ? <>Menampilkan <b className="text-slate-800">{from}–{to}</b> dari <b className="text-slate-800">{total}</b> properti</> : `${total} properti ditemukan`}
          </p>
          {activeChips.map(chip => <Link key={chip.key} href={hrefWith(filters, { [chip.key]: undefined, page: undefined })} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#087a55] hover:bg-emerald-100" aria-label={`Hapus filter ${chip.label}`}>
            {chip.label} <X size={12}/>
          </Link>)}
        </div>

        {properties.length ? <>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{properties.map(p => <PropertyCard key={p.id} property={p}/>)}</div>
          {totalPages > 1 && <Pager page={page} totalPages={totalPages} hrefFor={p => hrefWith(filters, { page: String(p) })}/>}
        </> : <div className="mt-5 rounded-2xl border border-dashed bg-white p-12 text-center">
          {!ok ? <><p className="font-bold">Daftar properti sedang tidak dapat dimuat.</p><p className="mt-2 text-sm text-slate-500">Silakan coba beberapa saat lagi.</p></>
            : page > 1 && total > 0 ? <><p className="font-bold">Halaman {page} tidak tersedia.</p><Link href={hrefWith(filters, { page: undefined })} className="mt-4 inline-block text-sm font-bold text-[#087a55]">Kembali ke halaman 1</Link></>
            : <><p className="font-bold">Belum ada properti yang cocok.</p><p className="mt-2 text-sm text-slate-500">Coba ubah atau kurangi filter.</p>{activeChips.length > 0 && <Link href="/properti" className="mt-4 inline-block text-sm font-bold text-[#087a55]">Reset semua filter</Link>}</>}
        </div>}
      </section>
    </div>
  </main></>;
}

const selectClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#087a55]";

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return <div>
    {htmlFor ? <label htmlFor={htmlFor} className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>
      : <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>}
    {children}
  </div>;
}
