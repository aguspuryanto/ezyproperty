import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page numbers with ellipses: 1 … 4 5 6 … 12 */
function pageList(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter(p => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pager({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  const base = "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm font-bold";
  return <nav aria-label="Halaman" className="mt-10 flex flex-wrap items-center justify-center gap-2">
    {page > 1
      ? <Link href={hrefFor(page - 1)} className={`${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} aria-label="Halaman sebelumnya"><ChevronLeft size={16}/></Link>
      : <span className={`${base} border border-slate-100 text-slate-300`} aria-hidden><ChevronLeft size={16}/></span>}
    {pageList(page, totalPages).map((p, i) => p === "…"
      ? <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
      : p === page
        ? <span key={p} aria-current="page" className={`${base} bg-[#087a55] text-white`}>{p}</span>
        : <Link key={p} href={hrefFor(p)} className={`${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>{p}</Link>)}
    {page < totalPages
      ? <Link href={hrefFor(page + 1)} className={`${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} aria-label="Halaman berikutnya"><ChevronRight size={16}/></Link>
      : <span className={`${base} border border-slate-100 text-slate-300`} aria-hidden><ChevronRight size={16}/></span>}
  </nav>;
}
