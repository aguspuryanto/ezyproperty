import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env } from "./env.js";
import properties from "./modules/properties.js";

const app = new Hono().basePath("/api/v1");

app.use("*", logger());
app.use("*", cors({
  origin: env.corsOrigin,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));

app.get("/health", (c) => c.json({ success: true, name: "EzyProperty API", status: "ok" }));
app.route("/properties", properties);

app.notFound((c) => c.json({ success: false, error: "Route not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`EzyProperty API listening on http://localhost:${info.port}`);
});
