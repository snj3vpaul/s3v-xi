-- S3V XI update 04. Apply in Supabase SQL editor before configuring the Vercel frontend.
-- No service-role key is required by the application. Permissions are verified by RLS.
create extension if not exists pgcrypto;

create table if not exists public.s3v_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.s3v_tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 150),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  season integer not null check (season between 2000 and 2100),
  description text not null default '',
  format text not null default 'T20' check (format in ('T20','ODI','Other')),
  starts_on date not null,
  ends_on date not null,
  timezone text not null default 'America/Toronto',
  status text not null default 'draft' check (status in ('draft','upcoming','active','completed')),
  logo_url text,
  squad_size integer not null default 15 check (squad_size = 15),
  max_per_team integer not null default 3 check (max_per_team between 1 and 15),
  registration_deadline timestamptz,
  scoring_rules jsonb not null default '{"version":"s3v-default-v1"}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint s3v_tournament_date_order check (ends_on >= starts_on)
);
create unique index if not exists s3v_tournament_nameseason_idx on public.s3v_tournaments(lower(name),season);
create table if not exists public.s3v_cricket_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.s3v_tournaments(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 150),
  created_at timestamptz not null default now(),
  unique (id,tournament_id)
);
create unique index if not exists s3v_team_name_per_tournament_idx on public.s3v_cricket_teams(tournament_id,lower(name));
create table if not exists public.s3v_players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) between 2 and 150),
  cricheroes_id text unique,
  created_at timestamptz not null default now()
);
create table if not exists public.s3v_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.s3v_tournaments(id) on delete restrict,
  team_id uuid not null,
  player_id uuid not null references public.s3v_players(id) on delete restrict,
  role text not null check (role in ('WK','BAT','AR','BOWL')),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (team_id,tournament_id) references public.s3v_cricket_teams(id,tournament_id) on delete restrict,
  unique(tournament_id,player_id)
);
create table if not exists public.s3v_fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.s3v_tournaments(id) on delete restrict,
  match_id text not null check(length(trim(match_id)) between 1 and 100),
  starts_at timestamptz not null,
  team_a_id uuid not null,
  team_b_id uuid not null,
  venue text not null default '',
  round_name text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','postponed','cancelled','abandoned')),
  scorecard_url text,
  created_at timestamptz not null default now(),
  foreign key (team_a_id,tournament_id) references public.s3v_cricket_teams(id,tournament_id) on delete restrict,
  foreign key (team_b_id,tournament_id) references public.s3v_cricket_teams(id,tournament_id) on delete restrict,
  check (team_a_id <> team_b_id),
  unique (tournament_id, match_id)
);
create table if not exists public.s3v_fantasy_squads (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.s3v_tournaments(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_ids uuid[] not null,
  bench_ids uuid[] not null,
  captain_id uuid not null,
  vice_captain_id uuid not null,
  rules_max_per_team integer not null default 3,
  updated_at timestamptz not null default now(),
  unique(tournament_id,user_id)
);
-- Prepared for match-specific scoring; no live import or manager-point aggregation is claimed in Update 04.
alter table public.s3v_fixtures add constraint s3v_fixture_id_tournament_unique unique(id,tournament_id);
create table if not exists public.s3v_match_performances (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null,
  tournament_id uuid not null,
  player_id uuid not null,
  source_kind text not null check(source_kind in ('admin_csv','admin_manual','authorized_api')),
  source_reference text,
  statistics jsonb not null default '{}'::jsonb,
  fantasy_points numeric(10,2),
  scoring_version text not null default 's3v-t20-v1',
  verification text not null default 'provisional' check(verification in ('provisional','verified','finalized')),
  updated_at timestamptz not null default now(),
  foreign key(fixture_id,tournament_id) references public.s3v_fixtures(id,tournament_id) on delete restrict,
  foreign key(tournament_id,player_id) references public.s3v_registrations(tournament_id,player_id) on delete restrict,
  unique(fixture_id,player_id)
);
create table if not exists public.s3v_admin_audit (
  id bigint generated always as identity primary key,
  tournament_id uuid references public.s3v_tournaments(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.s3v_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.s3v_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.s3v_is_admin() from public;
grant execute on function public.s3v_is_admin() to anon, authenticated;

alter table public.s3v_admins enable row level security;
alter table public.s3v_tournaments enable row level security;
alter table public.s3v_cricket_teams enable row level security;
alter table public.s3v_players enable row level security;
alter table public.s3v_registrations enable row level security;
alter table public.s3v_fixtures enable row level security;
alter table public.s3v_fantasy_squads enable row level security;
alter table public.s3v_admin_audit enable row level security;
alter table public.s3v_match_performances enable row level security;

create policy "Admin self lookup" on public.s3v_admins for select to authenticated using(user_id=auth.uid());
create policy "Published tournaments" on public.s3v_tournaments for select to anon,authenticated using(status <> 'draft' or public.s3v_is_admin());
create policy "Tournament admin writes" on public.s3v_tournaments for all to authenticated using(public.s3v_is_admin()) with check(public.s3v_is_admin());
create policy "Tournament teams read" on public.s3v_cricket_teams for select to anon,authenticated using(exists(select 1 from public.s3v_tournaments t where t.id=tournament_id));
create policy "Tournament teams admin writes" on public.s3v_cricket_teams for all to authenticated using(public.s3v_is_admin()) with check(public.s3v_is_admin());
create policy "Published player identities" on public.s3v_players for select to anon,authenticated using(public.s3v_is_admin() or exists (select 1 from public.s3v_registrations r join public.s3v_tournaments t on t.id=r.tournament_id where r.player_id=public.s3v_players.id and t.status <> 'draft'));
create policy "Player admin writes" on public.s3v_players for all to authenticated using(public.s3v_is_admin()) with check(public.s3v_is_admin());
create policy "Tournament registrations read" on public.s3v_registrations for select to anon,authenticated using(exists(select 1 from public.s3v_tournaments t where t.id=tournament_id));
create policy "Registration admin writes" on public.s3v_registrations for all to authenticated using(public.s3v_is_admin()) with check(public.s3v_is_admin());
create policy "Fixture read" on public.s3v_fixtures for select to anon,authenticated using(exists(select 1 from public.s3v_tournaments t where t.id=tournament_id));
create policy "Fixture admin writes" on public.s3v_fixtures for all to authenticated using(public.s3v_is_admin()) with check(public.s3v_is_admin());
create policy "Squad owner read" on public.s3v_fantasy_squads for select to authenticated using(user_id=auth.uid() or public.s3v_is_admin());
create policy "Squad owner create" on public.s3v_fantasy_squads for insert to authenticated with check(user_id=auth.uid());
create policy "Squad owner update" on public.s3v_fantasy_squads for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "Published verified match stats" on public.s3v_match_performances for select to anon,authenticated
 using (public.s3v_is_admin() or (verification <> 'provisional' and exists(select 1 from public.s3v_tournaments t where t.id=tournament_id and t.status <> 'draft')));
create policy "Match results admin writes" on public.s3v_match_performances for all to authenticated using(public.s3v_is_admin()) with check(public.s3v_is_admin());
create policy "Admin audit read" on public.s3v_admin_audit for select to authenticated using(public.s3v_is_admin());
create policy "Admin audit insert" on public.s3v_admin_audit for insert to authenticated with check(public.s3v_is_admin() and actor_id=auth.uid());

-- Database is authoritative for every squad write, including direct API bypasses.
create or replace function public.s3v_enforce_squad()
returns trigger language plpgsql set search_path = '' as $$
declare
  tournament_record public.s3v_tournaments%rowtype;
  eligible integer;
  role_count integer;
  roles text[] := array['WK','BAT','AR','BOWL'];
  required_count integer[] := array[2,5,3,5];
  index_val integer;
begin
  select * into tournament_record from public.s3v_tournaments where id=new.tournament_id for share;
  if not found then raise exception 'Tournament not found'; end if;
  if tournament_record.status not in ('active','upcoming') then raise exception 'Tournament is not accepting fantasy squads'; end if;
  if tournament_record.registration_deadline is not null and now() >= tournament_record.registration_deadline then raise exception 'Fantasy registration deadline has passed'; end if;
  if array_length(new.player_ids,1) is distinct from tournament_record.squad_size
      or (select count(distinct x) from unnest(new.player_ids) x) <> tournament_record.squad_size then
    raise exception 'Select exactly % unique players', tournament_record.squad_size;
  end if;
  if array_length(new.bench_ids,1) is distinct from tournament_record.squad_size - 11
      or (select count(distinct x) from unnest(new.bench_ids) x) <> tournament_record.squad_size-11
      or exists(select 1 from unnest(new.bench_ids) x where not x=any(new.player_ids)) then
    raise exception 'Select exactly four distinct reserve players';
  end if;
  if new.captain_id=new.vice_captain_id or not new.captain_id=any(new.player_ids) or not new.vice_captain_id=any(new.player_ids)
      or new.captain_id=any(new.bench_ids) or new.vice_captain_id=any(new.bench_ids) then
    raise exception 'Captain and vice-captain must be different starting XI players';
  end if;
  select count(*) into eligible from public.s3v_registrations r where r.tournament_id=new.tournament_id and r.available=true and r.player_id=any(new.player_ids);
  if eligible <> tournament_record.squad_size then raise exception 'All players must be registered and available in the selected tournament'; end if;
  if exists(select 1 from public.s3v_registrations r where r.tournament_id=new.tournament_id and r.player_id=any(new.player_ids)
    group by r.team_id having count(*) > tournament_record.max_per_team) then
    raise exception 'Maximum % players permitted from the same cricket team', tournament_record.max_per_team;
  end if;
  for index_val in 1..4 loop
    select count(*) into role_count from public.s3v_registrations r where r.tournament_id=new.tournament_id and r.player_id=any(new.player_ids) and r.role=roles[index_val];
    if role_count <> required_count[index_val] then raise exception 'Incorrect % squad composition: need %', roles[index_val], required_count[index_val]; end if;
  end loop;
  new.rules_max_per_team := tournament_record.max_per_team;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists s3v_enforce_squad_trigger on public.s3v_fantasy_squads;
create trigger s3v_enforce_squad_trigger before insert or update on public.s3v_fantasy_squads for each row execute function public.s3v_enforce_squad();

-- Freeze fixture timing/results after kickoff, and freeze registered teams once a fantasy entry is saved.
create or replace function public.s3v_guard_fixture()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('completed','cancelled','abandoned') and (new.team_a_id,new.team_b_id,new.starts_at,new.status) is distinct from (old.team_a_id,old.team_b_id,old.starts_at,old.status) then
    raise exception 'Finalized fixtures cannot be edited; use a reviewed correction workflow';
  end if;
  if old.starts_at <= now() and (new.team_a_id,new.team_b_id,new.starts_at) is distinct from (old.team_a_id,old.team_b_id,old.starts_at) then
    raise exception 'Already started fixtures cannot be silently moved';
  end if;
  return new;
end $$;
drop trigger if exists s3v_guard_fixture_trigger on public.s3v_fixtures;
create trigger s3v_guard_fixture_trigger before update on public.s3v_fixtures for each row execute function public.s3v_guard_fixture();

create or replace function public.s3v_guard_registration()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.s3v_fantasy_squads s where s.tournament_id=old.tournament_id and old.player_id=any(s.player_ids)) then
    if tg_op = 'DELETE' then raise exception 'Player is in a fantasy squad; review existing lineups before removing registration'; end if;
    if (new.team_id,new.role,new.available,new.player_id) is distinct from (old.team_id,old.role,old.available,old.player_id) then
      raise exception 'Player is in a fantasy squad; a manual audited resolution is required';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists s3v_guard_registration_trigger on public.s3v_registrations;
create trigger s3v_guard_registration_trigger before update or delete on public.s3v_registrations for each row execute function public.s3v_guard_registration();

-- Protect published competition structure even when callers bypass Next.js API routes.
create or replace function public.s3v_guard_published_tournament()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'draft' and new.status not in ('draft','upcoming') then raise exception 'Publish draft tournaments before activating them'; end if;
  if old.status = 'draft' and new.status = 'upcoming' then
    if new.registration_deadline is null then raise exception 'Set registration deadline before publication'; end if;
    if (select count(*) from public.s3v_cricket_teams where tournament_id=old.id) < ceiling(15.0/new.max_per_team) then raise exception 'Not enough teams to satisfy fantasy squad cap'; end if;
    if (select count(*) from public.s3v_registrations where tournament_id=old.id and available=true) < 15 then raise exception 'Not enough registered players'; end if;
    if not exists(select 1 from public.s3v_fixtures where tournament_id=old.id) then raise exception 'Schedule required before publication'; end if;
  end if;
  if old.status <> 'draft' then
    if (old.name,old.slug,old.season,old.format,old.starts_on,old.ends_on,old.timezone,old.squad_size,old.max_per_team,old.registration_deadline,old.scoring_rules)
       is distinct from
       (new.name,new.slug,new.season,new.format,new.starts_on,new.ends_on,new.timezone,new.squad_size,new.max_per_team,new.registration_deadline,new.scoring_rules) then
      raise exception 'Published tournament configuration is immutable';
    end if;
    if new.status <> old.status and not ((old.status='upcoming' and new.status='active') or (old.status='active' and new.status='completed')) then
      raise exception 'Invalid published tournament status transition';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists s3v_tournament_guard on public.s3v_tournaments;
create trigger s3v_tournament_guard before update on public.s3v_tournaments for each row execute function public.s3v_guard_published_tournament();

create or replace function public.s3v_guard_tournament_children()
returns trigger language plpgsql set search_path = '' as $$
declare id_value uuid; current_status text;
begin
  id_value := case when tg_op='DELETE' then old.tournament_id else new.tournament_id end;
  select status into current_status from public.s3v_tournaments where id=id_value;
  if current_status <> 'draft' then raise exception 'Published tournament data is locked; use an audited correction process'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists s3v_team_draft_guard on public.s3v_cricket_teams;
create trigger s3v_team_draft_guard before insert or update or delete on public.s3v_cricket_teams for each row execute function public.s3v_guard_tournament_children();
drop trigger if exists s3v_registration_draft_guard on public.s3v_registrations;
create trigger s3v_registration_draft_guard before insert or update or delete on public.s3v_registrations for each row execute function public.s3v_guard_tournament_children();
drop trigger if exists s3v_fixture_draft_guard on public.s3v_fixtures;
create trigger s3v_fixture_draft_guard before insert or update or delete on public.s3v_fixtures for each row execute function public.s3v_guard_tournament_children();

-- Server invokes these atomic import functions with a validated JWT; each batch is a single DB transaction.
create or replace function public.s3v_import_players(p_tournament_id uuid, p_rows jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare rec jsonb; team_uuid uuid; player_uuid uuid; n integer:=0; ext text; player_name text; pos text; begin
  if not public.s3v_is_admin() then raise exception 'Administrator required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'Invalid import size'; end if;
  if not exists(select 1 from public.s3v_tournaments where id=p_tournament_id and status='draft') then raise exception 'Player imports only permitted while tournament is draft'; end if;
  for rec in select value from jsonb_array_elements(p_rows) loop
    player_name := trim(rec->>'name'); pos:=upper(trim(rec->>'role')); ext:=nullif(trim(coalesce(rec->>'external_id','')),'');
    if length(player_name)<2 or pos not in ('WK','BAT','AR','BOWL') then raise exception 'Invalid player name or role'; end if;
    select id into team_uuid from public.s3v_cricket_teams where tournament_id=p_tournament_id and lower(name)=lower(trim(rec->>'team'));
    if team_uuid is null then raise exception 'Unknown participating cricket team for player %', player_name; end if;
    player_uuid := null;
    if ext is not null then select id into player_uuid from public.s3v_players where cricheroes_id=ext; end if;
    if player_uuid is null then
      select r.player_id into player_uuid from public.s3v_registrations r join public.s3v_players p on p.id=r.player_id
        where r.tournament_id=p_tournament_id and lower(p.full_name)=lower(player_name) limit 1;
    end if;
    if player_uuid is null then
      insert into public.s3v_players(full_name,cricheroes_id) values(player_name,ext) returning id into player_uuid;
    end if;
    if exists(select 1 from public.s3v_registrations where tournament_id=p_tournament_id and player_id=player_uuid) then
      raise exception 'Duplicate player registration for %', player_name;
    end if;
    insert into public.s3v_registrations(tournament_id,team_id,player_id,role,available) values(p_tournament_id,team_uuid,player_uuid,pos,coalesce((rec->>'available')::boolean,true));
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.s3v_import_fixtures(p_tournament_id uuid, p_rows jsonb, p_replace boolean default false)
returns integer language plpgsql security invoker set search_path = '' as $$
declare rec jsonb; team_a uuid; team_b uuid; n integer:=0; tz text; dt timestamptz; begin
  if not public.s3v_is_admin() then raise exception 'Administrator required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Invalid import size'; end if;
  select timezone into tz from public.s3v_tournaments where id=p_tournament_id and status='draft';
  if tz is null then raise exception 'Schedule imports only permitted while tournament is draft'; end if;
  for rec in select value from jsonb_array_elements(p_rows) loop
    select id into team_a from public.s3v_cricket_teams where tournament_id=p_tournament_id and lower(name)=lower(trim(rec->>'team_a'));
    select id into team_b from public.s3v_cricket_teams where tournament_id=p_tournament_id and lower(name)=lower(trim(rec->>'team_b'));
    if team_a is null or team_b is null or team_a=team_b then raise exception 'Invalid cricket team in fixture %', rec->>'match_id'; end if;
    if length(trim(rec->>'match_id'))=0 then raise exception 'Fixture missing match ID'; end if;
    if not p_replace and exists(select 1 from public.s3v_fixtures where tournament_id=p_tournament_id and match_id=trim(rec->>'match_id')) then raise exception 'Existing fixture: % (check Replace to update)', rec->>'match_id'; end if;
    dt := ((rec->>'match_date')::date + (rec->>'match_time')::time) at time zone tz;
    insert into public.s3v_fixtures(tournament_id,match_id,starts_at,team_a_id,team_b_id,venue,round_name,status)
      values(p_tournament_id,trim(rec->>'match_id'),dt,team_a,team_b,coalesce(rec->>'venue',''),coalesce(rec->>'round',''),coalesce(nullif(rec->>'status',''),'scheduled'))
      on conflict(tournament_id,match_id) do update set starts_at=excluded.starts_at,team_a_id=excluded.team_a_id,team_b_id=excluded.team_b_id,venue=excluded.venue,round_name=excluded.round_name,status=excluded.status;
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.s3v_publish_tournament(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare t public.s3v_tournaments%rowtype; begin
  if not public.s3v_is_admin() then raise exception 'Administrator required'; end if;
  select * into t from public.s3v_tournaments where id=p_id for update;
  if not found or t.status <> 'draft' then raise exception 'Only draft tournaments may be published'; end if;
  if t.registration_deadline is null then raise exception 'Set a registration deadline before publishing'; end if;
  if (select count(*) from public.s3v_cricket_teams where tournament_id=p_id) < ceiling(15.0/t.max_per_team) then raise exception 'Not enough cricket teams for the squad limit'; end if;
  if (select count(*) from public.s3v_registrations where tournament_id=p_id and available) < 15 then raise exception 'At least 15 available registered players required'; end if;
  if exists(select 1 from (values ('WK',2),('BAT',5),('AR',3),('BOWL',5)) as roles(role,n)
      where (select count(*) from public.s3v_registrations r where r.tournament_id=p_id and r.available and r.role=roles.role)<roles.n) then
    raise exception 'Insufficient eligible players in one or more roles';
  end if;
  if not exists(select 1 from public.s3v_fixtures where tournament_id=p_id) then raise exception 'Upload fixtures before publishing'; end if;
  update public.s3v_tournaments set status='upcoming', updated_at=now() where id=p_id;
  insert into public.s3v_admin_audit(tournament_id,actor_id,action) values(p_id,auth.uid(),'publish');
end $$;

revoke execute on function public.s3v_import_players(uuid,jsonb), public.s3v_import_fixtures(uuid,jsonb,boolean),public.s3v_publish_tournament(uuid) from public;
grant execute on function public.s3v_import_players(uuid,jsonb), public.s3v_import_fixtures(uuid,jsonb,boolean), public.s3v_publish_tournament(uuid) to authenticated;
