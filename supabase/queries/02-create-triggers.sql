-- =====================================================================
-- HELPER FUNCTION: is_admin()
-- security definer lets this check profiles.is_admin without
-- triggering RLS recursion on the profiles table itself.
-- =====================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;
 
-- =====================================================================
-- TRIGGER: auto-create a profile row whenever someone signs up
-- Pass username (and optionally full_name / avatar_url) in the signup
-- call's options.data, e.g.:
--   supabase.auth.signUp({ email, password, options: { data: { username } } })
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
 
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
 
-- =====================================================================
-- TRIGGER: keep products.updated_at fresh
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
 
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();
 
-- =====================================================================
-- TRIGGER: block self-promotion to admin / free points
-- A regular user's client-side update can never flip is_admin or
-- total_points; only another admin action (or a server/service-role
-- call) can change them.
-- =====================================================================
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If this is NOT an API request (e.g. it's you using the Table Editor or a service role), 
  -- allow the update to pass through without checks.
  if current_setting('request.jwt.claims', true) is null then
    return new;
  end if;
 
  -- If this update is happening internally via another trigger (like your points trigger), allow it
  if pg_trigger_depth() > 1 then
    return new;
  end if;
 
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
 
  if new.total_points is distinct from old.total_points and not public.is_admin() then
    new.total_points := old.total_points;
  end if;
  return new;
end;
$$;
 
drop trigger if exists protect_profile_columns_trigger on public.profiles;
create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();
 
-- =====================================================================
-- TRIGGER (optional, but matches the schema's intent): award/revoke
-- total_points automatically when a user_products row flips to/from
-- 'tried', using that product's points value.
-- Remove this block if you'd rather award points manually.
-- =====================================================================
create or replace function public.award_points_on_tried()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_points integer;
  record_to_use record;
begin
  -- For deletes, we use OLD; for insert/update, we use NEW
  if TG_OP = 'DELETE' then
    record_to_use := OLD;
  else
    record_to_use := NEW;
  end if;
 
  select points into product_points from public.products where id = record_to_use.product_id;
 
  if TG_OP = 'DELETE' then
    if OLD.status = 'tried' then
      update public.profiles set total_points = greatest(total_points - coalesce(product_points, 0), 0)
      where id = OLD.user_id;
    end if;
    return OLD;
  end if;
 
  if NEW.status = 'tried' and (OLD is null or OLD.status is distinct from 'tried') then
    update public.profiles set total_points = total_points + coalesce(product_points, 0)
    where id = NEW.user_id;
    if NEW.tried_at is null then
      NEW.tried_at := now();
    end if;
  elsif OLD is not null and OLD.status = 'tried' and NEW.status is distinct from 'tried' then
    update public.profiles set total_points = greatest(total_points - coalesce(product_points, 0), 0)
    where id = NEW.user_id;
  end if;
 
  return NEW;
end;
$$;
 
drop trigger if exists award_points_trigger on public.user_products;
create trigger award_points_trigger
  before insert or update or delete on public.user_products
  for each row execute procedure public.award_points_on_tried();
