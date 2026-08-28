-- SK POS: ระบบบัญชีน้ำมันรถ
-- ติดตั้งครั้งเดียวที่ Supabase Dashboard > SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists public.fuel_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null
    check (transaction_type in ('receive', 'dispense')),
  fuel_type text not null default 'ดีเซล'
    check (length(trim(fuel_type)) > 0),
  occurred_at timestamptz not null default now(),
  liters numeric(12,3) not null
    check (liters > 0),
  vehicle_plate text,
  driver_name text,
  supplier text,
  odometer_km numeric(12,1)
    check (odometer_km is null or odometer_km >= 0),
  note text,
  staff_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fuel_dispense_vehicle_driver_required check (
    transaction_type = 'receive'
    or (
      length(trim(coalesce(vehicle_plate, ''))) > 0
      and length(trim(coalesce(driver_name, ''))) > 0
    )
  )
);

alter table public.fuel_transactions
  alter column fuel_type set default 'ดีเซล';

-- ระบบร้านนี้ใช้น้ำมันดีเซลชนิดเดียว: บังคับรายการใหม่ให้เป็นดีเซล
-- ใช้ NOT VALID เพื่อไม่ทำให้การติดตั้งซ้ำล้ม หากเคยมีข้อมูลชนิดอื่นจากรุ่นทดลอง
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fuel_transactions'::regclass
      and conname = 'fuel_transactions_diesel_only'
  ) then
    alter table public.fuel_transactions
      add constraint fuel_transactions_diesel_only
      check (fuel_type = 'ดีเซล') not valid;
  end if;
end $$;

comment on table public.fuel_transactions is
  'บัญชีรับน้ำมันเข้าและเติมน้ำมันให้รถ คำนวณคงเหลือจาก receive - dispense';
comment on column public.fuel_transactions.vehicle_plate is
  'ทะเบียนรถ ณ เวลาที่เติม เก็บเป็น snapshot ไม่ผูกกับข้อมูลรถปัจจุบัน';
comment on column public.fuel_transactions.driver_name is
  'ชื่อคนขับ ณ เวลาที่เติม เก็บเป็น snapshot';

create index if not exists fuel_transactions_occurred_idx
  on public.fuel_transactions (occurred_at desc);
create index if not exists fuel_transactions_type_idx
  on public.fuel_transactions (fuel_type, transaction_type, occurred_at desc);
create index if not exists fuel_transactions_vehicle_idx
  on public.fuel_transactions (vehicle_plate, occurred_at desc)
  where vehicle_plate is not null;

-- ป้องกันการเติมออกเกินยอดคงเหลือ แม้มีหลายเครื่องบันทึกพร้อมกัน
create or replace function public.sk_validate_fuel_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_fuel_type text;
  new_fuel_type text;
  fuel_name text;
  excluded_id uuid;
  projected_balance numeric(14,3);
begin
  if tg_op <> 'INSERT' then
    old_fuel_type := old.fuel_type;
    excluded_id := old.id;
  end if;
  if tg_op <> 'DELETE' then
    new_fuel_type := new.fuel_type;
  end if;

  -- ล็อกแยกตามชนิดน้ำมันและเรียงชื่อเสมอ เพื่อลด race condition/deadlock
  for fuel_name in
    select distinct value
    from unnest(array[old_fuel_type, new_fuel_type]) as fuel_values(value)
    where value is not null
    order by value
  loop
    perform pg_advisory_xact_lock(hashtextextended('sk-pos-fuel:' || fuel_name, 0));
  end loop;

  for fuel_name in
    select distinct value
    from unnest(array[old_fuel_type, new_fuel_type]) as fuel_values(value)
    where value is not null
    order by value
  loop
    select coalesce(sum(
      case when transaction_type = 'receive' then liters else -liters end
    ), 0)
    into projected_balance
    from public.fuel_transactions
    where fuel_type = fuel_name
      and (excluded_id is null or id <> excluded_id);

    if tg_op <> 'DELETE' and new_fuel_type = fuel_name then
      projected_balance := projected_balance
        + case when new.transaction_type = 'receive' then new.liters else -new.liters end;
    end if;

    if projected_balance < -0.0005 then
      raise exception 'น้ำมัน % คงเหลือไม่เพียงพอ (ยอดหลังรายการ % ลิตร)',
        fuel_name, projected_balance
        using errcode = '23514';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.sk_fuel_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fuel_00_validate_stock on public.fuel_transactions;
create trigger fuel_00_validate_stock
before insert or update or delete on public.fuel_transactions
for each row execute function public.sk_validate_fuel_stock();

drop trigger if exists fuel_99_set_updated_at on public.fuel_transactions;
create trigger fuel_99_set_updated_at
before update on public.fuel_transactions
for each row execute function public.sk_fuel_set_updated_at();

alter table public.fuel_transactions enable row level security;

drop policy if exists fuel_transactions_select on public.fuel_transactions;
create policy fuel_transactions_select
on public.fuel_transactions for select
to anon, authenticated
using (true);

drop policy if exists fuel_transactions_insert on public.fuel_transactions;
create policy fuel_transactions_insert
on public.fuel_transactions for insert
to anon, authenticated
with check (true);

drop policy if exists fuel_transactions_update on public.fuel_transactions;
create policy fuel_transactions_update
on public.fuel_transactions for update
to anon, authenticated
using (true) with check (true);

drop policy if exists fuel_transactions_delete on public.fuel_transactions;
create policy fuel_transactions_delete
on public.fuel_transactions for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on public.fuel_transactions to anon, authenticated;

-- ฟังก์ชันตรวจสอบสำหรับให้หน้าโปรแกรมแยกได้ว่า "ยังไม่ติดตั้ง" หรือ "ข้อมูลว่าง"
create or replace function public.sk_fuel_health()
returns boolean
language sql
stable
set search_path = public
as $$
  select to_regclass('public.fuel_transactions') is not null;
$$;

grant execute on function public.sk_fuel_health() to anon, authenticated;

-- เปิด Realtime เพื่อรองรับการต่อยอดซิงก์หลายเครื่อง (รันซ้ำได้)
do $$
begin
  alter publication supabase_realtime add table public.fuel_transactions;
exception
  when duplicate_object then null;
end $$;

-- ตรวจสอบหลังติดตั้ง: ต้องคืนค่า 0 แถวได้โดยไม่มี error
select id, transaction_type, fuel_type, occurred_at, liters
from public.fuel_transactions
order by occurred_at desc
limit 1;
