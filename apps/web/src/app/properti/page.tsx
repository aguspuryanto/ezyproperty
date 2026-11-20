import Link from "next/link";
import { Header } from "@/components/header";
import { PropertyCard } from "@/components/property-card";
import { getProperties } from "@/lib/api";
import { Search } from "lucide-react";

export const metadata = { title: "Cari Properti", description: "Cari rumah, apartemen, tanah, dan properti di EzyProperty." };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const properties = await getProperties({
    ...(params.q ? { q: params.q } : {}),
    ...(params.transaction ? { transaction: params.transaction } : {}),
    ...(params.type ? { type: params.type } : {}),
    limit: "24"
  });
  return <><Header/><main className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <p className="text-sm font-bold text-[#087a55]">Jelajahi properti</p><h1 className="mt-2 text-3xl font-black text-slate-900">Temukan properti pilihan</h1>
    <form className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px_auto]">
      <input name="q" defaultValue={params.q} placeholder="Cari lokasi atau kata kunci" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#087a55]"/>
      <select name="transaction" defaultValue={params.transaction || ""} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">Jual & sewa</option><option value="sale">Dijual</option><option value="rent">Disewa</option></select>
      <button className="flex items-center justify-center gap-2 rounded-xl bg-[#087a55] px-5 py-3 text-sm font-bold text-white"><Search size={16}/> Cari</button>
    </form>
    <p className="mt-7 text-sm text-slate-500">{properties.length} properti ditemukan</p>
    {properties.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{properties.map(p=><PropertyCard key={p.id} property={p}/>)}</div> : <div className="mt-5 rounded-2xl border border-dashed bg-white p-12 text-center"><p className="font-bold">Belum ada properti yang cocok.</p><p className="mt-2 text-sm text-slate-500">Coba kata kunci lain atau kembali lagi nanti.</p><Link href="/" className="mt-4 inline-block text-sm font-bold text-[#087a55]">Kembali ke beranda</Link></div>}
  </main></>;
}
