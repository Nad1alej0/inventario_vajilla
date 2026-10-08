create extension if not exists pgcrypto;

create table if not exists public.vajilla_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text default '📦',
  sort_order int default 0,
  created_at timestamptz default now()
);

create table if not exists public.vajilla_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid not null references public.vajilla_categories(id) on delete restrict,
  usage text,
  quantity int not null default 0 check (quantity >= 0),
  description text,
  photo_url text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.vajilla_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

alter table public.vajilla_categories enable row level security;
alter table public.vajilla_items enable row level security;
alter table public.vajilla_admins enable row level security;

drop policy if exists "public read categories" on public.vajilla_categories;
create policy "public read categories" on public.vajilla_categories for select using (true);

drop policy if exists "public read items" on public.vajilla_items;
create policy "public read items" on public.vajilla_items for select using (true);

drop policy if exists "admins manage categories" on public.vajilla_categories;
create policy "admins manage categories" on public.vajilla_categories
for all to authenticated
using (exists(select 1 from public.vajilla_admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.vajilla_admins a where a.user_id=auth.uid()));

drop policy if exists "admins manage items" on public.vajilla_items;
create policy "admins manage items" on public.vajilla_items
for all to authenticated
using (exists(select 1 from public.vajilla_admins a where a.user_id=auth.uid()))
with check (exists(select 1 from public.vajilla_admins a where a.user_id=auth.uid()));

drop policy if exists "admins read own admin row" on public.vajilla_admins;
create policy "admins read own admin row" on public.vajilla_admins
for select to authenticated using (user_id=auth.uid());

insert into public.vajilla_categories(name,icon,sort_order) values
('Platos','🍽️',1),('Copas','🍷',2),('Vasos','🥃',3),('Cubiertos','🍴',4),
('Cafetería','☕',5),('Cerveza','🍺',6),('Servicio','🫖',7),('Otros','📦',8)
on conflict(name) do nothing;

insert into storage.buckets (id,name,public)
values ('vajilla-fotos','vajilla-fotos',true)
on conflict (id) do update set public=true;

drop policy if exists "public read vajilla photos" on storage.objects;
create policy "public read vajilla photos" on storage.objects
for select using (bucket_id='vajilla-fotos');

drop policy if exists "admins upload vajilla photos" on storage.objects;
create policy "admins upload vajilla photos" on storage.objects
for insert to authenticated
with check (
  bucket_id='vajilla-fotos'
  and exists(select 1 from public.vajilla_admins a where a.user_id=auth.uid())
);

drop policy if exists "admins update vajilla photos" on storage.objects;
create policy "admins update vajilla photos" on storage.objects
for update to authenticated
using (
  bucket_id='vajilla-fotos'
  and exists(select 1 from public.vajilla_admins a where a.user_id=auth.uid())
);

-- Luego de crear las cuentas de Nadia y Tiara en Authentication > Users:
-- insert into public.vajilla_admins(user_id, display_name) values
-- ('UUID-DE-NADIA','Nadia'),
-- ('UUID-DE-TIARA','Tiara');


-- Permisos de API para la app web
grant usage on schema public to anon, authenticated;
grant select on table public.vajilla_categories to anon, authenticated;
grant select on table public.vajilla_items to anon, authenticated;
grant select on table public.vajilla_admins to authenticated;

grant insert, update, delete on table public.vajilla_categories to authenticated;
grant insert, update, delete on table public.vajilla_items to authenticated;

-- Storage: lectura pública; escritura autenticada controlada además por RLS
grant usage on schema storage to anon, authenticated;
grant select on table storage.objects to anon, authenticated;
grant insert, update, delete on table storage.objects to authenticated;


-- Configuración visible de inventario (sin exponer secretos)
alter table public.vajilla_config enable row level security;

drop policy if exists "public read vajilla config" on public.vajilla_config;
create policy "public read vajilla config"
on public.vajilla_config
for select
to anon, authenticated
using (true);

drop policy if exists "admins update vajilla config" on public.vajilla_config;
create policy "admins update vajilla config"
on public.vajilla_config
for update
to authenticated
using (
  exists (
    select 1
    from public.vajilla_admins a
    where a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.vajilla_admins a
    where a.user_id = auth.uid()
  )
);
