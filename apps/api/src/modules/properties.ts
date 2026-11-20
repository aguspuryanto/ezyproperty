import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { publicSupabase, adminSupabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const properties = new Hono();

const querySchema = z.object({
  q: z.string().trim().optional(),
  transaction: z.enum(["sale", "rent"]).optional(),
  type: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  bedrooms: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  page: z.coerce.number().int().min(1).default(1)
});

properties.get("/", zValidator("query", querySchema), async (c) => {
  const f = c.req.valid("query");
  const from = (f.page - 1) * f.limit;
  let query = publicSupabase.from("properties")
    .select("id,title,slug,price,transaction_type,property_type,land_area,building_area,bedrooms,bathrooms,city_name,province_name,cover_image_url,created_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, from + f.limit - 1);

  if (f.transaction) query = query.eq("transaction_type", f.transaction);
  if (f.type) query = query.eq("property_type", f.type);
  if (f.city) query = query.ilike("city_name", `%${f.city}%`);
  if (f.minPrice !== undefined) query = query.gte("price", f.minPrice);
  if (f.maxPrice !== undefined) query = query.lte("price", f.maxPrice);
  if (f.bedrooms !== undefined) query = query.gte("bedrooms", f.bedrooms);
  if (f.q) query = query.textSearch("search_vector", f.q, { type: "websearch", config: "simple" });

  const { data, error, count } = await query;
  // PGRST103 = requested page is past the end: return an empty page, not a server error.
  if (error && error.code === "PGRST103") {
    const { count: total } = await query.range(0, 0);
    return c.json({
      success: true,
      data: [],
      pagination: { page: f.page, limit: f.limit, total: total ?? 0, totalPages: Math.ceil((total ?? 0) / f.limit) }
    });
  }
  if (error) return c.json({ success: false, error: error.message }, 500);
  return c.json({
    success: true,
    data: data ?? [],
    pagination: { page: f.page, limit: f.limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / f.limit) }
  });
});

// Cities that have published listings, with counts (for the search filter).
// Must be registered before "/:slug".
properties.get("/cities", async (c) => {
  const { data, error } = await publicSupabase.from("properties")
    .select("city_name")
    .eq("status", "published")
    .limit(5000);
  if (error) return c.json({ success: false, error: error.message }, 500);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const city = row.city_name?.trim();
    if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  const cities = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  return c.json({ success: true, data: cities });
});

properties.get("/:slug", async (c) => {
  const { data, error } = await publicSupabase.from("properties")
    .select("*, property_images(id,image_url,alt_text,sort_order)")
    .eq("slug", c.req.param("slug"))
    .eq("status", "published")
    .maybeSingle();

  if (error) return c.json({ success: false, error: error.message }, 500);
  if (!data) return c.json({ success: false, error: "Property not found" }, 404);

  // Fetch only explicitly public agent fields; never expose profile email or private metadata.
  const { data: agent } = await adminSupabase.from("profiles")
    .select("id,full_name,avatar_url,phone,whatsapp,agency_name,bio")
    .eq("id", data.agent_id)
    .maybeSingle();

  return c.json({ success: true, data: { ...data, profiles: agent } });
});

const createSchema = z.object({
  title: z.string().min(10).max(180),
  description: z.string().max(10000).optional(),
  transaction_type: z.enum(["sale", "rent"]),
  property_type: z.enum(["house", "apartment", "land", "shop", "warehouse", "villa", "other"]),
  price: z.number().positive(),
  land_area: z.number().positive().optional(),
  building_area: z.number().positive().optional(),
  bedrooms: z.number().int().min(0).default(0),
  bathrooms: z.number().int().min(0).default(0),
  city_name: z.string().min(2),
  province_name: z.string().min(2),
  address: z.string().optional(),
  cover_image_url: z.string().url().optional()
});

properties.post("/", requireAuth, zValidator("json", createSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");
  // Agent profiles are created lazily (no trigger on the shared auth.users table).
  const { error: profileError } = await adminSupabase.from("profiles").upsert(
    { id: user.id, email: user.email },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (profileError) return c.json({ success: false, error: profileError.message }, 500);

  const slug = `${body.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 8)}`;

  const { data, error } = await adminSupabase.from("properties").insert({
    ...body,
    slug,
    agent_id: user.id,
    status: "pending"
  }).select().single();

  if (error) return c.json({ success: false, error: error.message }, 400);
  return c.json({ success: true, data }, 201);
});

export default properties;
