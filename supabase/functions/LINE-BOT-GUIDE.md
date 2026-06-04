# 📱 คู่มือ: บอทแจ้งยอดร้านเข้า LINE กลุ่ม (ประหยัดโควต้า 300/เดือน)

LINE Messaging API ฟรี **300 ข้อความ/เดือน** → จึง **ไม่แจ้งทุกบิล** แต่แจ้งแบบ "by exception":

**แจ้งทันที เฉพาะเหตุการณ์สำคัญ (เกิดไม่บ่อย)**
- 🟠 ให้เครดิต / ค้างชำระ
- ↩️ คืนสินค้า / ยกเลิกบิล
- 💸 รายจ่ายก้อนใหญ่ (เกินเกณฑ์)
- 💎 บิลใหญ่พิเศษ (ออปชัน — ปิดไว้เป็นค่าเริ่มต้น)

**สรุปสิ้นวัน 1 ครั้ง/วัน** = ยอดขาย/แยกวิธีจ่าย/รับจริง/ค้างชำระ/รายจ่าย/เงินสดสุทธิ

→ ใช้โควต้าจริงประมาณ **30–60 ข้อความ/เดือน** สบายๆ

ไฟล์:
```
supabase/functions/
  line-bill-notify/index.ts     ← แจ้งเหตุการณ์สำคัญ (บิลขาย + รายจ่าย)
  line-daily-summary/index.ts   ← สรุปยอดรายวัน (cron)
  line-webhook/index.ts         ← ดึง groupId
```
Supabase project: `thfswrvnyhuqmdazjfhd`

---

## ส่วนที่ 1 — เอา Token จาก LINE
ที่สร้าง Messaging API channel แล้ว (Channel ID 2010297522) เหลือ:
1. https://developers.line.biz/console/ → channel นี้ → แท็บ **Messaging API**
2. เลื่อนล่างสุด **Channel access token (long-lived)** → กด **Issue** → ก๊อป = **LINE_TOKEN**
   - (คนละตัวกับ "ความลับแชนแนล/Channel secret" นะครับ)
3. ที่ LINE OA Manager → ปิด **Auto-reply** และ **Greeting** (กันบอทตอบมั่ว)

---

## ส่วนที่ 2 — Deploy ฟังก์ชัน (ทำบนคอมเครื่องนี้)
```bash
npm i -g supabase
cd "c:\Users\OMEN\Desktop\โปรแกรมร้าน"
supabase login
supabase link --project-ref thfswrvnyhuqmdazjfhd

# ตั้งค่า (ใส่ token จริง)
supabase secrets set LINE_TOKEN="xxxxToken"
supabase secrets set ALERT_EXP_MIN="2000"     # รายจ่าย ≥ 2000 บาท ถึงแจ้ง (ปรับได้)
supabase secrets set ALERT_BILL_MIN="0"       # 0 = ไม่แจ้งบิลใหญ่ (ใส่เลขถ้าอยากแจ้ง เช่น 20000)

# deploy
supabase functions deploy line-webhook --no-verify-jwt
supabase functions deploy line-bill-notify --no-verify-jwt
supabase functions deploy line-daily-summary --no-verify-jwt
```

---

## ส่วนที่ 3 — เอา groupId
1. LINE Console → Messaging API → **Webhook URL** ใส่:
   `https://thfswrvnyhuqmdazjfhd.supabase.co/functions/v1/line-webhook`
   → กด **Verify** (ต้อง Success) → เปิด **Use webhook = ON**
2. เชิญบอทเข้ากลุ่ม LINE ร้าน → พิมพ์ `id` ในกลุ่ม → บอทตอบ **groupId**
3. ```bash
   supabase secrets set LINE_GROUP_ID="Cxxxxxxxx"
   supabase functions deploy line-bill-notify --no-verify-jwt
   supabase functions deploy line-daily-summary --no-verify-jwt
   ```
   (deploy ซ้ำให้รับ groupId ใหม่)

---

## ส่วนที่ 4 — ผูกแจ้งเหตุการณ์สำคัญ (Database Webhook 3 อัน)
Supabase Dashboard → **Database → Webhooks → Create** ทำ 3 อัน (Type: Supabase Edge Functions):

| Hook | Table | Events | ฟังก์ชัน |
|---|---|---|---|
| line-alert-bill | **บิลขาย** | ✅ Insert | `line-bill-notify` |
| line-alert-exp  | **รายจ่าย** | ✅ Insert | `line-bill-notify` |
| line-attendance | **เช็คชื่อ** | ✅ Insert | `line-attendance-report` |

> `line-attendance-report` จะส่งการ์ดสรุปก็ต่อเมื่อพนักงานทุกคนลงเวลาครบของวันนั้น

ลองในแอป: ขายแบบ**ค้างชำระ** / **คืนสินค้า** / บันทึก**รายจ่าย ≥ 2000** → ต้องเด้งเข้ากลุ่ม
> ขายปกติจ่ายครบ = ไม่เด้ง (ไปรวมในสรุปสิ้นวัน) — ประหยัดโควต้า

---

## ส่วนที่ 5 — สรุปยอดรายวัน (cron ตอนปิดร้าน)
Supabase → **SQL Editor** วางแล้ว Run:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('line-daily-summary', '30 10 * * *',  -- 17:30 ไทย (= 10:30 UTC)
  $$ select net.http_post(
       url := 'https://thfswrvnyhuqmdazjfhd.supabase.co/functions/v1/line-daily-summary',
       headers := '{"Content-Type":"application/json"}'::jsonb) $$);
```
ทดสอบเดี๋ยวนั้น: เปิด URL นี้ในเบราว์เซอร์ (ดูย้อนวันใส่ `?date=2026-06-04`)
`https://thfswrvnyhuqmdazjfhd.supabase.co/functions/v1/line-daily-summary`

---

## ปรับแต่งเกณฑ์ได้ทีหลัง
```bash
supabase secrets set ALERT_EXP_MIN="5000"    # อยากให้แจ้งเฉพาะรายจ่ายใหญ่ขึ้น
supabase secrets set ALERT_BILL_MIN="30000"  # เปิดแจ้งบิลใหญ่ ≥ 3 หมื่น
# แล้ว deploy line-bill-notify ซ้ำ
```

## โควต้าโดยประมาณ
- สรุปสิ้นวัน 30/เดือน + เหตุการณ์สำคัญ ~ไม่กี่ครั้ง/วัน = รวมมักต่ำกว่า 100/เดือน ✅
- ถ้าใกล้เต็ม 300 → ขึ้น ALERT_EXP_MIN / ปิด ALERT_BILL_MIN

ติดตรงไหนส่งภาพมาได้เลยครับ
