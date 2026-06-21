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
begin
  -- 1. Get Top Users
  select coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb) into top_users
  from (select id, username, total_points from public.profiles order by total_points desc limit 10) u;

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

  -- Return everything as a single JSON object
  return jsonb_build_object(
    'top_users', top_users,
    'user_count', total_user_count,
    'product_count', total_product_count,
    'preview_products', preview_products
  );
end;
$$;
