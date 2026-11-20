# EzyProperty

MVP property marketplace built with Next.js, Hono, and Supabase.

## Requirements
- Node.js 20.9+
- pnpm 10+
- Supabase project

## Setup
1. `pnpm install`
2. Copy `apps/web/.env.example` to `apps/web/.env.local`.
3. Copy `apps/api/.env.example` to `apps/api/.env`.
4. Fill in Supabase project URL, anon key, and service role key.
5. Run the SQL migration in `supabase/migrations/0001_init.sql` using Supabase SQL Editor.
6. `pnpm dev`

Web: http://localhost:3000  
API: http://localhost:4000/api/v1/health

## First agent account
Register using the website. Supabase Auth creates the user; a database trigger creates a `profiles` row with role `agent`. Public registration is intentionally limited to agent accounts for this MVP. Configure email confirmation in Supabase Auth as desired.

## Architecture
- `apps/web`: Next.js App Router, public SEO pages, Supabase browser/server clients.
- `apps/api`: Hono REST API. Public listing reads use the anon key; protected operations verify Supabase JWT and use the service role only after authorization.
- `supabase/migrations`: schema, indexes, RLS, and seed data.

## Important production notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the API server environment.
- Set `CORS_ORIGIN` to the deployed frontend origin.
- Add rate limiting / CAPTCHA to public lead and registration endpoints before public launch.
- Add moderation workflows before allowing public publishing.
- Demo seed listings use illustrative content and should be replaced with verified property data.
