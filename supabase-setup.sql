create extension if not exists pgcrypto;
create table if not exists public.vajilla_categories(id uuid primary key default gen_random_uuid(),name text not null unique,icon text default '📦',sort_order int default 0,created_at timestamptz default now());
create table if not exists public.vajilla_items(id uuid primary key default gen_random_uuid(),name text not null,category_id uuid not null references public.vajilla_categories(id),usage text,quantity int not null default 0,description text,photo_url text,updated_at timestamptz default now(),created_at timestamptz default now());
create table if not exists public.vajilla_admins(user_id uuid primary key references auth.users(id),display_name text,created_at timestamptz default now());
insert into public.vajilla_categories(name,icon,sort_order) values ('Platos','🍽️',1),('Copas','🍷',2),('Vasos','🥃',3),('Cubiertos','🍴',4),('Cafetería','☕',5),('Cerveza','🍺',6),('Servicio','🫖',7),('Otros','📦',8) on conflict(name) do nothing;
insert into storage.buckets(id,name,public) values('vajilla-fotos','vajilla-fotos',true) on conflict(id) do update set public=true;
