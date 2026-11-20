import { createMiddleware } from "hono/factory";
import { publicSupabase } from "../lib/supabase.js";

export type AuthVariables = {
  user: { id: string; email?: string };
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  const { data, error } = await publicSupabase.auth.getUser(token);
  if (error || !data.user) {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }

  c.set("user", { id: data.user.id, email: data.user.email });
  await next();
});
