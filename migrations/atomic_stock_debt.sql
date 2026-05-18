-- ════════════════════════════════════════════════════════════════════
-- SK POS — Atomic Stock & Customer Delta RPCs
-- ════════════════════════════════════════════════════════════════════
-- วัตถุประสงค์:
--   ทำให้การตัดสต็อกและการอัปเดตยอดลูกค้า "atomic" บนฝั่ง Postgres
--   ป้องกัน race condition กรณีหลายเครื่อง POS ขายพร้อมกัน
--
-- วิธีใช้:
--   1. เปิด Supabase Dashboard → SQL Editor
--   2. คัดลอกทั้งไฟล์นี้วาง แล้วกด Run
--   3. ตรวจว่าฟังก์ชันถูกสร้างใน Database → Functions
--   4. ฝั่ง JS (app.js → SK_STOCK / SK_CUSTOMER) จะตรวจสอบและใช้ RPC โดยอัตโนมัติ
--      ถ้ายังไม่ติดตั้ง จะ fallback เป็น read-modify-write ตามเดิม (ไม่ break)
--
-- หมายเหตุ:
--   - ไม่ลบ/แก้ตารางใด ๆ — เพิ่มเฉพาะ function
--   - ใช้ SECURITY INVOKER (สิทธิ์ของ user ที่เรียก) เพื่อไม่ bypass RLS
-- ════════════════════════════════════════════════════════════════════


-- ── 1) ตัดสต็อกแบบ atomic ────────────────────────────────────────────
-- ใช้ตอนขาย (delta ติดลบ) หรือคืนสินค้า (delta บวก)
-- คืนค่า stock_before, stock_after เพื่อบันทึกลง stock_movement
create or replace function public.sk_apply_stock_delta(
  p_product_id uuid,
  p_delta numeric
)
returns table (stock_before numeric, stock_after numeric)
language plpgsql
security invoker
as $$
declare
  v_before numeric;
  v_after numeric;
begin
  -- lock แถวกัน race condition
  select stock into v_before
  from "สินค้า"
  where id = p_product_id
  for update;

  if v_before is null then
    raise exception 'product not found: %', p_product_id;
  end if;

  v_after := coalesce(v_before, 0) + coalesce(p_delta, 0);

  update "สินค้า"
  set stock = v_after,
      updated_at = now()
  where id = p_product_id;

  return query select v_before, v_after;
end;
$$;

-- ถ้า "สินค้า".id เป็น bigint/text ให้แก้ p_product_id ตามจริง
-- ตัวอย่างถ้า id เป็น bigint:
--   create or replace function public.sk_apply_stock_delta(
--     p_product_id bigint, p_delta numeric
--   ) returns table (stock_before numeric, stock_after numeric) ...

grant execute on function public.sk_apply_stock_delta(uuid, numeric) to anon, authenticated;


-- ── 2) อัปเดต total_purchase / debt_amount / visit_count แบบ atomic ─
create or replace function public.sk_apply_customer_deltas(
  p_customer_id uuid,
  p_total_delta numeric default 0,
  p_debt_delta numeric default 0,
  p_visit_delta integer default 0
)
returns void
language plpgsql
security invoker
as $$
begin
  update customer
  set
    total_purchase = greatest(0, coalesce(total_purchase, 0) + coalesce(p_total_delta, 0)),
    debt_amount    = greatest(0, coalesce(debt_amount, 0)    + coalesce(p_debt_delta, 0)),
    visit_count    = greatest(0, coalesce(visit_count, 0)    + coalesce(p_visit_delta, 0))
  where id = p_customer_id;

  if not found then
    raise exception 'customer not found: %', p_customer_id;
  end if;
end;
$$;

grant execute on function public.sk_apply_customer_deltas(uuid, numeric, numeric, integer) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════
-- การทดสอบ (optional):
-- ════════════════════════════════════════════════════════════════════
-- select * from sk_apply_stock_delta('<product-uuid>'::uuid, -1);
-- select sk_apply_customer_deltas('<customer-uuid>'::uuid, 100, 100, 1);
--
-- ถ้า id เป็น text แทน uuid ให้ cast ตามจริง:
--   sk_apply_stock_delta('abc'::text, -1)
-- ════════════════════════════════════════════════════════════════════
