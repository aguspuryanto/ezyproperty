import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogOut, Plus, Building2, MapPin, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@/components/property-card";
import { signOut } from "./actions";

export const metadata = { title: "Dashboard Agen" };

const PAGE_SIZE = 12;
const fallback = "https://images.unsplash.com/photo-1600597203089-9f7e9a7f1c5d?w=900&q=80";

const TABS = [
  { key: "all", label: "Semua" },
  { key: "published", label: "Aktif" },
  { key: "archived", label: "Kadaluarsa" },
  { key: "pending", label: "Menunggu moderasi" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  published: { label: "Aktif", className: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Kadaluarsa", className: "bg-slate-100 text-slate-600" },
  pending: { label: "Menunggu moderasi", className: "bg-amber-50 text-amber-700" },
  draft: { label: "Draft", className: "bg-sky-50 text-sky-700" },
  rejected: { label: "Ditolak", className: "bg-rose-50 text-rose-700" },
  sold: { label: "Terjual", className: "bg-violet-50 text-violet-700" },
  rented: { label: "Tersewa", className: "bg-violet-50 text-violet-700" },
};

const TYPE_LABEL: Record<string, string> = {
  house: "Rumah", apartment: "Apartemen", land: "Tanah", shop: "Ruko", warehouse: "Gudang", villa: "Villa", other: "Lainnya",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const tab: TabKey = TABS.some(t => t.key === params.status) ? (params.status as TabKey) : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // EzyProperty profiles live in schema "ezy" and are created here on first visit:
  // the auth schema is shared with another app, so there is no trigger on auth.users.
  await supabase.from("profiles").upsert(
    { id: user.id, full_name: String(user.user_metadata?.full_name ?? ""), email: user.email },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const countBy = (status?: string) => {
    let q = supabase.from("properties").select("id", { count: "exact", head: true }).eq("agent_id", user.id);
    if (status) q = q.eq("status", status);
    return q;
  };

  let listQuery = supabase
    .from("properties")
    .select("id,title,slug,status,price,transaction_type,property_type,city_name,district_name,cover_image_url,land_area,building_area,bedrooms,bathrooms,created_at", { count: "exact" })
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (tab !== "all") listQuery = listQuery.eq("status", tab);

  const [{ data: profile }, total, published, archived, pending, { data: listings, count: filteredCount }] = await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle(),
    countBy(), countBy("published"), countBy("archived"), countBy("pending"),
    listQuery,
  ]);

  const counts: Record<TabKey, number> = {
    all: total.count ?? 0, published: published.count ?? 0, archived: archived.count ?? 0, pending: pending.count ?? 0,
  };
  const totalPages = Math.max(1, Math.ceil((filteredCount ?? 0) / PAGE_SIZE));
  const href = (t: TabKey, p = 1) => {
    const sp = new URLSearchParams();
    if (t !== "all") sp.set("status", t);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/dashboard?${s}` : "/dashboard";
  };

  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><Link href="/" className="flex items-center gap-2 font-black text-[#087a55]"><Building2/> ezyproperty</Link><form action={signOut}><button className="flex items-center gap-2 text-sm font-semibold text-slate-600"><LogOut size={16}/> Keluar</button></form></div></header>
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#087a55]">Dashboard agen</p><h1 className="mt-1 text-3xl font-black text-slate-900">Halo, {profile?.full_name || user.email}</h1><p className="mt-2 text-sm text-slate-500">Kelola listing dan pantau aktivitas properti Anda.</p></div><Link href="/dashboard/properties/new" className="inline-flex items-center gap-2 rounded-full bg-[#087a55] px-5 py-3 text-sm font-bold text-white"><Plus size={17}/> Tambah listing</Link></div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total listing" value={counts.all}/>
        <Stat label="Aktif" value={counts.published}/>
        <Stat label="Kadaluarsa" value={counts.archived}/>
        <Stat label="Menunggu moderasi" value={counts.pending}/>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <h2 className="font-extrabold text-slate-900">Listing saya</h2>
          <nav className="flex flex-wrap gap-2">
            {TABS.map(t => <Link key={t.key} href={href(t.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === t.key ? "bg-[#087a55] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t.label} ({counts[t.key]})</Link>)}
          </nav>
        </div>

        {listings?.length ? <div className="divide-y">
          {listings.map(item => {
            const status = STATUS_STYLE[item.status] ?? { label: item.status, className: "bg-slate-100 text-slate-600" };
            const specs = [
              item.bedrooms > 0 ? `${item.bedrooms} KT` : null,
              item.bathrooms > 0 ? `${item.bathrooms} KM` : null,
              item.land_area ? `LT ${Number(item.land_area)} m²` : null,
              item.building_area ? `LB ${Number(item.building_area)} m²` : null,
            ].filter(Boolean).join(" · ");
            return <div key={item.id} className="flex gap-4 p-4 sm:p-5">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-36">
                <Image src={item.cover_image_url || fallback} alt={item.title} fill sizes="144px" className="object-cover"/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="line-clamp-2 font-bold text-slate-800">{item.title}</p>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-1 font-extrabold text-[#087a55]">{formatPrice(Number(item.price), item.transaction_type)}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} className="shrink-0"/><span className="truncate">{[item.district_name, item.city_name].filter(Boolean).join(", ")}</span></p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">{TYPE_LABEL[item.property_type] ?? item.property_type} · {item.transaction_type === "sale" ? "Dijual" : "Disewa"}</span>
                  {specs && <span>{specs}</span>}
                  {item.status === "published" && <Link href={`/properti/${item.slug}`} className="inline-flex items-center gap-1 font-bold text-[#087a55]">Lihat <ExternalLink size={12}/></Link>}
                </div>
              </div>
            </div>;
          })}
        </div> : <div className="p-10 text-center"><p className="font-semibold text-slate-800">{tab === "all" ? "Belum ada listing" : "Tidak ada listing di kategori ini"}</p><p className="mt-1 text-sm text-slate-500">{tab === "all" ? "Mulai tambahkan properti pertama Anda." : "Coba pilih kategori lain."}</p></div>}

        {totalPages > 1 && <div className="flex items-center justify-between border-t p-4 text-sm">
          {page > 1 ? <Link href={href(tab, page - 1)} className="inline-flex items-center gap-1 font-bold text-[#087a55]"><ChevronLeft size={16}/> Sebelumnya</Link> : <span/>}
          <span className="text-slate-500">Halaman {page} dari {totalPages}</span>
          {page < totalPages ? <Link href={href(tab, page + 1)} className="inline-flex items-center gap-1 font-bold text-[#087a55]">Berikutnya <ChevronRight size={16}/></Link> : <span/>}
        </div>}
      </section>
    </div>
  </main>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-slate-100 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-[#087a55]">{value}</p></div>; }
