-- รองรับจำนวนสต็อกแบบทศนิยมสำหรับงานรับสินค้า/แปลงหน่วย
-- อาการที่แก้: invalid input syntax for type bigint: "604.8"
-- วิธีใช้: เปิด Supabase SQL Editor แล้วรันไฟล์นี้ 1 ครั้ง

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'สินค้า' and column_name = 'stock'
  ) then
    execute 'alter table public."สินค้า" alter column stock type numeric using stock::numeric';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'สินค้า' and column_name = 'min_stock'
  ) then
    execute 'alter table public."สินค้า" alter column min_stock type numeric using min_stock::numeric';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movement' and column_name = 'qty'
  ) then
    execute 'alter table public.stock_movement alter column qty type numeric using qty::numeric';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movement' and column_name = 'stock_before'
  ) then
    execute 'alter table public.stock_movement alter column stock_before type numeric using stock_before::numeric';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movement' and column_name = 'stock_after'
  ) then
    execute 'alter table public.stock_movement alter column stock_after type numeric using stock_after::numeric';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_item' and column_name = 'qty'
  ) then
    execute 'alter table public.purchase_item alter column qty type numeric using qty::numeric';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'purchase_item' and column_name = 'received_qty'
  ) then
    execute 'alter table public.purchase_item alter column received_qty type numeric using received_qty::numeric';
  end if;
end $$;

commit;
