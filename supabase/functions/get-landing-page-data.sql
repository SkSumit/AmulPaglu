create or replace function public.get_landing_page_data()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  top_users jsonb;
  total_user_count int;
  total_product_count int;
  preview_products jsonb;
  tier_counts jsonb;
  all_badges jsonb;
begin
  -- 1. Get Top Users
  select coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb) into top_users
  from (select id, username, total_points, is_admin from public.profiles order by total_points desc limit 10) u;

  -- 2. Get User Count
  select count(*) into total_user_count from public.profiles;

  -- 3. Get Approved Product Count
  select count(*) into total_product_count from public.products where status = 'approved';

  -- 4. Get Preview Products
  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into preview_products
  from (
    select id, name, category, points, rarity_label, image_url 
    from public.products 
    where status = 'approved' and image_url is not null 
    order by points desc limit 12
  ) p;

  -- 5. Get Tier Counts
  select jsonb_build_object(
    'Lactose Trainee', (select count(*) from public.profiles where total_points between 0 and 50),
    'Shrikhand Scholar', (select count(*) from public.profiles where total_points between 51 and 150),
    'Kulfi Kingpin', (select count(*) from public.profiles where total_points between 151 and 300),
    'Makhan Chor', (select count(*) from public.profiles where total_points between 301 and 500),
    'Amul Paglu', (select count(*) from public.profiles where total_points >= 501)
  ) into tier_counts;

  -- 6. Get All Badges
  select coalesce(jsonb_agg(row_to_json(b)), '[]'::jsonb) into all_badges
  from (
    select icon, name, description 
    from public.badges 
    order by created_at asc
  ) b;

  -- Return everything as a single JSON object
  return jsonb_build_object(
    'top_users', top_users,
    'user_count', total_user_count,
    'product_count', total_product_count,
    'preview_products', preview_products,
    'tier_counts', tier_counts,
    'all_badges', all_badges
  );
end;
$$;
