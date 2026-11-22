// Vercel Services entrypoint for the "api" service.
// Re-exports the self-contained esbuild bundle produced by `pnpm run build`
// (hono and all other deps are inlined, so nothing is resolved from node_modules at runtime).
export { default } from "./dist/vercel.mjs";
