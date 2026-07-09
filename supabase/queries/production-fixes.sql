-- ============================================================
-- PRODUCTION FIXES MIGRATION
-- Run this in your Supabase SQL Editor after the initial setup scripts.
-- ============================================================


-- ── 1. Admin Delete User ───────────────────────────────────
-- Deletes a user from auth.users (cascading to profiles, user_products, etc.)
-- Only callable by admins. Uses SECURITY DEFINER to bypass RLS.
-- ────────────────────────────────────────────────────────────

create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Verify caller is an admin
  if not public.is_admin() then
    raise exception 'Access denied. Only administrators can delete users.';
  end if;

  -- Prevent self-deletion
  if target_id = auth.uid() then
    raise exception 'Cannot delete your own account.';
  end if;

  -- Delete from auth.users — cascades to profiles → user_products → user_badges
  delete from auth.users where id = target_id;
end;
$$;


-- ── 2. Leaderboard RPC ────────────────────────────────────
-- Returns top users with tried_count in a single query,
-- replacing the N+1 pattern of fetching each user's count separately.
-- ────────────────────────────────────────────────────────────

create or replace function public.get_leaderboard(max_rows int default 50)
returns table(
  id uuid,
  username text,
  avatar_url text,
  total_points int,
  is_admin boolean,
  tried_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.avatar_url,
    p.total_points,
    p.is_admin,
    count(up.id) filter (where up.status = 'tried') as tried_count
  from public.profiles p
  left join public.user_products up on up.user_id = p.id
  group by p.id
  order by p.total_points desc
  limit max_rows;
$$;


-- ── 3. Suggestion Rate Limit ──────────────────────────────
-- Returns true if the user has submitted fewer than 10 suggestions
-- in the last 24 hours. Returns false if the limit is reached.
-- ────────────────────────────────────────────────────────────

create or replace function public.check_suggestion_rate_limit(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)
    from public.suggestions
    where submitted_by = p_user_id
      and created_at > now() - interval '24 hours'
  ) < 10;
$$;


-- ── 4. Landing Page Cache ─────────────────────────────────
-- Simple cache table for get_landing_page_data results.
-- The function checks if cached data is fresh (< 60 seconds)
-- before running the expensive aggregation queries.
-- ────────────────────────────────────────────────────────────

create table if not exists public.landing_page_cache (
  id int primary key default 1 check (id = 1),  -- singleton row
  data jsonb not null,
  cached_at timestamptz not null default now()
);

-- Allow everyone to read but only the function to write (via security definer)
alter table public.landing_page_cache enable row level security;

drop policy if exists "landing_cache_select_all" on public.landing_page_cache;
create policy "landing_cache_select_all"
  on public.landing_page_cache for select
  using (true);

-- Replace the original function with a cached version
create or replace function public.get_landing_page_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cached_row record;
  result jsonb;
  top_users jsonb;
  total_user_count int;
  total_product_count int;
  preview_products jsonb;
  tier_counts jsonb;
  all_badges jsonb;
begin
  -- Check cache (60 second TTL)
  select data, cached_at into cached_row
  from public.landing_page_cache
  where id = 1;

  if cached_row is not null and cached_row.cached_at > now() - interval '60 seconds' then
    return cached_row.data;
  end if;

  -- Cache miss or stale — regenerate
  select coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb) into top_users
  from (select id, username, total_points, is_admin from public.profiles order by total_points desc limit 10) u;

  select count(*) into total_user_count from public.profiles;

  select count(*) into total_product_count from public.products where status = 'approved';

  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into preview_products
  from (
    select id, name, category, points, rarity_label, image_url
    from public.products
    where status = 'approved' and image_url is not null
    order by points desc limit 12
  ) p;

  select jsonb_build_object(
    'Lactose Trainee', (select count(*) from public.profiles where total_points between 0 and 50),
    'Shrikhand Scholar', (select count(*) from public.profiles where total_points between 51 and 150),
    'Kulfi Kingpin', (select count(*) from public.profiles where total_points between 151 and 300),
    'Makhan Chor', (select count(*) from public.profiles where total_points between 301 and 500),
    'Amul Paglu', (select count(*) from public.profiles where total_points >= 501)
  ) into tier_counts;

  select coalesce(jsonb_agg(row_to_json(b)), '[]'::jsonb) into all_badges
  from (
    select icon, name, description
    from public.badges
    order by created_at asc
  ) b;

  result := jsonb_build_object(
    'top_users', top_users,
    'user_count', total_user_count,
    'product_count', total_product_count,
    'preview_products', preview_products,
    'tier_counts', tier_counts,
    'all_badges', all_badges
  );

  -- Upsert cache
  insert into public.landing_page_cache (id, data, cached_at)
  values (1, result, now())
  on conflict (id) do update set data = excluded.data, cached_at = excluded.cached_at;

  return result;
end;
$$;
