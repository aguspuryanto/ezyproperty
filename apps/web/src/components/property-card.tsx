import Image from "next/image";
import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import type { Property } from "@/lib/api";

const fallback = "https://images.unsplash.com/photo-1600597203089-9f7e9a7f1c5d?w=900&q=80";

function formatPrice(price: number, transaction: string) {
  // Gunakan formatter deterministik tanpa locale agar tidak terjadi
  // hydration mismatch antara Node.js server dan browser.
  const parts = Math.round(price).toString().split("").reverse();
  const grouped = parts.reduce((acc, digit, i) =>
    i > 0 && i % 3 === 0 ? digit + "." + acc : digit + acc, "");
  return `Rp\u00a0${grouped}${transaction === "rent" ? " / tahun" : ""}`;
}

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_24px_rgba(15,40,30,.04)] transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/properti/${property.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <Image src={property.cover_image_url || fallback} alt={property.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105"/>
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#087a55]">{property.transaction_type === "sale" ? "Dijual" : "Disewakan"}</span>
        </div>
        <div className="p-4">
          <p className="text-lg font-extrabold text-[#087a55]">{formatPrice(property.price, property.transaction_type)}</p>
          <h3 className="mt-1 line-clamp-1 font-bold text-slate-900">{property.title}</h3>
          <p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{property.city_name}, {property.province_name}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs font-medium text-slate-600">
            {property.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble size={15}/>{property.bedrooms} KT</span>}
            {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath size={15}/>{property.bathrooms} KM</span>}
            {property.land_area && <span className="flex items-center gap-1"><Ruler size={15}/>{property.land_area} m²</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
