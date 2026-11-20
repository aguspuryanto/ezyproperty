-- Track where an imported listing came from (e.g. Brighton) so imports can be re-run idempotently.
alter table public.properties add column if not exists source text;
alter table public.properties add column if not exists source_id text;

create unique index if not exists properties_source_uidx
  on public.properties(source, source_id);
