-- ============================================================
-- 245D Document Tracker — SHARED TEAM schema
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
--
-- If you already ran the earlier (private) schema, first run:
--   drop table if exists public.tracked_items cascade;
-- then run everything below.
-- ============================================================

create extension if not exists "pgcrypto";

-- A team / agency. Everyone with the same join_code shares one list.
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Which users belong to which team.
create table if not exists public.memberships (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Documents now belong to a team, not one person.
create table if not exists public.tracked_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  created_by  uuid default auth.uid(),
  client      text,
  category    text not null,
  doc         text not null,
  due_date    date not null,
  freq_months int  not null default 12,
  lead_days   int  not null default 30,
  notes       text,
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists tracked_items_org_due_idx on public.tracked_items (org_id, due_date);

-- Membership check that bypasses RLS (prevents policy recursion).
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

-- ---- Row Level Security ----
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;
alter table public.tracked_items enable row level security;

create policy "org: members read" on public.organizations
  for select using (public.is_org_member(id));

create policy "mem: see own and teammates" on public.memberships
  for select using (user_id = auth.uid() or public.is_org_member(org_id));

create policy "items: team read"   on public.tracked_items for select using (public.is_org_member(org_id));
create policy "items: team insert" on public.tracked_items for insert with check (public.is_org_member(org_id));
create policy "items: team update" on public.tracked_items for update using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "items: team delete" on public.tracked_items for delete using (public.is_org_member(org_id));

-- ---- Create / join a team via secure functions ----
create or replace function public.create_org(p_name text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  insert into public.organizations(name)
  values (coalesce(nullif(trim(p_name), ''), 'My agency'))
  returning * into o;
  insert into public.memberships(org_id, user_id, role) values (o.id, auth.uid(), 'admin');
  return o;
end; $$;

create or replace function public.join_org(p_code text)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare o public.organizations;
begin
  select * into o from public.organizations where join_code = lower(trim(p_code));
  if o.id is null then raise exception 'No team found for that code'; end if;
  insert into public.memberships(org_id, user_id, role)
  values (o.id, auth.uid(), 'member')
  on conflict do nothing;
  return o;
end; $$;

grant execute on function public.create_org(text) to authenticated;
grant execute on function public.join_org(text)  to authenticated;
