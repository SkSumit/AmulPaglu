create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  is_admin boolean default false,
  total_points integer default 0,
  created_at timestamptz default now()
);
 
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  description text,
  image_url text,
  points integer check (points between 1 and 5),
  rarity_label text,
  availability text,
  is_discontinued boolean default false,
  source_url text,
  status text default 'approved' check (status in ('approved', 'pending', 'rejected')),
  submitted_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
 
create table if not exists public.user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  status text default 'want_to_try' check (status in ('want_to_try', 'tried')),
  tried_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, product_id)
);
 
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id),
  name text not null,
  category text,
  description text,
  image_url text,
  source_url text,
  admin_note text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);
 
create table if not exists public.scrape_logs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz default now(),
  products_found integer,
  new_products integer,
  status text check (status in ('running', 'success', 'partial', 'failed')),
  log_detail jsonb
);
 
-- Helpful indexes
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_user_products_user on public.user_products(user_id);
create index if not exists idx_user_products_product on public.user_products(product_id);
create index if not exists idx_suggestions_status on public.suggestions(status);
create index if not exists idx_suggestions_submitted_by on public.suggestions(submitted_by);
