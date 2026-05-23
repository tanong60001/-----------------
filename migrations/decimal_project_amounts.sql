-- รองรับยอดเงินโครงการแบบทศนิยม และกัน error bigint จากยอดที่มีจุดทศนิยม
-- อาการที่แก้: บันทึกยอดโครงการแบบ 604.8 แล้วระบบฟ้อง bigint / analytics นับรายการ retry
-- วิธีใช้: เปิด Supabase SQL Editor แล้วรันไฟล์นี้ 1 ครั้ง

begin;

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('โครงการ', 'budget'),
      ('โครงการ', 'total_expenses'),
      ('โครงการ', 'total_goods_cost'),
      ('โครงการ', 'total_billed'),
      ('รายจ่ายโครงการ', 'amount'),
      ('งวดงาน', 'amount'),
      ('งวดงาน', 'percent'),
      ('cash_transaction', 'amount'),
      ('cash_transaction', 'change_amt'),
      ('cash_transaction', 'net_amount'),
      ('cash_transaction', 'balance_after')
    ) as cols(table_name, column_name)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = item.table_name
        and column_name = item.column_name
    ) then
      execute format(
        'alter table public.%I alter column %I type numeric using nullif(%I::text, '''')::numeric',
        item.table_name,
        item.column_name,
        item.column_name
      );
    end if;
  end loop;
end $$;

commit;
