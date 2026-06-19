-- รองรับจำนวนสต็อกและยอดเงินแบบทศนิยมสำหรับงานรับสินค้า/แปลงหน่วย
-- อาการที่แก้:
--   invalid input syntax for type bigint: "604.8"   (จำนวนสต็อก)
--   invalid input syntax for type bigint: "96497.5" (ยอดรวมใบรับสินค้า/เจ้าหนี้)
-- วิธีใช้: เปิด Supabase SQL Editor แล้วรันไฟล์นี้ 1 ครั้ง

begin;

do $$
declare
  target_column record;
begin
  for target_column in
    select * from (values
      -- สินค้า / สต็อก
      ('สินค้า', 'stock'),
      ('สินค้า', 'min_stock'),
      ('สินค้า', 'cost'),
      ('สินค้า', 'price'),

      -- ประวัติสต็อก
      ('stock_movement', 'qty'),
      ('stock_movement', 'stock_before'),
      ('stock_movement', 'stock_after'),

      -- หน่วยขาย / ราคาในหน่วยขาย
      ('product_units', 'conv_rate'),
      ('product_units', 'price_per_unit'),

      -- ใบรับสินค้า
      ('purchase_order', 'total'),
      ('purchase_item', 'qty'),
      ('purchase_item', 'received_qty'),
      ('purchase_item', 'cost_per_unit'),
      ('purchase_item', 'total'),

      -- รายจ่ายและเงินสดที่เกิดจากใบรับสินค้า
      ('รายจ่าย', 'amount'),
      ('cash_transaction', 'amount'),
      ('cash_transaction', 'change_amt'),
      ('cash_transaction', 'net_amount'),
      ('cash_transaction', 'balance_after'),

      -- เจ้าหนี้จากใบรับสินค้าเครดิต
      ('เจ้าหนี้', 'amount'),
      ('เจ้าหนี้', 'paid_amount'),
      ('เจ้าหนี้', 'balance')
    ) as cols(table_name, column_name)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_column.table_name
        and column_name = target_column.column_name
    ) then
      execute format(
        'alter table public.%I alter column %I type numeric using nullif(%I::text, '''')::numeric',
        target_column.table_name,
        target_column.column_name,
        target_column.column_name
      );
    end if;
  end loop;
end $$;

commit;
