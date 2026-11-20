import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogOut, Plus, Building2 } from "lucide-react";
import { signOut } from "./actions";

export const metadata = { title: "Dashboard Agen" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle();
  const { data: listings } = await supabase.from("properties").select("id,title,status,price,created_at").eq("agent_id", user.id).order("created_at", { ascending: false }).limit(10);

  return <main className="min-h-screen bg-[#f7faf8]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><Link href="/" className="flex items-center gap-2 font-black text-[#087a55]"><Building2/> ezyproperty</Link><form action={signOut}><button className="flex items-center gap-2 text-sm font-semibold text-slate-600"><LogOut size={16}/> Keluar</button></form></div></header>
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[#087a55]">Dashboard agen</p><h1 className="mt-1 text-3xl font-black text-slate-900">Halo, {profile?.full_name || user.email}</h1><p className="mt-2 text-sm text-slate-500">Kelola listing dan pantau aktivitas properti Anda.</p></div><Link href="/dashboard/properties/new" className="inline-flex items-center gap-2 rounded-full bg-[#087a55] px-5 py-3 text-sm font-bold text-white"><Plus size={17}/> Tambah listing</Link></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat label="Total listing" value={String(listings?.length ?? 0)}/><Stat label="Menunggu moderasi" value={String(listings?.filter(x=>x.status==="pending").length ?? 0)}/><Stat label="Dipublikasikan" value={String(listings?.filter(x=>x.status==="published").length ?? 0)}/></div>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-100 bg-white"><div className="border-b p-5"><h2 className="font-extrabold text-slate-900">Listing saya</h2></div>{listings?.length ? <div className="divide-y">{listings.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-bold text-slate-800">{item.title}</p><p className="mt-1 text-sm text-slate-500">Rp{Number(item.price).toLocaleString("id-ID", { useGrouping: true })}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold capitalize text-amber-700">{item.status}</span></div>)}</div> : <div className="p-10 text-center"><p className="font-semibold text-slate-800">Belum ada listing</p><p className="mt-1 text-sm text-slate-500">Mulai tambahkan properti pertama Anda.</p></div>}</section>
    </div>
  </main>;
}

function Stat({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-slate-100 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-[#087a55]">{value}</p></div>; }
