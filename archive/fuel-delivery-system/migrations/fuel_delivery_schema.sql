-- SK POS - Fuel + Delivery + Pin System
-- Run this file in Supabase SQL Editor before using modules v83-v89.

alter table customer add column if not exists lat numeric;
alter table customer add column if not exists lng numeric;
alter table customer add column if not exists pin_updated_at timestamptz;
alter table customer add column if not exists signup_consent boolean default true;

create table if not exists shop_config (
  id integer primary key default 1,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  distance_multiplier numeric(4,2) default 1.3,
  routing_service text default 'osrm_demo',
  routing_api_key text,
  fuel_excess_ratio numeric(4,2) default 1.5,
  pin_too_close_meters integer default 500,
  kmpl_drop_warning_ratio numeric(4,2) default 0.6,
  updated_at timestamptz default now()
);
alter table shop_config add column if not exists pickup_lat numeric(10,7);
alter table shop_config add column if not exists pickup_lng numeric(10,7);
alter table shop_config add column if not exists distance_multiplier numeric(4,2) default 1.3;
alter table shop_config add column if not exists routing_service text default 'osrm_demo';
alter table shop_config add column if not exists routing_api_key text;
alter table shop_config add column if not exists fuel_excess_ratio numeric(4,2) default 1.5;
alter table shop_config add column if not exists pin_too_close_meters integer default 500;
alter table shop_config add column if not exists kmpl_drop_warning_ratio numeric(4,2) default 0.6;
alter table shop_config add column if not exists updated_at timestamptz default now();

create table if not exists vehicle (
  id bigserial primary key,
  plate_no text not null unique,
  name text,
  fuel_type text not null,
  tank_capacity_l numeric(8,2),
  avg_kmpl numeric(5,2),
  driver_default text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists fuel_tank (
  id bigserial primary key,
  name text not null,
  fuel_type text not null,
  capacity_l numeric(10,2),
  current_level_l numeric(10,2) default 0,
  last_audit_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists fuel_tank_refill (
  id bigserial primary key,
  tank_id bigint references fuel_tank(id),
  qty_l numeric(10,2) not null,
  price_per_l numeric(8,2),
  total_cost numeric(12,2),
  supplier text,
  invoice_no text,
  refilled_at timestamptz default now(),
  staff_name text,
  note text
);

create table if not exists fuel_dispense (
  id bigserial primary key,
  tank_id bigint references fuel_tank(id),
  vehicle_id bigint references vehicle(id),
  qty_l numeric(10,2) not null,
  cost_per_l_snapshot numeric(8,2),
  total_cost numeric(12,2),
  odometer_km numeric(10,1),
  bill_ids jsonb default '[]'::jsonb,
  photo_url text,
  dispensed_at timestamptz default now(),
  staff_name text,
  note text
);
create index if not exists fuel_dispense_vehicle_idx on fuel_dispense (vehicle_id, dispensed_at desc);
create index if not exists fuel_dispense_billids_idx on fuel_dispense using gin(bill_ids);

create table if not exists vehicle_external_refill (
  id bigserial primary key,
  vehicle_id bigint references vehicle(id),
  qty_l numeric(10,2),
  price_per_l numeric(8,2),
  total_cost numeric(12,2),
  station_name text,
  receipt_no text,
  refilled_at timestamptz default now(),
  staff_name text,
  note text
);

create table if not exists delivery_assignment (
  id bigserial primary key,
  bill_id text unique,
  vehicle_id bigint references vehicle(id),
  driver_name text,
  vehicle_assigned_at timestamptz,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  drop_lat numeric(10,7),
  drop_lng numeric(10,7),
  drop_address text,
  drop_pinned_by text,
  drop_pinned_at timestamptz,
  distance_km_estimate numeric(8,2),
  distance_km numeric(8,2),
  route_polyline text,
  route_source text,
  route_calculated_at timestamptz,
  odometer_start_km numeric(10,1),
  odometer_end_km numeric(10,1),
  estimated_fuel_l numeric(8,3),
  actual_fuel_l numeric(8,3),
  status text default 'pending' check (status in ('pending','pinned','driving','done','cancel')),
  started_at timestamptz,
  completed_at timestamptz,
  completion_photo_url text,
  anomaly_flags jsonb default '[]'::jsonb,
  note text,
  created_at timestamptz default now()
);
create index if not exists delivery_status_idx on delivery_assignment (status, created_at desc);
create index if not exists delivery_vehicle_date_idx on delivery_assignment (vehicle_id, completed_at desc);

create table if not exists delivery_pin_token (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  mode text not null check (mode in ('new_customer','update_address','bill_pin')),
  bill_id text,
  customer_id bigint,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_payload jsonb,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists pin_token_lookup_idx on delivery_pin_token (token);

create table if not exists vehicle_trip (
  id bigserial primary key,
  vehicle_id bigint references vehicle(id) not null,
  driver_name text,
  purpose text not null,
  purpose_note text,
  destination_label text,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  drop_lat numeric(10,7),
  drop_lng numeric(10,7),
  distance_km_estimate numeric(8,2),
  distance_km numeric(8,2),
  route_polyline text,
  route_source text,
  estimated_fuel_l numeric(8,3),
  actual_fuel_l numeric(8,3),
  status text default 'planned' check (status in ('planned','driving','done','cancel')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  photo_url text,
  note text,
  staff_name text,
  created_at timestamptz default now()
);
create index if not exists vehicle_trip_vehicle_idx on vehicle_trip (vehicle_id, started_at desc);

create table if not exists vehicle_odometer_log (
  id bigserial primary key,
  vehicle_id bigint references vehicle(id) not null,
  odometer_km numeric(10,1) not null,
  recorded_at timestamptz default now(),
  recorded_by text,
  system_km_since_last numeric(8,2),
  actual_km_since_last numeric(8,2),
  variance_pct numeric(5,2),
  flag_mismatch boolean default false,
  note text
);
create index if not exists odometer_log_vehicle_idx on vehicle_odometer_log (vehicle_id, recorded_at desc);

create table if not exists bill_draft (
  id text primary key,
  token_id uuid references delivery_pin_token(id) on delete set null,
  staff_name text not null,
  cart_snapshot jsonb not null,
  checkout_state jsonb not null,
  subtotal numeric(12,2),
  total numeric(12,2),
  item_count integer,
  pin_mode text,
  status text default 'waiting' check (status in ('waiting','ready','resumed','expired','cancelled')),
  completed_bill_id text,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  resumed_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists bill_draft_staff_status_idx on bill_draft (staff_name, status);
create index if not exists bill_draft_expiry_idx on bill_draft (status, expires_at);

create or replace function sk_mark_draft_ready() returns trigger as $$
begin
  if new.used_at is not null and (old.used_at is null) then
    update bill_draft set status = 'ready'
      where token_id = new.id and status = 'waiting';
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_pin_token_mark_draft_ready on delivery_pin_token;
create trigger trg_pin_token_mark_draft_ready
  after update of used_at on delivery_pin_token
  for each row execute function sk_mark_draft_ready();

create or replace function sk_fuel_dispense(
  p_tank_id bigint, p_vehicle_id bigint, p_qty_l numeric,
  p_bill_ids jsonb default '[]'::jsonb,
  p_staff text default null, p_note text default null,
  p_odometer numeric default null
) returns bigint as $$
declare new_id bigint; cur_level numeric; avg_cost numeric;
begin
  select current_level_l into cur_level from fuel_tank where id = p_tank_id for update;
  if cur_level is null then raise exception 'fuel_tank_not_found'; end if;
  if cur_level < p_qty_l then raise exception 'fuel_tank_insufficient'; end if;

  select price_per_l into avg_cost from fuel_tank_refill
    where tank_id = p_tank_id and price_per_l is not null
    order by refilled_at desc limit 1;

  update fuel_tank set current_level_l = current_level_l - p_qty_l where id = p_tank_id;

  insert into fuel_dispense (
    tank_id, vehicle_id, qty_l, cost_per_l_snapshot, total_cost,
    bill_ids, staff_name, note, odometer_km
  ) values (
    p_tank_id, p_vehicle_id, p_qty_l, avg_cost, coalesce(avg_cost,0) * p_qty_l,
    coalesce(p_bill_ids, '[]'::jsonb), p_staff, p_note, p_odometer
  ) returning id into new_id;
  return new_id;
end; $$ language plpgsql security invoker;

create or replace function sk_fuel_tank_refill(
  p_tank_id bigint, p_qty_l numeric, p_price_per_l numeric,
  p_supplier text default null, p_invoice text default null,
  p_staff text default null, p_note text default null
) returns bigint as $$
declare new_id bigint;
begin
  perform 1 from fuel_tank where id = p_tank_id for update;
  update fuel_tank set current_level_l = coalesce(current_level_l,0) + p_qty_l,
                      last_audit_at = now()
    where id = p_tank_id;
  insert into fuel_tank_refill (
    tank_id, qty_l, price_per_l, total_cost, supplier, invoice_no, staff_name, note
  ) values (
    p_tank_id, p_qty_l, p_price_per_l, p_qty_l * coalesce(p_price_per_l,0),
    p_supplier, p_invoice, p_staff, p_note
  ) returning id into new_id;
  return new_id;
end; $$ language plpgsql security invoker;

create or replace function sk_complete_delivery(
  p_bill_id text,
  p_vehicle_id bigint,
  p_driver_name text,
  p_distance_km numeric,
  p_route_polyline text,
  p_route_source text,
  p_odometer_start numeric default null,
  p_odometer_end numeric default null,
  p_photo_url text default null,
  p_note text default null,
  p_staff text default null
) returns jsonb as $$
declare
  v_assignment_id bigint;
  v_completed_at timestamptz := now();
  v_link_window_start timestamptz;
  v_linked_dispense_ids bigint[];
begin
  select id into v_assignment_id from delivery_assignment
    where bill_id = p_bill_id for update;
  if v_assignment_id is null then
    raise exception 'delivery_assignment_not_found_for_bill: %', p_bill_id;
  end if;

  update delivery_assignment set
    vehicle_id = p_vehicle_id,
    driver_name = p_driver_name,
    vehicle_assigned_at = v_completed_at,
    distance_km = coalesce(
      case when p_odometer_start is not null and p_odometer_end is not null
        then greatest(0, p_odometer_end - p_odometer_start)
        else null end,
      p_distance_km
    ),
    route_polyline = p_route_polyline,
    route_source = case
      when p_odometer_start is not null and p_odometer_end is not null then 'odometer'
      else p_route_source
    end,
    route_calculated_at = v_completed_at,
    odometer_start_km = p_odometer_start,
    odometer_end_km = p_odometer_end,
    completion_photo_url = p_photo_url,
    note = p_note,
    completed_at = v_completed_at,
    status = 'done'
  where id = v_assignment_id;

  v_link_window_start := date_trunc('day', v_completed_at) + interval '6 hours';

  with linkable as (
    select id from fuel_dispense
    where vehicle_id = p_vehicle_id
      and dispensed_at between v_link_window_start and v_completed_at + interval '1 hour'
      and (bill_ids is null or jsonb_array_length(bill_ids) = 0)
    for update
  ), updated as (
    update fuel_dispense set bill_ids = coalesce(bill_ids, '[]'::jsonb) || to_jsonb(p_bill_id::text)
    where id in (select id from linkable)
    returning id
  )
  select array_agg(id) into v_linked_dispense_ids from updated;

  update delivery_assignment set
    actual_fuel_l = (
      select coalesce(sum(qty_l), 0) from fuel_dispense
      where vehicle_id = p_vehicle_id and bill_ids ? p_bill_id
    )
  where id = v_assignment_id;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'linked_dispense_ids', coalesce(v_linked_dispense_ids, array[]::bigint[]),
    'completed_at', v_completed_at
  );
end; $$ language plpgsql security invoker;

create or replace function sk_record_odometer(
  p_vehicle_id bigint,
  p_odometer_km numeric,
  p_staff text default null,
  p_note text default null
) returns jsonb as $$
declare
  v_prev vehicle_odometer_log%rowtype;
  v_system_km numeric := 0;
  v_actual_km numeric := 0;
  v_variance numeric := 0;
  v_flag boolean := false;
  v_new_id bigint;
begin
  select * into v_prev from vehicle_odometer_log
    where vehicle_id = p_vehicle_id order by recorded_at desc limit 1;
  if v_prev.id is not null then
    v_actual_km := p_odometer_km - v_prev.odometer_km;
    select coalesce(sum(distance_km), 0) into v_system_km from (
      select distance_km from delivery_assignment
       where vehicle_id = p_vehicle_id and completed_at > v_prev.recorded_at and status = 'done'
      union all
      select distance_km from vehicle_trip
       where vehicle_id = p_vehicle_id and completed_at > v_prev.recorded_at and status = 'done'
    ) t;
    if v_actual_km > 0 then
      v_variance := abs(v_actual_km - v_system_km) / v_actual_km * 100;
    end if;
    v_flag := v_variance > 15;
  end if;
  insert into vehicle_odometer_log (
    vehicle_id, odometer_km, recorded_by, system_km_since_last,
    actual_km_since_last, variance_pct, flag_mismatch, note
  ) values (
    p_vehicle_id, p_odometer_km, p_staff, v_system_km,
    v_actual_km, v_variance, v_flag, p_note
  ) returning id into v_new_id;
  return jsonb_build_object(
    'log_id', v_new_id,
    'system_km', v_system_km,
    'actual_km', v_actual_km,
    'variance_pct', v_variance,
    'flag_mismatch', v_flag
  );
end; $$ language plpgsql security invoker;

-- ── Resume / Cancel / Cleanup bill_draft ───────────────────────
create or replace function sk_resume_bill_draft(p_draft_id text, p_staff text)
returns jsonb as $$
declare
  draft_row bill_draft%rowtype;
  pin_payload jsonb;
begin
  select * into draft_row from bill_draft
    where id = p_draft_id and staff_name = p_staff
    for update;
  if draft_row.id is null then raise exception 'bill_draft_not_found_or_not_owned'; end if;
  if draft_row.status = 'resumed' then raise exception 'bill_draft_already_resumed'; end if;
  if draft_row.status in ('cancelled', 'expired') then
    raise exception 'bill_draft_unavailable: %', draft_row.status;
  end if;
  if draft_row.expires_at < now() then
    update bill_draft set status = 'expired' where id = p_draft_id;
    raise exception 'bill_draft_expired';
  end if;

  if draft_row.token_id is not null then
    select used_payload into pin_payload from delivery_pin_token where id = draft_row.token_id;
  end if;

  update bill_draft set status = 'resumed', resumed_at = now() where id = p_draft_id;

  return jsonb_build_object(
    'id', draft_row.id,
    'cart', draft_row.cart_snapshot,
    'checkout_state', draft_row.checkout_state,
    'token_id', draft_row.token_id,
    'pin_payload', pin_payload
  );
end; $$ language plpgsql security invoker;

create or replace function sk_cancel_bill_draft(p_draft_id text, p_staff text)
returns void as $$
begin
  update bill_draft set status = 'cancelled', cancelled_at = now()
    where id = p_draft_id and staff_name = p_staff
      and status in ('waiting', 'ready');
  if not found then raise exception 'bill_draft_not_found_or_not_owned'; end if;
end; $$ language plpgsql security invoker;

create or replace function sk_cleanup_expired_drafts()
returns integer as $$
declare cnt integer;
begin
  with x as (
    update bill_draft set status = 'expired'
    where status in ('waiting', 'ready') and expires_at < now()
    returning 1
  ) select count(*) into cnt from x;
  return cnt;
end; $$ language plpgsql security invoker;

grant execute on function sk_fuel_dispense to anon, authenticated;
grant execute on function sk_fuel_tank_refill to anon, authenticated;
grant execute on function sk_complete_delivery to anon, authenticated;
grant execute on function sk_record_odometer to anon, authenticated;
grant execute on function sk_resume_bill_draft to anon, authenticated;
grant execute on function sk_cancel_bill_draft to anon, authenticated;
grant execute on function sk_cleanup_expired_drafts to anon, authenticated;

-- ── POS client access policies ─────────────────────────────────────────────
-- This app runs from the browser with the Supabase anon key. If RLS is enabled
-- on these tables, the checkout QR flow and fuel settings need explicit allow
-- policies. Keep this section idempotent so the migration can be re-run.
grant select, insert, update, delete on
  shop_config,
  vehicle,
  fuel_tank,
  fuel_tank_refill,
  fuel_dispense,
  vehicle_external_refill,
  delivery_assignment,
  delivery_pin_token,
  vehicle_trip,
  vehicle_odometer_log,
  bill_draft
to anon, authenticated;

grant select, insert, update on customer to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists "sk_pos_shop_config_all" on shop_config;
create policy "sk_pos_shop_config_all" on shop_config
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_vehicle_all" on vehicle;
create policy "sk_pos_vehicle_all" on vehicle
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_fuel_tank_all" on fuel_tank;
create policy "sk_pos_fuel_tank_all" on fuel_tank
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_fuel_tank_refill_all" on fuel_tank_refill;
create policy "sk_pos_fuel_tank_refill_all" on fuel_tank_refill
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_fuel_dispense_all" on fuel_dispense;
create policy "sk_pos_fuel_dispense_all" on fuel_dispense
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_vehicle_external_refill_all" on vehicle_external_refill;
create policy "sk_pos_vehicle_external_refill_all" on vehicle_external_refill
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_delivery_assignment_all" on delivery_assignment;
create policy "sk_pos_delivery_assignment_all" on delivery_assignment
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_delivery_pin_token_all" on delivery_pin_token;
create policy "sk_pos_delivery_pin_token_all" on delivery_pin_token
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_vehicle_trip_all" on vehicle_trip;
create policy "sk_pos_vehicle_trip_all" on vehicle_trip
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_vehicle_odometer_log_all" on vehicle_odometer_log;
create policy "sk_pos_vehicle_odometer_log_all" on vehicle_odometer_log
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_bill_draft_all" on bill_draft;
create policy "sk_pos_bill_draft_all" on bill_draft
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sk_pos_customer_pin_form" on customer;
create policy "sk_pos_customer_pin_form" on customer
  for all to anon, authenticated using (true) with check (true);

create or replace view vw_vehicle_daily_summary as
select
  v.id as vehicle_id,
  v.plate_no,
  v.name as vehicle_name,
  coalesce(d.day, f.day)::date as day,
  coalesce(d.delivery_count, 0) as delivery_count,
  coalesce(d.total_km, 0) as total_km,
  coalesce(f.total_fuel_l, 0) as total_fuel_l,
  coalesce(f.total_fuel_cost, 0) as total_fuel_cost,
  case when coalesce(f.total_fuel_l, 0) > 0
    then round(coalesce(d.total_km, 0) / f.total_fuel_l, 2)
    else null end as actual_kmpl,
  v.avg_kmpl as baseline_kmpl
from vehicle v
left join (
  select vehicle_id, day, sum(delivery_count) as delivery_count, sum(total_km) as total_km
  from (
    select vehicle_id, date_trunc('day', completed_at)::date as day,
      count(*) as delivery_count, sum(distance_km) as total_km
    from delivery_assignment
    where status = 'done' and completed_at is not null
    group by vehicle_id, date_trunc('day', completed_at)
    union all
    select vehicle_id, date_trunc('day', completed_at)::date as day,
      0 as delivery_count, sum(distance_km) as total_km
    from vehicle_trip
    where status = 'done' and completed_at is not null
    group by vehicle_id, date_trunc('day', completed_at)
  ) u group by vehicle_id, day
) d on d.vehicle_id = v.id
left join (
  select vehicle_id, date_trunc('day', dispensed_at)::date as day,
    sum(qty_l) as total_fuel_l, sum(total_cost) as total_fuel_cost
  from fuel_dispense
  group by vehicle_id, date_trunc('day', dispensed_at)
) f on f.vehicle_id = v.id and (f.day = d.day or d.day is null)
where v.active = true;

grant select on vw_vehicle_daily_summary to anon, authenticated;
