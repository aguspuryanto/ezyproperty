"use client";
import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "ezyproperty-documents";

export function NewPropertyForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validasi tipe & ukuran (maks 5MB)
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, WEBP, dll).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5MB.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setUploadProgress("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadImage(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
    if (!imageFile) return null;
    setUploadProgress("uploading");
    // Path: properties/{userId}/{timestamp}-{filename}
    const ext = imageFile.name.split(".").pop();
    const filePath = `properties/${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, imageFile, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    setUploadProgress("done");
    return data.publicUrl;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setLoading(true);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sesi login berakhir. Silakan masuk kembali."); setLoading(false); return; }

    try {
      // 1. Upload gambar ke Supabase Storage jika ada
      const coverImageUrl = await uploadImage(supabase, session.user.id);

      // 2. Kirim data properti ke API
      const payload = {
        title: String(fd.get("title")),
        description: String(fd.get("description") || ""),
        transaction_type: String(fd.get("transaction_type")),
        property_type: String(fd.get("property_type")),
        price: Number(fd.get("price")),
        land_area: fd.get("land_area") ? Number(fd.get("land_area")) : undefined,
        building_area: fd.get("building_area") ? Number(fd.get("building_area")) : undefined,
        bedrooms: Number(fd.get("bedrooms") || 0),
        bathrooms: Number(fd.get("bathrooms") || 0),
        city_name: String(fd.get("city_name")),
        province_name: String(fd.get("province_name")),
        address: String(fd.get("address") || ""),
        cover_image_url: coverImageUrl ?? undefined,
      };
      const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const res = await fetch(`${api}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan listing");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setUploadProgress("idle");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#087a55]";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-semibold">
        Judul listing
        <input name="title" required minLength={10} maxLength={180} className={`${field} mt-2`} placeholder="Contoh: Rumah minimalis 2 lantai di Surabaya Barat" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Transaksi
          <select name="transaction_type" className={`${field} mt-2`}>
            <option value="sale">Dijual</option>
            <option value="rent">Disewakan</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Tipe properti
          <select name="property_type" className={`${field} mt-2`}>
            {["house","apartment","land","shop","warehouse","villa","other"].map(v => (
              <option key={v} value={v}>{({ house:"Rumah", apartment:"Apartemen", land:"Tanah", shop:"Ruko", warehouse:"Gudang", villa:"Villa", other:"Lainnya" } as Record<string,string>)[v]}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Harga (Rp)
        <input name="price" type="number" min="1" required className={`${field} mt-2`} placeholder="850000000" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Luas tanah (m²)<input name="land_area" type="number" min="1" className={`${field} mt-2`} /></label>
        <label className="text-sm font-semibold">Luas bangunan (m²)<input name="building_area" type="number" min="1" className={`${field} mt-2`} /></label>
        <label className="text-sm font-semibold">Kamar tidur<input name="bedrooms" type="number" min="0" defaultValue="0" className={`${field} mt-2`} /></label>
        <label className="text-sm font-semibold">Kamar mandi<input name="bathrooms" type="number" min="0" defaultValue="0" className={`${field} mt-2`} /></label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Kota / Kabupaten<input name="city_name" required className={`${field} mt-2`} placeholder="Surabaya" /></label>
        <label className="text-sm font-semibold">Provinsi<input name="province_name" required className={`${field} mt-2`} placeholder="Jawa Timur" /></label>
      </div>

      <label className="block text-sm font-semibold">
        Alamat
        <input name="address" className={`${field} mt-2`} placeholder="Alamat lengkap (opsional)" />
      </label>

      {/* ── Upload Foto Utama ── */}
      <div className="space-y-2">
        <span className="block text-sm font-semibold">Foto utama properti</span>
        {imagePreview ? (
          <div className="relative w-full overflow-hidden rounded-xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Preview" className="h-52 w-full object-cover" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Hapus foto"
            >
              <X size={16} />
            </button>
            {uploadProgress === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="animate-spin text-white" size={32} />
                <span className="ml-2 font-semibold text-white">Mengunggah...</span>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-400 transition hover:border-[#087a55] hover:text-[#087a55]"
          >
            <ImagePlus size={28} />
            <span className="text-sm font-medium">Klik untuk pilih foto</span>
            <span className="text-xs">JPG, PNG, WEBP · Maks 5MB</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <label className="block text-sm font-semibold">
        Deskripsi
        <textarea name="description" rows={5} className={`${field} mt-2`} placeholder="Jelaskan kondisi dan keunggulan properti..." />
      </label>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087a55] px-5 py-3.5 font-bold text-white disabled:opacity-60 hover:bg-[#075b42]"
      >
        {loading && <Loader2 className="animate-spin" size={18} />}
        {loading ? "Menyimpan..." : "Kirim untuk moderasi"}
      </button>
    </form>
  );
}
