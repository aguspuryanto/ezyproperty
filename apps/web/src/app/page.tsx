import Link from "next/link";
import { Search, ShieldCheck, MessageCircle, ArrowRight, Home, MapPin, KeyRound } from "lucide-react";
import { Header } from "@/components/header";
import { PropertyCard } from "@/components/property-card";
import { Pager } from "@/components/pager";
import { searchProperties } from "@/lib/api";

const PAGE_SIZE = 9; // 3 rows x 3 cards, same as /properti

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { data: properties, pagination } = await searchProperties({ limit: String(PAGE_SIZE), page: String(page) });
  const { total, totalPages } = pagination;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  // Keep the visitor at the listing section when paging.
  const pageHref = (p: number) => (p > 1 ? `/?page=${p}#properti` : "/#properti");

  return (
    <>
      <Header/>
      <main>
        <section className="relative isolate overflow-hidden bg-[#073f30]">
          <div className="absolute inset-0 -z-10 opacity-25" style={{backgroundImage:"linear-gradient(90deg,#073f30 0%,transparent 100%),url(https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1800&q=85)",backgroundSize:"cover",backgroundPosition:"center"}}/>
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1.05fr_.95fr] md:py-28 lg:px-8">
            <div className="max-w-2xl text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"><Home size={14}/> Marketplace properti Indonesia</span>
              <h1 className="mt-6 text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">Temukan tempat untuk <span className="text-[#9be2bd]">cerita barumu.</span></h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/80 sm:text-lg">Jelajahi pilihan rumah, apartemen, tanah, dan properti dari agen terpercaya.</p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
                <Link href="/properti?transaction=sale" className="rounded-full bg-white px-5 py-3 text-[#075b42] hover:bg-emerald-50">Cari properti</Link>
                <Link href="/register" className="rounded-full border border-white/30 px-5 py-3 text-white hover:bg-white/10">Gabung sebagai agen</Link>
              </div>
            </div>
            <form action="/properti" className="rounded-3xl bg-white p-5 shadow-2xl shadow-black/20 sm:p-7">
              <h2 className="text-xl font-extrabold text-slate-900">Cari properti impian</h2>
              <p className="mt-1 text-sm text-slate-500">Mulai dari lokasi dan kebutuhanmu.</p>
              <div className="mt-5 flex gap-2 rounded-xl bg-emerald-50 p-1">
                <button name="transaction" value="sale" className="flex-1 rounded-lg bg-[#087a55] px-3 py-2.5 text-sm font-bold text-white">Dijual</button>
                <button name="transaction" value="rent" className="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white">Disewa</button>
              </div>
              <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500">Lokasi atau kata kunci</label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3.5"><MapPin size={18} className="text-[#087a55]"/><input name="q" placeholder="Contoh: Surabaya Barat" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"/></div>
              <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">Tipe properti</label>
              <select name="type" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-700 outline-none focus:border-[#087a55]">
                <option value="">Semua tipe properti</option><option value="house">Rumah</option><option value="apartment">Apartemen</option><option value="land">Tanah</option><option value="shop">Ruko</option><option value="villa">Villa</option>
              </select>
              <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#087a55] px-5 py-4 text-sm font-bold text-white hover:bg-[#075b42]"><Search size={18}/> Cari Properti</button>
            </form>
          </div>
        </section>

        <section id="properti" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-sm font-bold uppercase tracking-wider text-[#087a55]">Pilihan untukmu</p><h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Semua properti</h2><p className="mt-2 text-sm text-slate-500">{properties.length ? <>Menampilkan <b className="text-slate-700">{from}–{to}</b> dari <b className="text-slate-700">{total}</b> properti.</> : "Temukan properti yang sesuai dengan rencana hidupmu."}</p></div>
            <Link href="/properti" className="flex items-center gap-2 text-sm font-bold text-[#087a55] hover:underline">Cari dengan filter <ArrowRight size={16}/></Link>
          </div>
          {properties.length ? (
            <>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{properties.map((property) => <PropertyCard key={property.id} property={property}/>)}</div>
              {totalPages > 1 && <Pager page={page} totalPages={totalPages} hrefFor={pageHref}/>}
            </>
          ) : page > 1 && total > 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-emerald-200 bg-white p-10 text-center">
              <h3 className="font-bold text-slate-900">Halaman {page} tidak tersedia</h3><Link href="/#properti" className="mt-4 inline-block text-sm font-bold text-[#087a55]">Kembali ke halaman 1</Link>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-emerald-200 bg-white p-10 text-center">
              <Home className="mx-auto text-[#087a55]" size={32}/><h3 className="mt-3 font-bold text-slate-900">Listing segera hadir</h3><p className="mt-1 text-sm text-slate-500">Belum ada properti yang dipublikasikan. Agen dapat mendaftar dan mulai menambahkan listing.</p><Link href="/register" className="mt-5 inline-flex rounded-full bg-[#087a55] px-5 py-3 text-sm font-bold text-white">Daftar sebagai agen</Link>
            </div>
          )}
        </section>

        <section id="cara-kerja" className="border-y border-emerald-100 bg-[#edf7f1]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-xl text-center"><p className="text-sm font-bold uppercase tracking-wider text-[#087a55]">Mudah dan terpercaya</p><h2 className="mt-2 text-3xl font-black text-slate-900">Temukan properti dengan lebih mudah</h2></div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[{icon:Search,title:"Cari sesuai kebutuhan",desc:"Gunakan pencarian untuk menemukan properti berdasarkan lokasi dan tipe."},{icon:ShieldCheck,title:"Terhubung dengan agen",desc:"Dapatkan informasi properti langsung dari agen yang memasang listing."},{icon:MessageCircle,title:"Konsultasi dengan mudah",desc:"Hubungi agen untuk bertanya dan menjadwalkan kunjungan."}].map(({icon:Icon,title,desc})=><div key={title} className="rounded-2xl bg-white p-6"><div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#087a55]"><Icon size={23}/></div><h3 className="mt-5 font-extrabold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p></div>)}
            </div>
          </div>
        </section>
        <section id="tentang" className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8"><KeyRound className="mx-auto text-[#087a55]" size={28}/><h2 className="mt-3 text-2xl font-black text-slate-900">Punya listing properti?</h2><p className="mt-2 text-sm text-slate-500">Bergabunglah dengan EzyProperty dan jangkau lebih banyak calon pembeli.</p><Link href="/register" className="mt-5 inline-flex rounded-full bg-[#087a55] px-6 py-3 text-sm font-bold text-white">Mulai sebagai agen</Link></section>
      </main>
      <footer className="bg-[#073f30] text-emerald-50"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 py-8 text-sm sm:flex-row sm:px-6 lg:px-8"><span className="font-extrabold">ezyproperty</span><span className="text-emerald-100/70">© {new Date().getFullYear()} EzyProperty. Temukan tempat untuk cerita barumu.</span></div></footer>
    </>
  );
}
