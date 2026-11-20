import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

export const publicSupabase = createClient(env.supabaseUrl, env.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export const adminSupabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
