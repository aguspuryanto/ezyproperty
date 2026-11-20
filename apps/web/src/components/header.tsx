import Link from "next/link";
import { Building2, Menu, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-950/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-[#087a55]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#087a55] text-white"><Building2 size={20}/></span>
          ezyproperty
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/properti" className="hover:text-[#087a55]">Cari Properti</Link>
          <a href="#cara-kerja" className="hover:text-[#087a55]">Cara Kerja</a>
          <a href="#tentang" className="hover:text-[#087a55]">Tentang Kami</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="rounded-full bg-[#087a55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#075b42]">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:block">Masuk</Link>
              <Link href="/register" className="flex items-center gap-2 rounded-full bg-[#087a55] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#075b42]"><PlusCircle size={16}/> Daftar Agen</Link>
            </>
          )}
          <button aria-label="Menu" className="rounded-lg p-2 text-slate-600 md:hidden"><Menu size={21}/></button>
        </div>
      </div>
    </header>
  );
}
