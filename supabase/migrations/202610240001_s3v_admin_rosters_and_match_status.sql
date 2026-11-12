-- Update 04.2: apply AFTER 202610230001_s3v_multi_tournaments.sql.
-- No existing tables or competition records are dropped.
-- Pre-publication check: a 15-player squad cannot be built from fewer than 15
-- team-cap-eligible registrations, even if many players belong to one club.
create or replace function public.s3v_guard_publish_capacity()
returns trigger language plpgsql set search_path = '' as $$
declare
  capped_total integer;
  role_row record;
  first_match timestamptz;
begin
  if old.status = 'draft' and new.status = 'upcoming' then
    select min(starts_at) into first_match from public.s3v_fixtures where tournament_id=new.id;
    if first_match is null then raise exception 'Upload a tournament schedule before publishing'; end if;
    if new.registration_deadline is null or new.registration_deadline > first_match then
      raise exception 'Registration deadline must be at or before the first scheduled match';
    end if;
    select coalesce(sum(least(team_count,new.max_per_team)),0) into capped_total
      from (select count(*)::integer as team_count from public.s3v_registrations
        where tournament_id=new.id and available=true group by team_id) teams;
    if capped_total < new.squad_size then
      raise exception 'Roster cannot fill % slots under the % players-per-team limit',new.squad_size,new.max_per_team;
    end if;
    for role_row in select role_code,minimum from (values ('WK',2),('BAT',5),('AR',3),('BOWL',5)) v(role_code,minimum) loop
      select coalesce(sum(least(team_role_count,new.max_per_team)),0) into capped_total
        from (select count(*)::integer team_role_count from public.s3v_registrations
          where tournament_id=new.id and available=true and role=role_row.role_code group by team_id) r;
      if capped_total < role_row.minimum then
        raise exception 'Not enough eligible % players across teams for the % per-team cap',role_row.role_code,new.max_per_team;
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists s3v_guard_publish_capacity_trigger on public.s3v_tournaments;
create trigger s3v_guard_publish_capacity_trigger before update on public.s3v_tournaments
for each row execute function public.s3v_guard_publish_capacity();

-- Preserve immutable published match identifiers, participants, start time and venue.
-- Allow only specific admin-only result-status transitions without pretending
-- that a completed fixture automatically has verified fantasy scores.
create or replace function public.s3v_guard_tournament_children()
returns trigger language plpgsql set search_path = '' as $$
declare id_value uuid; current_status text;
begin
  id_value := case when tg_op='DELETE' then old.tournament_id else new.tournament_id end;
  select status into current_status from public.s3v_tournaments where id=id_value;
  if current_status is null then raise exception 'Unknown tournament'; end if;
  if current_status <> 'draft' then
    if tg_table_name='s3v_fixtures' and tg_op='UPDATE' and public.s3v_is_admin() then
      if (new.id,new.tournament_id,new.match_id,new.starts_at,new.team_a_id,new.team_b_id,new.venue,new.round_name,new.created_at)
        is distinct from
         (old.id,old.tournament_id,old.match_id,old.starts_at,old.team_a_id,old.team_b_id,old.venue,old.round_name,old.created_at) then
        raise exception 'Published fixture structure cannot be edited';
      end if;
      if new.status <> old.status and not (
        (old.status='scheduled' and new.status in ('live','completed','postponed','cancelled','abandoned'))
        or (old.status='live' and new.status in ('completed','abandoned'))
        or (old.status='postponed' and new.status in ('scheduled','cancelled'))
      ) then
        raise exception 'Invalid fixture status transition';
      end if;
      if new.scorecard_url is distinct from old.scorecard_url and new.scorecard_url is not null
        and new.scorecard_url !~* '^https://[^[:space:]]+$' then
        raise exception 'Scorecard reference must be an HTTPS link';
      end if;
      if (new.status,new.scorecard_url) is distinct from (old.status,old.scorecard_url) then
        insert into public.s3v_admin_audit(tournament_id,actor_id,action,payload)
        values(old.tournament_id,auth.uid(),'published_fixture_status_update',
          jsonb_build_object('fixtureId',old.id,'previousStatus',old.status,'newStatus',new.status,
                             'scorecardUrl',new.scorecard_url));
      end if;
      return new;
    end if;
    raise exception 'Published tournament data is locked; use an audited correction process';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
