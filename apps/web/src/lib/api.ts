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
};

export async function getProperties(params: Record<string, string> = {}) {
  const url = new URL(`${API_URL}/properties`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const result = await response.json();
    return (result.data ?? []) as Property[];
  } catch {
    return [];
  }
}
