-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.user_products enable row level security;
alter table public.suggestions enable row level security;
alter table public.scrape_logs enable row level security;
 
-- ---------- profiles ----------
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);
 
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
 
-- ---------- products ----------
drop policy if exists "products_select_approved_or_admin" on public.products;
create policy "products_select_approved_or_admin"
  on public.products for select
  using (status = 'approved' or public.is_admin());
 
drop policy if exists "products_insert_admin" on public.products;
create policy "products_insert_admin"
  on public.products for insert
  to authenticated
  with check (public.is_admin());
 
drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
 
drop policy if exists "products_delete_admin" on public.products;
create policy "products_delete_admin"
  on public.products for delete
  to authenticated
  using (public.is_admin());
 
-- ---------- user_products ----------
drop policy if exists "user_products_select_own" on public.user_products;
drop policy if exists "user_products_select_all" on public.user_products;
create policy "user_products_select_all"
  on public.user_products for select
  using (true);
 
drop policy if exists "user_products_insert_own" on public.user_products;
create policy "user_products_insert_own"
  on public.user_products for insert
  to authenticated
  with check (user_id = auth.uid());
 
drop policy if exists "user_products_update_own" on public.user_products;
create policy "user_products_update_own"
  on public.user_products for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
 
drop policy if exists "user_products_delete_own" on public.user_products;
create policy "user_products_delete_own"
  on public.user_products for delete
  to authenticated
  using (user_id = auth.uid());
 
-- ---------- suggestions ----------
drop policy if exists "suggestions_select_own_or_admin" on public.suggestions;
create policy "suggestions_select_own_or_admin"
  on public.suggestions for select
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());
 
drop policy if exists "suggestions_insert_own" on public.suggestions;
create policy "suggestions_insert_own"
  on public.suggestions for insert
  to authenticated
  with check (submitted_by = auth.uid());
 
drop policy if exists "suggestions_update_admin" on public.suggestions;
create policy "suggestions_update_admin"
  on public.suggestions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- scrape_logs ----------
drop policy if exists "scrape_logs_admin_all" on public.scrape_logs;
create policy "scrape_logs_admin_all"
  on public.scrape_logs
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());