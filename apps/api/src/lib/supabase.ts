import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

export const publicSupabase = createClient(env.supabaseUrl, env.anonKey, {
  db: { schema: "ezy" },
  auth: { persistSession: false, autoRefreshToken: false }
});

export const adminSupabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
  db: { schema: "ezy" },
  auth: { persistSession: false, autoRefreshToken: false }
});
