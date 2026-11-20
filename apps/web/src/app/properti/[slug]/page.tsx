import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
async function getProperty(slug: string) {
  try {
    const res = await fetch(`${API}/properties/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error(`[getProperty] API tidak bisa dihubungi di ${API}. Pastikan apps/api berjalan.`, error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{slug:string}> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) return { title: "Properti tidak ditemukan" };
  return {
    title: property.title,
    description: property.description?.slice(0, 155) || `${property.title} di ${property.city_name}, ${property.province_name}.`,
    openGraph: { images: property.cover_image_url ? [property.cover_image_url] : [] }
  };
}

export default async function PropertyDetail({ params }: { params: Promise<{slug:string}> }) {
  const { slug } = await params;
  const p = await getProperty(slug);
  if (!p) notFound();
  const agent = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
  const images = (p.property_images ?? []).sort((a:any,b:any)=>a.sort_order-b.sort_order);
  const cover = p.cover_image_url || images[0]?.image_url || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200";
  const wa = agent?.whatsapp || agent?.phone;
  const waLink = wa ? `https://wa.me/${String(wa).replace(/\D/g,"")}?text=${encodeURIComponent(`Halo, saya tertarik dengan properti ${p.title}`)}` : null;
  return <><Header/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <Link href="/properti" className="text-sm font-semibold text-[#087a55]">← Kembali ke pencarian</Link>
    <div className="mt-5 grid gap-3 md:grid-cols-[1.6fr_1fr]">
      <div className="relative min-h-64 overflow-hidden rounded-2xl bg-slate-100 md:min-h-[420px]"><Image src={cover} alt={p.title} fill priority sizes="(max-width:768px) 100vw, 65vw" className="object-cover"/></div>
      <div className="grid grid-cols-2 gap-3">{images.slice(1,5).map((img:any)=><div key={img.id} className="relative min-h-32 overflow-hidden rounded-xl bg-slate-100"><Image src={img.image_url} alt={img.alt_text || p.title} fill sizes="30vw" className="object-cover"/></div>)}</div>
    </div>
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
      <section><p className="text-sm font-bold text-[#087a55]">{p.transaction_type==="sale"?"Dijual":"Disewakan"} · {p.property_type}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{p.title}</h1><p className="mt-2 text-sm text-slate-500">{p.address ? `${p.address}, ` : ""}{p.city_name}, {p.province_name}</p><p className="mt-5 text-3xl font-black text-[#087a55]">Rp{Number(p.price).toLocaleString("id-ID")}</p>
      <div className="mt-7 grid grid-cols-2 gap-3 rounded-2xl bg-emerald-50 p-5 sm:grid-cols-4">{[["Luas tanah",p.land_area?`${p.land_area} m²`:"-"],["Luas bangunan",p.building_area?`${p.building_area} m²`:"-"],["Kamar tidur",p.bedrooms],["Kamar mandi",p.bathrooms]].map(([k,v])=><div key={String(k)}><p className="text-xs text-slate-500">{k}</p><p className="mt-1 font-extrabold text-slate-900">{v}</p></div>)}</div>
      <h2 className="mt-8 text-xl font-extrabold">Deskripsi properti</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{p.description || "Informasi lebih lanjut mengenai properti ini dapat ditanyakan langsung kepada agen."}</p>
      </section>
      <aside className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><h2 className="font-extrabold">Informasi agen</h2><p className="mt-3 font-bold text-slate-900">{agent?.full_name || "Agen EzyProperty"}</p><p className="mt-1 text-sm text-slate-500">{agent?.agency_name || "Agen properti"}</p>{waLink ? <a href={waLink} target="_blank" rel="noreferrer" className="mt-5 block rounded-xl bg-[#087a55] px-4 py-3 text-center text-sm font-bold text-white">Hubungi via WhatsApp</a> : <p className="mt-4 text-sm text-slate-500">Kontak agen belum tersedia.</p>}</aside>
    </div>
  </main></>;
}
