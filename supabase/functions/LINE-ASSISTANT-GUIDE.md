# คู่มือติดตั้งเมนู PDF ในกลุ่ม LINE ร้าน SK วัสดุ

## ผลลัพธ์ที่ได้

ระบบใช้ LINE Flex Message เป็นกล่องเมนูขนาดใหญ่ 2 คอลัมน์ 3 แถวในห้องแชต ไม่ใช้ Rich Menu และไม่มีหน้าเว็บคั่น

เมนูมี 6 รายการ:

1. เช็คชื่อวันนี้
2. ยอดขายวันนี้
3. จำนวนเงินในลิ้นชัก
4. ลูกค้าค้างชำระทั้งหมด
5. รายการขนส่ง
6. สินค้าขายดี 30 วัน

เมื่อแตะเมนู LINE จะส่ง postback ให้ Edge Function แบบไม่พิมพ์ข้อความแทนผู้ใช้ จากนั้นระบบจึงอ่านข้อมูลล่าสุด สร้าง PDF และตอบกลับเป็นการ์ดพร้อมปุ่มดาวน์โหลด

PDF ทั้ง 6 แบบใช้ภาษาคนและรูปแบบมินิมอลเหมือนกัน: เริ่มจากประโยคสรุปสั้น ตัวเลขสำคัญไม่เกิน 4 ช่อง แล้วจึงแสดงรายละเอียดที่ต้องรู้ โดยใช้สีอ่อนและเรียงเรื่องเร่งด่วนไว้ก่อน

ไฟล์ PDF อยู่ใน Supabase Storage แบบ private ลิงก์มีอายุ 24 ชั่วโมง และระบบใช้ไฟล์เดิมได้ 5 นาทีเพื่อลดการอ่านฐานข้อมูล การสร้างไฟล์ และ Egress ซ้ำจากการกดติด ๆ กัน

เมื่อเช็คชื่อครบพนักงานที่ทำงานทุกคน ระบบส่งการ์ดสรุปเข้า LINE ให้อัตโนมัติหนึ่งครั้งต่อวัน ไม่ต้องกดเมนู และมีไฟล์ marker ป้องกัน Database Webhook ที่ยิงพร้อมกันส่งข้อความซ้ำ

## ข้อจำกัดของ LINE ที่ต้องทราบ

Messaging API ไม่มีเหตุการณ์ “ผู้ใช้เปิดห้องแชต” และไม่อนุญาตให้บอทเปิด bottom sheet ของแอป LINE เองทุกครั้งที่เข้ากลุ่ม จึงทำแบบในภาพตัวอย่างให้ลอยจากขอบล่างโดยอัตโนมัติ 100% ไม่ได้

วิธีที่ใกล้ที่สุดโดยไม่ใช้เว็บและไม่ใช้ Rich Menu คือ:

- ส่งกล่องเมนูให้อัตโนมัติเมื่อบอทถูกเชิญเข้ากลุ่ม (`join` event)
- ปักกล่องเมนูเป็นประกาศของกลุ่มด้วยมือ 1 ครั้ง
- หลังจากนั้นสมาชิกแตะประกาศเพื่อกลับมาที่กล่องเมนูและกดรับ PDF ได้ทันที ไม่ต้องพิมพ์เรียกบอททุกครั้ง

LINE Messaging API ส่งไฟล์ PDF เป็นข้อความโดยตรงไม่ได้ ระบบจึงส่งลิงก์ดาวน์โหลดแบบ signed URL ที่เปิดไฟล์ PDF โดยตรง ไม่ใช่หน้าเว็บแดชบอร์ด

## ฟังก์ชันที่ใช้

- `line-attendance-report` รับ LINE webhook แสดงเมนู สร้าง PDF ดูแลลิงก์ดาวน์โหลด และแจ้งเช็คชื่อครบอัตโนมัติ
- `line-cashdrawer` เป็นแหล่งข้อมูลยอดขายและจำนวนเงินในลิ้นชัก

`line-webhook` ตัวเก่าไม่ต้องตั้งเป็น Webhook URL เพราะ LINE Channel ตั้ง Webhook หลักได้เพียง URL เดียว

## 1. เตรียม Supabase CLI

เปิด PowerShell ที่โฟลเดอร์โปรแกรม:

```powershell
cd "C:\Users\OMEN\Desktop\โปรแกรมร้าน"
npm install -g supabase
supabase login
supabase link --project-ref thfswrvnyhuqmdazjfhd
```

## 2. ตั้ง Secret

```powershell
supabase secrets set LINE_TOKEN="Channel access token ตัวจริง"
supabase secrets set LINE_CHANNEL_SECRET="Channel secret ตัวจริง"
supabase secrets set LINE_GROUP_ID="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

`SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` มีให้อัตโนมัติใน Edge Functions ไม่ต้องนำ service role key ไปใส่ใน LINE หรือหน้าเว็บใด ๆ

ไม่ต้องตั้ง `LINE_SELECTOR_URL` อีกต่อไป เพราะเวอร์ชันนี้ถอดเว็บเลือกเมนูออกแล้ว

## 3. Deploy

```powershell
supabase functions deploy line-cashdrawer --no-verify-jwt
supabase functions deploy line-attendance-report --no-verify-jwt
```

ต้องใช้ `--no-verify-jwt` เพราะ LINE ส่ง `x-line-signature` ไม่ได้ส่ง Supabase JWT โค้ดจะตรวจ HMAC ด้วย `LINE_CHANNEL_SECRET` ก่อนประมวลผลทุก webhook

ถ้า Deploy จาก Supabase Dashboard ให้นำไฟล์ `line-attendance-report/index.ts` ขึ้นเป็นไฟล์หลัก ไฟล์นี้ bundle ตัวสร้าง PDF ไว้ในตัวแล้ว จึงไม่เกิดข้อผิดพลาด `Module not found pdf-renderer.ts`

สำหรับการแก้โค้ดครั้งถัดไป ให้แก้ `source.ts` และ `pdf-renderer.ts` แล้วสร้าง `index.ts` ใหม่ด้วย:

```powershell
npx esbuild supabase/functions/line-attendance-report/source.ts --bundle --format=esm --platform=neutral --target=es2022 --external:https://* --banner:js="// @ts-nocheck" --outfile=supabase/functions/line-attendance-report/index.ts
```

## 4. ตั้งค่า LINE Developers

ที่ LINE Developers Console > Messaging API:

1. เปิด `Allow bot to join group chats`
2. ตั้ง Webhook URL เป็น

   ```text
   https://thfswrvnyhuqmdazjfhd.supabase.co/functions/v1/line-attendance-report
   ```

3. กด `Verify` ให้ขึ้น Success
4. เปิด `Use webhook`
5. ปิด Auto-reply และ Greeting ที่ซ้ำซ้อนใน LINE Official Account Manager
6. เชิญบอทเข้ากลุ่มร้าน เมนูจะถูกส่งทันทีจาก `join` event

หากยังไม่ทราบ Group ID ให้เชิญบอทหลัง deploy โดยยังไม่ตั้ง `LINE_GROUP_ID` ก่อน แล้วดูบรรทัด `joined source=C...` ใน Supabase Dashboard > Edge Functions > `line-attendance-report` > Logs จากนั้นตั้ง Secret และ deploy ฟังก์ชันนี้ซ้ำ

## 5. ทำให้กลุ่มเดิมใช้งานได้ทันที

ถ้าบอทอยู่ในกลุ่มก่อน deploy เวอร์ชันนี้ จะไม่มี `join` event ใหม่ ให้ทำเพียงครั้งเดียว:

1. พิมพ์ `เมนู` ในกลุ่ม
2. เมื่อกล่องเมนูปรากฏ ให้กดค้างที่ข้อความแล้วเลือก `ประกาศ` หรือ `Announcement`
3. สมาชิกแตะประกาศเพื่อย้อนกลับมาที่เมนูได้ตลอด

อีกวิธีคือเอาบอทออกแล้วเชิญกลับเข้ากลุ่ม แต่ไม่จำเป็นถ้าส่งคำว่า `เมนู` หนึ่งครั้งได้

## 6. เปิดแจ้งเช็คชื่ออัตโนมัติ

ไปที่ Supabase Dashboard > Database > Webhooks แล้วสร้างหรือเปิด webhook ดังนี้:

| ค่า | ตั้งเป็น |
|---|---|
| Name | `line-attendance` |
| Table | `เช็คชื่อ` |
| Events | `INSERT` และ `UPDATE` |
| Type | Supabase Edge Functions |
| Function | `line-attendance-report` |

ระบบจะตรวจข้อมูลจริงทั้งวันทุกครั้ง แต่ส่ง LINE เฉพาะเมื่อพนักงานที่สถานะ `ทำงาน` ลงข้อมูลครบทุกคน และส่งเพียงครั้งเดียวต่อวัน

## 7. ปิดงานอัตโนมัติอื่นที่ไม่จำเป็น

เพื่อประหยัดโควต้า LINE และ Edge Function:

- ปิด cron `line-daily-summary` ถ้าไม่ต้องการสรุปอัตโนมัติตอนเย็น
- คง `ENABLE_LINE_CASHDRAWER_PUSH` เป็น `false` หากไม่ต้องการข้อความทุกครั้งที่เปิดหรือปิดลิ้นชัก

ตรวจและลบ cron เดิม:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'line-daily-summary';

select cron.unschedule('line-daily-summary');
```

## 8. ทดสอบ

1. แตะ `เช็คชื่อวันนี้` ต้องได้ PDF ที่มีสรุปเช้านี้ ตัวเลขสำคัญ และรายชื่อพนักงานครบ
2. เปิดรอบลิ้นชัก แล้วแตะ `ยอดขายวันนี้` และ `จำนวนเงินในลิ้นชัก` ต้องได้ข้อมูลแบบสรุป ไม่ใช่ข้อความจาก Flex เรียงต่อกัน
3. แตะ `ลูกค้าค้างชำระทั้งหมด` และตรวจยอดรวมกับหน้าโปรแกรม
4. แตะ `รายการขนส่ง` และตรวจว่างานเกินกำหนด/ส่งวันนี้อยู่ก่อนงานถัดไป
5. แตะ `สินค้าขายดี 30 วัน` และตรวจอันดับกับบิลจริง
6. ในวันทดสอบที่ยังเช็คชื่อไม่ครบ ให้ลงข้อมูลคนสุดท้าย ระบบต้องส่งสรุปเข้า LINE เอง
7. แก้ไขเช็คชื่อซ้ำหลังส่งแล้ว ต้องไม่มีข้อความสรุปใบที่สองในวันเดียวกัน
8. กดรายงานเดิมซ้ำภายใน 5 นาที การ์ดต้องระบุว่าใช้ไฟล์แคช
9. เปิดลิงก์ PDF หลัง 24 ชั่วโมง ต้องหมดอายุ ให้แตะกล่องเมนูเดิมเพื่อสร้างลิงก์ใหม่

## แก้ปัญหา

### Verify ขึ้น 401

`LINE_CHANNEL_SECRET` ไม่ตรงกับ Channel หรือ Webhook URL ชี้ผิดฟังก์ชัน ให้ตั้ง Secret ใหม่และ deploy `line-attendance-report` ซ้ำ

### กดแล้วสร้าง PDF ไม่สำเร็จ

เปิด Logs ของ `line-attendance-report` และ `line-cashdrawer` แล้วตรวจชื่อตาราง/คอลัมน์กับฐานข้อมูลปัจจุบัน รวมถึงตรวจว่า bucket `line-assistant` สร้างได้

### เช็คชื่อครบแล้วแต่ LINE ไม่แจ้ง

ตรวจว่า Database Webhook `line-attendance` เปิดอยู่ เลือกตาราง `เช็คชื่อ` และเปิดทั้ง `INSERT`/`UPDATE` จากนั้นดู Logs ของ `line-attendance-report` หากขึ้น `attendance summary already sent today` แปลว่าวันนั้นระบบส่งสำเร็จไปแล้ว

### ยอดขายแจ้งว่ายังไม่เปิดรอบ

รายงานยอดขายนับจาก `cash_session.opened_at` ของรอบที่เปิดอยู่ ต้องเปิดลิ้นชักในโปรแกรมก่อน

### จำนวนเงินติดลบ

ให้นับเงินจริงและตรวจข้อมูลธนบัตรรับ เงินทอน รายการเบิก และรายการแลกเงิน ระบบจะไม่ปรับตัวเลขให้เองเพราะต้องแสดงความผิดปกติตามข้อมูลจริง
