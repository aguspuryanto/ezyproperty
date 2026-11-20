-- Make expired (archived) listings publicly readable, next to published ones.
-- The site shows them with an "expired" badge. Draft/pending/rejected/sold/rented stay private.
-- Idempotent; touches only schema "ezy".

drop policy if exists "Public can read published properties" on ezy.properties;
create policy "Public can read published properties" on ezy.properties
for select using (status in ('published', 'archived') or auth.uid() = agent_id);

drop policy if exists "Public can read images of visible properties" on ezy.property_images;
create policy "Public can read images of visible properties" on ezy.property_images
for select using (exists (
  select 1 from ezy.properties p where p.id = property_id
  and (p.status in ('published', 'archived') or p.agent_id = auth.uid())
));

notify pgrst, 'reload schema';
