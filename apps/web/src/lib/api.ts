const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type Property = {
  id: string;
  title: string;
  slug: string;
  price: number;
  transaction_type: "sale" | "rent";
  property_type: string;
  land_area: number | null;
  building_area: number | null;
  bedrooms: number;
  bathrooms: number;
  city_name: string;
  province_name: string;
  cover_image_url: string | null;
  /** "published" (aktif) or "archived" (kadaluarsa). */
  status?: string;
};

export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type City = { name: string; count: number };

/** Listing search with pagination info (used by /properti). */
export async function searchProperties(params: Record<string, string> = {}): Promise<{ data: Property[]; pagination: Pagination; ok: boolean }> {
  const url = new URL(`${API_URL}/properties`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const empty: Pagination = { page: 1, limit: Number(params.limit ?? 9), total: 0, totalPages: 0 };
  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      console.error(`[searchProperties] API ${response.status} ${url}`);
      return { data: [], pagination: empty, ok: false };
    }
    const result = await response.json();
    return { data: (result.data ?? []) as Property[], pagination: result.pagination ?? empty, ok: true };
  } catch (error) {
    console.error(`[searchProperties] API tidak bisa dihubungi di ${url}. Pastikan apps/api berjalan.`, error);
    return { data: [], pagination: empty, ok: false };
  }
}

/** Cities that currently have published listings. */
export async function getCities(): Promise<City[]> {
  try {
    const response = await fetch(`${API_URL}/properties/cities`, { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const result = await response.json();
    return (result.data ?? []) as City[];
  } catch {
    return [];
  }
}

export async function getProperties(params: Record<string, string> = {}) {
  const url = new URL(`${API_URL}/properties`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      console.error(`[getProperties] API ${response.status} ${url}`);
      return [];
    }
    const result = await response.json();
    return (result.data ?? []) as Property[];
  } catch (error) {
    console.error(`[getProperties] API tidak bisa dihubungi di ${url}. Pastikan apps/api berjalan.`, error);
    return [];
  }
}
