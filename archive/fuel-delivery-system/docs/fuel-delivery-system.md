# 🚛⛽ ระบบจัดการน้ำมัน + รถส่งของ + หมุดจัดส่ง

> **ภาพรวม**: ร้านขายวัสดุก่อสร้างที่มีรถส่งของหลายคันและถังน้ำมันของร้านเอง
> ต้องการรู้ว่าน้ำมันจ่ายให้รถคันไหน รถใช้น้ำมันกับบิลใด และตรวจจับความผิดปกติ
> รวมถึงให้ลูกค้าปักหมุดจุดส่งของผ่าน QR code ที่จอลูกค้า

---

## 📑 สารบัญ

1. [วัตถุประสงค์ + Key Outcomes](#1-วัตถุประสงค์)
2. [Workflow ทั้งระบบ — 3 กรณีของลูกค้า](#2-workflow-ลูกค้า)
2.5. [ระบบพักบิล (Bill Hold)](#25-ระบบพักบิล-bill-hold--ระหว่างรอลูกค้ากรอกข้อมูล)
3. [Database Schema](#3-database-schema)
4. [โครงสร้างเมนู + ไฟล์](#4-โครงสร้างเมนู--ไฟล์)
5. [กลไกหลัก (Realtime, Distance, Anomaly)](#5-กลไกหลัก)
6. [UI Wireframes (text-based)](#6-ui-wireframes)
7. [Phase Plan + Acceptance Criteria](#7-phase-plan)
8. [SQL Migration ฉบับเต็ม (preview)](#8-sql-migration)
9. [RLS Policies (optional)](#9-rls-policies-ถ้าใช้-rls-ใน-supabase)

---

## 1) วัตถุประสงค์

### Business Outcomes
- ✅ รู้ว่า **รถแต่ละคันวันนี้เติมน้ำมันไปกี่ลิตร + วิ่งไปกี่ km** (สรุปต่อรถต่อวัน)
- ✅ มีหลักฐาน **ระยะทางจริงจาก map routing** (ไม่ใช่เส้นตรง — ใช้เส้นทางจริง)
- ✅ ลูกค้าปักหมุดเอง — ไม่ใช่พนักงานป้อน → หลักฐานน่าเชื่อถือ
- ✅ ผูกรถกับบิลตอน **กดส่งสำเร็จ** ไม่ใช่ตอนสร้างบิล (เพราะตอนสร้างบิลยังไม่รู้ว่ารถคันไหนว่าง)
- ✅ ตรวจจับ **ความผิดปกติ** เช่น เติมเยอะแต่ส่งใกล้, เติมแต่ไม่มีบิล
- ✅ ลูกค้าตัดสินใจเอง **สมัครสมาชิกหรือไม่** — ไม่บังคับ

### Non-Goals (ยังไม่ทำในเฟสนี้)
- ❌ ระบบขนส่งซับซ้อน (route optimization, multi-drop)
- ❌ Real-time GPS tracking ของรถ
- ❌ ค่าน้ำมันต่อพนักงาน/ค่าคอมเปอร์เซ็นต์ส่ง

---

## 2) Workflow ลูกค้า — 3 กรณี

### กรณี A — ลูกค้ามาหน้าร้าน (ไม่เคยเป็นสมาชิก)

```
1. พนักงานเปิด POS → checkout → step "ลูกค้า"
2. กดการ์ด "เพิ่มใหม่"
3. ระบบ:
   ├─ สร้าง delivery_pin_token (mode=new_customer)
   └─ ส่ง postMessage ไปจอลูกค้า → แสดง QR + ข้อความ
      "📍 สแกนเพื่อกรอกข้อมูล + ปักหมุดจัดส่ง"
4. ลูกค้าหยิบมือถือ → สแกน QR → เปิด /pin?token=xxx
5. ฟอร์มแสดง:
   ┌──────────────────────────────┐
   │ บิล #12345 — ฿2,450         │
   ├──────────────────────────────┤
   │ ชื่อ:          [_________]   │ ← บังคับ
   │ เบอร์โทร:      [_________]   │ ← บังคับ
   │ ที่อยู่สั้น:    [_________]   │ ← บังคับ (โชว์ในบิล)
   │ พิกัด:        [แผนที่ Leaflet]│ ← บังคับ ลาก/กด "ตำแหน่งฉัน"
   │                              │
   │ ☐ สมัครสมาชิกร้าน (เก็บข้อมูล)│
   │                              │
   │       [ ยืนยัน ]              │
   └──────────────────────────────┘
6. ลูกค้ากดยืนยัน → POST /pin/submit:
   ├─ ถ้าติ๊กสมัคร → INSERT customer + signup_consent=true
   ├─ ถ้าไม่ติ๊ก → ไม่สร้าง customer (เก็บใน delivery_assignment เท่านั้น)
   └─ token.used_at = now
7. POS รับ postMessage จากจอลูกค้า:
   ├─ ฟอร์ม "ลูกค้าใหม่" ถูกเติมอัตโนมัติ
   ├─ Toast: "✅ ลูกค้ากรอกข้อมูลแล้ว"
   └─ พนักงานกดต่อไปได้
```

### กรณี B — ลูกค้าประจำ (มีในระบบแล้ว) อัปเดตที่อยู่

```
1. พนักงานเลือกลูกค้าประจำใน checkout
2. UI แสดง info ลูกค้า + ปุ่ม [📝 เปลี่ยนที่อยู่/พิกัด]
3. กดปุ่ม → ระบบ:
   ├─ สร้าง token (mode=update_address, customer_id=xxx)
   └─ ส่ง QR ไปจอลูกค้า
4. ลูกค้าสแกน → ฟอร์มแสดงข้อมูลเดิม pre-fill:
   ┌──────────────────────────────┐
   │ ลูกค้า: นายA              │
   ├──────────────────────────────┤
   │ ชื่อ:        [นายA]         │ ← แก้ได้
   │ เบอร์โทร:    [0812345678]   │ ← แก้ได้
   │ ที่อยู่สั้น:  [123/4 สวนหลวง]│ ← แก้ได้
   │ พิกัดเดิม:  [📍 แสดงบนแผนที่]│
   │             ลากใหม่ ↓        │
   │           [แผนที่ ลากหมุด]   │ ← บังคับลาก
   │                              │
   │     [ บันทึก ]                │
   └──────────────────────────────┘
5. Submit → UPDATE customer + record audit log
6. POS เห็น notification → จบ
```

### 🔄 จุดที่รถถูกผูกกับบิล — ตอน "ส่งสำเร็จ" ไม่ใช่ตอนสร้างบิล

> **เหตุผล**: ตอนสร้างบิลขายที่หน้าร้าน ยังไม่รู้ว่ารถคันไหนจะเป็นคนส่ง (พขร. คนไหนว่าง, รถคันไหนใช้งานได้) บางครั้งส่งวันถัดไป
>
> ดังนั้น flow คือ:
> ```
> [POS save bill]          → delivery_assignment (vehicle_id = NULL, status = 'pending')
>                          → drop_lat/lng = NULL (จะมีตอนลูกค้าปักหมุด)
>          ↓
> [ลูกค้าปักหมุด]            → drop_lat/lng + distance ประมาณ (Haversine cache)
>          ↓
> [วันส่ง: พขร. หยิบงาน]    → ยังไม่บันทึก vehicle (แค่ดูใน list)
>          ↓
> [พขร. กด "ส่งสำเร็จ"]    → 📍 ขั้นตอนใหม่: เลือกรถที่ใช้ส่ง + ระบุเลขไมล์ (optional)
>                          → เรียก map routing → คำนวณ distance_km จริง (เส้นทางจริง)
>                          → บันทึก vehicle_id, distance_km, completed_at
>                          → trigger ผูก fuel_dispense ที่อยู่ในช่วงเวลานี้ของรถคันนั้น
> ```

### กรณี C — ลูกค้าโทรสั่ง

```
1. พนักงานสร้างบิลในระบบ
2. กดปุ่ม "📞 ขอหมุดจากลูกค้าโทร"
3. ระบบสร้าง token (mode=bill_pin) + ทางเลือก:
   ┌──────────────────────────────┐
   │ ส่ง QR ให้ลูกค้าทางไหน?       │
   ├──────────────────────────────┤
   │ [📱 สแกนเองด้วยมือถือ]        │ → เปิดกล้องในเครื่อง
   │ [💬 ส่งลิงก์ทาง Line/SMS]    │ → คัดลอกลิงก์ + เปิด Line web
   │ [💾 ดาวน์โหลด QR เป็นรูป]    │ → save PNG ส่งให้ลูกค้า
   └──────────────────────────────┘
4. ลูกค้าเปิดลิงก์/สแกน → ฟอร์มเหมือนกรณี A
5. ส่งข้อมูลกลับ → POS เห็นการอัปเดต
```

---

## 2.5) ระบบพักบิล (Bill Hold) — ระหว่างรอลูกค้ากรอกข้อมูล

> **ปัญหาที่แก้**: เมื่อพนักงานกด "เพิ่มลูกค้าใหม่" ที่มี QR pin, ลูกค้าอาจใช้เวลา 1-5 นาทีในการกรอกข้อมูล/ปักหมุด — พนักงานไม่ควรต้องนั่งรอเฉย ๆ ให้สามารถพักบิลแล้วไปทำธุรกรรมอื่นได้

### 2.5.1 Workflow

```
[POS — Checkout step "ลูกค้า"]
       ↓
[กด "เพิ่มลูกค้าใหม่" → สร้าง token + QR ขึ้นจอลูกค้า]
       ↓
[POS Modal แสดง 3 ทางเลือก]
   ┌────────────────────────────────────┐
   │ 🛒 รอลูกค้ากรอกข้อมูล...          │
   │                                     │
   │ [ 🔄 รอที่นี่ (refresh) ]           │ ← default: รอในจอ checkout
   │ [ ⏸️ พักบิลไว้ก่อน  ]              │ ← บันทึก draft + ปิด modal
   │ [ ❌ ยกเลิก          ]              │ ← ลบ token + ปิด
   └────────────────────────────────────┘
       ↓ (ถ้ากด "พักบิล")
[ระบบ:
   ├─ INSERT bill_draft (cart, checkout_state, token_id)
   ├─ ปิด checkout modal
   ├─ Clear current cart (พนักงานเริ่มขายคนถัดไปได้)
   └─ แสดง badge "⏳ บิลพัก: 1" ที่ topbar]
       ↓
[ลูกค้ากรอก form สำเร็จ → token.used_at = now]
       ↓
[Realtime/Polling แจ้งเตือน:
   ├─ Toast: "📦 บิลพัก #DRAFT-A123 — ลูกค้ากรอกแล้ว กดเพื่อต่อ"
   ├─ Badge "⏳ บิลพัก" เปลี่ยนเป็น "✅ พร้อมต่อ: 1"
   └─ เสียงเตือนสั้น ๆ (optional)]
       ↓
[พนักงานกด badge → popover แสดงรายการบิลพัก]
   ┌────────────────────────────────────────────────┐
   │ บิลพัก / รอลูกค้ากรอก                          │
   ├────────────────────────────────────────────────┤
   │ ✅ DRAFT-A123 — นาย A (กรอกแล้ว 30 วินาที)     │
   │    💰 ฿2,450 · 🛒 5 รายการ                    │
   │    [ต่อบิล] [ยกเลิก]                            │
   │                                                  │
   │ ⏳ DRAFT-B456 — รอลูกค้า (2 นาที)               │
   │    💰 ฿890 · 🛒 2 รายการ                       │
   │    [ดู QR ที่จอลูกค้าอีกครั้ง] [ยกเลิก]          │
   └────────────────────────────────────────────────┘
       ↓
[กด "ต่อบิล" → ระบบ:
   ├─ ลบ current cart (ถ้ามี) — confirm dialog
   ├─ Restore cart จาก draft
   ├─ Restore checkout_state จาก draft
   ├─ เปิด checkout modal อีกครั้ง — ที่ step ที่ลูกค้ากรอกเสร็จ
   ├─ ฟอร์มลูกค้าเติมข้อมูลครบ
   └─ พนักงานกด "ถัดไป" → จ่ายเงิน → save]
       ↓
[เมื่อ save จริง: bill_draft.completed_bill_id = new bill]
```

### 2.5.2 กฎสำคัญ

1. **Cart isolation** — พนักงานสามารถสลับไปขายคนอื่นต่อได้ระหว่างพัก (cart ใน UI ถูกเคลียร์, ไม่กระทบ stock)
2. **Stock check ตอน resume** — ก่อนกดยืนยัน restore cart ต้องตรวจ stock ปัจจุบัน ถ้าของหมดต้องเตือน
3. **อายุ draft = 24 ชม.** (สั้นกว่า pin token เพราะ cart มีโอกาสล้าสมัย)
4. **Max draft / staff = 5** — กันคนกดพักรัว ๆ จนเละ
5. **ผูก draft กับ staff_name** — แต่ละคนเห็น draft ของตัวเอง + admin เห็นทั้งหมด
6. **ขายแล้ว draft ถูกปิดอัตโนมัติ** — completed_bill_id ถูก set, ไม่แสดงในรายการพักอีก
7. **กรณีกด "ยกเลิก" บน draft** — ลบ token + ลบ draft (ไม่เกิดอะไรในตาราง บิลขาย)

### 2.5.3 Edge Cases

| สถานการณ์ | พฤติกรรม |
|---|---|
| Draft หมดอายุ (24 ชม.) ก่อนลูกค้ากรอก | Cron ลบทิ้ง + ลบ token |
| Stock ในของหายไประหว่างพัก | Resume → toast เตือน + ปรับ qty ลง |
| พนักงานเปิดเครื่องอื่น | Draft ใน DB → เห็นได้ทุกเครื่องที่ login ด้วยชื่อเดียวกัน |
| ลูกค้ากรอกข้อมูลพร้อมกัน 2 บิล (2 draft ของพนักงานคนเดียว) | OK — ทุก draft มี token แยก |
| ลูกค้ากดส่งฟอร์มซ้ำ | token.used_at เคย set แล้ว → reject |
| Staff ปิด browser ระหว่างพัก | Draft ยังอยู่ใน DB → กลับมาเปิดยังเห็น |

---

## 3) Database Schema

### 3.1 แก้ตารางที่มีอยู่

#### `customer` (เพิ่มคอลัมน์)
```sql
alter table customer add column if not exists lat numeric;
alter table customer add column if not exists lng numeric;
alter table customer add column if not exists pin_updated_at timestamptz;
alter table customer add column if not exists signup_consent boolean default true;
-- signup_consent: ถ้า false คือลูกค้าใช้ครั้งเดียวไม่อยากให้เก็บ (เผื่ออนาคต)
```

#### `shop_config` หรือ `setting` (เพิ่ม key)
```sql
-- pickup_lat, pickup_lng, distance_multiplier (default 1.3)
-- เก็บเป็น JSON ใน setting table หรือคอลัมน์ใหม่ใน shop_config
```

### 3.2 ตารางใหม่ — รถ + น้ำมัน

#### `vehicle`
```sql
create table vehicle (
  id bigserial primary key,
  plate_no text not null unique,
  name text,                    -- 'อีซูซุน้ำเงิน'
  fuel_type text not null,      -- 'ดีเซล' | 'เบนซิน'
  tank_capacity_l numeric(8,2), -- ความจุถังรถ
  avg_kmpl numeric(5,2),        -- km/L baseline (เช่น 8.5)
  driver_default text,          -- ชื่อ พขร. หลัก
  active boolean default true,
  created_at timestamptz default now()
);
```

#### `fuel_tank`
```sql
create table fuel_tank (
  id bigserial primary key,
  name text not null,            -- 'ถังดีเซลข้างร้าน'
  fuel_type text not null,
  capacity_l numeric(10,2),
  current_level_l numeric(10,2) default 0,
  last_audit_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);
```

#### `fuel_tank_refill` — เติมเข้าถังจาก supplier
```sql
create table fuel_tank_refill (
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
```

#### `fuel_dispense` — จ่ายน้ำมันออกจากถัง → รถ (พร้อมผูกบิล)
```sql
create table fuel_dispense (
  id bigserial primary key,
  tank_id bigint references fuel_tank(id),
  vehicle_id bigint references vehicle(id),
  qty_l numeric(10,2) not null,
  cost_per_l_snapshot numeric(8,2),  -- ราคา ณ วันจ่าย
  total_cost numeric(12,2),
  odometer_km numeric(10,1),         -- เลขไมล์ตอนเติม (optional)
  bill_ids jsonb default '[]',        -- บิลที่จะไปส่งครั้งนี้ ['bill-uuid-1', ...]
  photo_url text,                     -- รูปมิเตอร์/สลิป
  dispensed_at timestamptz default now(),
  staff_name text,
  note text
);
create index on fuel_dispense (vehicle_id, dispensed_at desc);
create index on fuel_dispense using gin(bill_ids);
```

#### `vehicle_external_refill` — เติมจากปั๊มข้างนอก (ไม่ลด tank ร้าน)
```sql
create table vehicle_external_refill (
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
```

### 3.3 ตารางใหม่ — Delivery + Pin

#### `delivery_assignment` — ผูกบิล ↔ จุดส่ง (รถผูกตอน "ส่งสำเร็จ")
```sql
create table delivery_assignment (
  id bigserial primary key,
  bill_id text references "บิลขาย"(id) unique,

  -- 🟡 vehicle/driver = NULL ตอนแรก, set ตอนกด "ส่งสำเร็จ"
  vehicle_id bigint references vehicle(id),
  driver_name text,
  vehicle_assigned_at timestamptz,        -- ตอนที่ vehicle_id ถูก set

  -- จุดส่ง — set ตอนลูกค้าปักหมุด
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  drop_lat numeric(10,7),
  drop_lng numeric(10,7),
  drop_address text,
  drop_pinned_by text check (drop_pinned_by in ('customer','staff','phone','imported')),
  drop_pinned_at timestamptz,

  -- ระยะทาง 2 ตัว: estimate ตอน pin + actual ตอน complete
  distance_km_estimate numeric(8,2),      -- Haversine × 1.3 (ตอน pin — เร็ว)
  distance_km numeric(8,2),                -- routing จริง (ตอน complete — แม่น)
  route_polyline text,                     -- encoded polyline จาก routing service
  route_source text,                       -- 'osrm' | 'ors' | 'mapbox' | 'google' | 'haversine_fallback'
  route_calculated_at timestamptz,

  -- เลขไมล์ตอนเริ่ม-จบ (optional แต่แม่นยำที่สุด)
  odometer_start_km numeric(10,1),
  odometer_end_km numeric(10,1),
  -- ถ้ามีค่าทั้งคู่ → distance_km = odometer_end - odometer_start (เชื่อยิ่งกว่า routing)

  -- น้ำมัน
  estimated_fuel_l numeric(8,3),           -- distance_km*2 / vehicle.avg_kmpl (ไป+กลับ)
  actual_fuel_l numeric(8,3),               -- รวมจาก fuel_dispense ที่ผูกบิลนี้

  status text default 'pending' check (status in ('pending','pinned','driving','done','cancel')),
  started_at timestamptz,
  completed_at timestamptz,
  completion_photo_url text,
  anomaly_flags jsonb default '[]',
  note text,
  created_at timestamptz default now()
);
create index on delivery_assignment (status, created_at desc);
create index on delivery_assignment (vehicle_id, completed_at desc);
```

**เหตุผลที่มี `distance_km_estimate` แยกจาก `distance_km`**:
- `distance_km_estimate` = Haversine × 1.3 — คำนวณทันทีตอนลูกค้าปักหมุด (รวดเร็ว, ไม่ต้องเรียก API)
- `distance_km` = ค่า routing จริง — เรียกตอน "ส่งสำเร็จ" (แม่นยำ, ใช้สำหรับ anomaly detection)
- ถ้ามี odometer ทั้ง start+end → ใช้ odometer (น่าเชื่อถือสุด)

#### `vehicle_trip` — รถออกไปหน้างาน (ไม่ใช่ส่งบิล)
```sql
create table vehicle_trip (
  id bigserial primary key,
  vehicle_id bigint references vehicle(id) not null,
  driver_name text,
  purpose text not null,                -- 'survey'|'pickup'|'errand'|'other'
  purpose_note text,                     -- ถ้าเลือก 'other' ใส่รายละเอียด
  destination_label text,                -- คำอธิบายปลายทาง
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
  status text default 'planned'
    check (status in ('planned','driving','done','cancel')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  photo_url text,
  note text,
  staff_name text,
  created_at timestamptz default now()
);
create index on vehicle_trip (vehicle_id, started_at desc);
```

#### `vehicle_odometer_log` — จดเลขไมล์รายสัปดาห์
```sql
create table vehicle_odometer_log (
  id bigserial primary key,
  vehicle_id bigint references vehicle(id) not null,
  odometer_km numeric(10,1) not null,
  recorded_at timestamptz default now(),
  recorded_by text,
  system_km_since_last numeric(8,2),     -- ระยะที่ระบบบันทึกตั้งแต่ครั้งก่อน
  actual_km_since_last numeric(8,2),     -- ระยะจริงจากเลขไมล์ใหม่ - ครั้งก่อน
  variance_pct numeric(5,2),              -- diff percentage
  flag_mismatch boolean default false,    -- true ถ้า variance > 15%
  note text
);
create index on vehicle_odometer_log (vehicle_id, recorded_at desc);
```

#### `delivery_pin_token` — ตั๋วสแกน QR ของลูกค้า
```sql
create table delivery_pin_token (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,        -- short random 8-12 chars
  mode text not null check (mode in ('new_customer','update_address','bill_pin')),
  bill_id text,                       -- nullable (กรณี new_customer ก่อนสร้างบิล)
  customer_id bigint,                 -- preset ถ้าเป็น update_address
  expires_at timestamptz not null,    -- 48 ชม.
  used_at timestamptz,
  used_payload jsonb,                 -- {name, phone, address, lat, lng, signup}
  created_by text,
  created_at timestamptz default now()
);
create index on delivery_pin_token (token);
create index on delivery_pin_token (used_at) where used_at is null;
```

#### `bill_draft` — บิลที่พักไว้ระหว่างรอลูกค้ากรอก
```sql
create table bill_draft (
  id text primary key,                -- 'DRAFT-' + short random
  token_id uuid references delivery_pin_token(id) on delete set null,
  staff_name text not null,           -- ผู้พักบิล
  cart_snapshot jsonb not null,       -- รายการสินค้า [{id, name, qty, price, ...}]
  checkout_state jsonb not null,      -- {step, method, customer, delivery, ...}
  subtotal numeric(12,2),
  total numeric(12,2),
  item_count integer,
  pin_mode text,                       -- copy จาก token.mode เพื่อ filter เร็ว
  status text default 'waiting'        -- 'waiting' | 'ready' | 'resumed' | 'expired' | 'cancelled'
    check (status in ('waiting','ready','resumed','expired','cancelled')),
  completed_bill_id text,              -- FK บิลขาย ตอน save จริง
  expires_at timestamptz not null,     -- created + 24h
  created_at timestamptz default now(),
  resumed_at timestamptz,
  cancelled_at timestamptz
);
create index on bill_draft (staff_name, status);
create index on bill_draft (status, expires_at);
```

**Trigger / Hook ที่ต้องมี**:
- เมื่อ `delivery_pin_token.used_at` ถูก set → trigger update `bill_draft.status = 'ready'` (ถ้ามี token_id ผูก)
- Cron ลบ draft ที่ expires_at < now AND status='waiting' (เปลี่ยนเป็น 'expired')

---

## 4) โครงสร้างเมนู + ไฟล์

### เมนูใหม่ใน sidebar
```
🚛 น้ำมัน / รถ                          ← parent group
├── 🚙 ทะเบียนรถ                          (vehicle CRUD + ใช้รถไปหน้างาน + จดไมล์)
├── 🛢️ ถังน้ำมัน + เติมเข้า                (tank + refill)
├── ⛽ จ่ายน้ำมันออก                      (dispense)
├── 📦 งานส่งของวันนี้                    (delivery_assignment + complete modal)
├── 📋 ทริปไปหน้างาน                      (vehicle_trip list/manage)
└── 📊 รายงาน + ความผิดปกติ              (reports + anomalies + odometer compare)
```

### ไฟล์ใหม่ที่จะสร้าง
```
modules-v83-fuel-delivery-foundation.js  ← schema check + Settings + helpers
modules-v84-fuel-vehicle-tank.js          ← UI ทะเบียนรถ + ถัง + ใช้รถไปหน้างาน + จดเลขไมล์
modules-v85-fuel-dispense.js              ← UI จ่ายน้ำมัน
modules-v86-delivery-pin.js               ← QR pin flow ฝั่ง POS + customer-display
modules-v87-bill-draft-hold.js            ← ระบบพักบิล (Bill Hold) + badge
modules-v88-delivery-assignment.js        ← งานส่งวันนี้ + Modal "ส่งสำเร็จ" + routing
modules-v89-fuel-reports-anomaly.js       ← รายงาน + anomaly detection

pin.html                                  ← หน้าลูกค้าสแกน (standalone)
migrations/fuel_delivery_schema.sql       ← SQL migration ทั้งหมด
migrations/fuel_delivery_rpcs.sql         ← Postgres functions (atomic tank + draft)
docs/fuel-delivery-system.md              ← (ไฟล์นี้)
```

### Settings ใหม่
หน้า Admin → เพิ่ม section "🚛 น้ำมัน/รถ":
- 📍 **ที่ตั้งร้าน** (lat/lng) — ลากหมุดบน Leaflet, save → `shop_config`
- 🛣️ **Distance estimate multiplier** (default 1.3) — สำหรับค่าประมาณตอน pin เท่านั้น (ค่าจริงมาจาก routing)
- 🗺️ **Map tile provider** (default OpenStreetMap)
- 🚗 **Routing service** (สำหรับคำนวณระยะจริงตอนกดส่งสำเร็จ):
  - `osrm_demo` — OSRM demo server (default, ฟรี, ไม่ต้อง key)
  - `ors` — OpenRouteService (ฟรี 2k/วัน, ต้องใส่ API key)
  - `mapbox` — Mapbox Directions (50k/เดือนฟรี, ต้องใส่ access token)
  - `google` — Google Directions (ต้องเปิด billing + API key)
  - `none` — fallback Haversine × multiplier เท่านั้น
- 🔑 **Routing API key** (จำเป็นถ้าเลือก ors/mapbox/google)
- ⚠️ **Threshold anomaly**:
  - fuel_excess_ratio (default 1.5)
  - pin_too_close_meters (default 500)
  - kmpl_drop_warning_ratio (default 0.6 — เตือนถ้า km/L < 60% ของ baseline)

---

## 5) กลไกหลัก

### 5.0 ทำความเข้าใจก่อน — Routing คืออะไร?

> **เปรียบเทียบง่าย ๆ**: สมมุติร้านอยู่ที่ A, ลูกค้าอยู่ที่ B
>
> | วิธี | ทำงานยังไง | ระยะที่ได้ |
> |---|---|---|
> | **Haversine (เส้นตรง)** | คำนวณ "เส้นตรง" จาก A → B (เหมือนนกบิน) | 3 km |
> | **Routing (เส้นทางจริง)** | ขอ server ช่วยวาด "เส้นทางจริงตามถนน" | 4.5 km |
>
> ในความเป็นจริงรถวิ่งบนถนน ไม่ได้บินเส้นตรง → routing จะแม่นกว่า ~30-50%
>
> **ทำไมต้องใช้ server**: ข้อมูลถนนทั้งประเทศหนักหลายร้อย MB ใส่ในเว็บไม่ไหว → ต้องเรียก online service
>
> **Service ที่ใช้ได้**:
> - **OSRM demo** — เว็บฟรีของ OpenStreetMap, ใช้ได้ทันที ไม่ต้องสมัคร แต่บางช่วงอาจช้า
> - **OpenRouteService** — สมัครฟรีได้ 2,000 ครั้ง/วัน (พอสำหรับร้านนี้)
> - **Google/Mapbox** — แม่นสุด แต่เสียเงิน
>
> **ทางเลือก "ไม่ใช้ routing"**: ใช้ Haversine × 1.3 อย่างเดียว ก็พอใช้ได้ ความแม่นยำราว 80-90% (พอตรวจจับโกงน้ำมันแล้ว)
>
> **คำแนะนำ**: เริ่ม **OSRM demo** ก่อน (ทำงานทันที ไม่ต้อง setup อะไร) — ภายหลังถ้ามีปัญหาเปลี่ยนได้ใน Settings

---

### 5.1 Distance Calculation — 2 ระดับ + ลำดับความน่าเชื่อถือ

**ลำดับความน่าเชื่อถือ (มากไปน้อย)**:
1. 🥇 **Odometer (เลขไมล์รถ)** — ถ้ามี start + end → `distance_km = end - start` (แม่นที่สุด, ใช้ข้อมูลรถจริง)
2. 🥈 **Map Routing API** — เรียก OSRM/ORS ตอน "ส่งสำเร็จ" → เส้นทางจริงตามถนน
3. 🥉 **Haversine × 1.3** — ค่าประมาณตอนลูกค้าปักหมุด (instant, ไม่ต้องเรียก API)

#### Haversine (สำหรับ estimate ทันที ตอน pin)
```js
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// บันทึกใน distance_km_estimate ตอน pin
```

#### Map Routing (สำหรับค่าจริง ตอน "ส่งสำเร็จ")

**ทางเลือก routing service** — แนะนำตามลำดับ:

| Service | ค่าใช้จ่าย | API key | คุณภาพ | หมายเหตุ |
|---|---|---|---|---|
| **OpenRouteService** ⭐ | ฟรี 2,000 req/วัน | ต้อง (ฟรี) | ดี | สมัครฟรีที่ openrouteservice.org |
| **OSRM demo** | ฟรี ไม่จำกัด | ไม่ต้อง | ดี | demo server — ไม่มี SLA, อาจช้าบางช่วง |
| **OSRM self-host** | ฟรี | ไม่ต้อง | ดี | ติดตั้งเอง — ดีที่สุดถ้ามีคนดูแล |
| Mapbox Directions | 50k/เดือน ฟรี | ต้อง | ดี | + traffic data |
| Google Directions | ต้อง billing | ต้อง | ดีสุด | + real-time traffic |

**แนะนำสำหรับร้านนี้**: เริ่มที่ **OSRM demo** (ไม่ต้อง key) → ถ้ามีปัญหา fallback Haversine → ภายหลังย้ายไป ORS

```js
// Pseudo: routing call ตอน "ส่งสำเร็จ"
async function fetchRouteDistance(pickup, drop) {
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}?overview=false`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (j?.routes?.[0]) {
      return {
        distance_km: j.routes[0].distance / 1000,
        duration_min: j.routes[0].duration / 60,
        source: 'osrm'
      };
    }
  } catch (_) {}
  // Fallback: Haversine × 1.3
  const km = haversineKm(pickup.lat, pickup.lng, drop.lat, drop.lng) * 1.3;
  return { distance_km: km, source: 'haversine_fallback' };
}
```

#### ลำดับการเลือกค่าสุดท้าย (priority)
```js
function pickFinalDistance(da) {
  if (da.odometer_start_km != null && da.odometer_end_km != null) {
    return { km: da.odometer_end_km - da.odometer_start_km, source: 'odometer' };
  }
  if (da.distance_km != null && da.route_source !== 'haversine_fallback') {
    return { km: da.distance_km, source: da.route_source };
  }
  return { km: da.distance_km_estimate, source: 'haversine' };
}
```

### 5.2 Atomic Tank Operations (Postgres RPC)
```sql
create function sk_fuel_dispense(
  p_tank_id bigint, p_vehicle_id bigint, p_qty_l numeric,
  p_bill_ids jsonb, p_staff text, p_note text
) returns bigint as $$
declare new_id bigint;
begin
  -- lock tank row
  perform 1 from fuel_tank where id = p_tank_id for update;

  -- guard: ห้ามต่ำกว่า 0
  if (select current_level_l from fuel_tank where id = p_tank_id) < p_qty_l then
    raise exception 'fuel_tank_insufficient';
  end if;

  -- หัก tank
  update fuel_tank set current_level_l = current_level_l - p_qty_l
    where id = p_tank_id;

  -- insert dispense
  insert into fuel_dispense (tank_id, vehicle_id, qty_l, bill_ids, staff_name, note)
    values (p_tank_id, p_vehicle_id, p_qty_l, p_bill_ids, p_staff, p_note)
    returning id into new_id;

  return new_id;
end; $$ language plpgsql security invoker;
```

### 5.3 Realtime / postMessage between POS ↔ Customer Display

**ใช้ postMessage ระหว่างหน้าต่าง — ไม่ผ่าน server**
```js
// POS (parent window)
customerDisplayWindow.postMessage({
  type: 'pin_qr',
  token: 'abc123',
  url: 'https://shop.example.com/pin?token=abc123',
  mode: 'new_customer',
  bill: { no: '12345', total: 2450 }
}, '*');

// Customer-display.html (child window)
window.addEventListener('message', e => {
  if (e.data?.type === 'pin_qr') renderQrPinScreen(e.data);
});
```

**Token submission → POS รับด้วย Supabase realtime subscription บน `delivery_pin_token`**
- เร็วกว่า polling
- ทำงานข้ามอุปกรณ์ (กรณีลูกค้าสแกนด้วยมือถือตัวเอง)

### 5.4 Anomaly Detection Rules

ทำงานหลังจาก `delivery_assignment.completed_at` ถูก set + cron ทุก 1 ชม.:

| Rule | Condition | Severity |
|---|---|---|
| `fuel_no_bill` | dispense.bill_ids=[] AND dispense.dispensed_at > today 06:00 AND ไม่มี vehicle_trip ผูก | 🔴 |
| `fuel_excess` | actual_fuel_l > estimated_fuel_l × shop_config.fuel_excess_ratio | 🟡 |
| `bill_no_fuel` | assignment.status='done' AND no dispense linked AND vehicle ไม่มี external refill วันนี้ | 🟠 |
| `pin_too_close` | distance_km × 1000 < pin_too_close_meters | 🟡 |
| `pin_far_from_address` | customer.address mismatch (เก็บเตือนเฉย ๆ) | 🟡 |
| `cluster_kmpl_bad` | week aggregate: real_kmpl < vehicle.avg_kmpl × 0.6 | 🔴 |
| `odometer_mismatch` | weekly odometer log: variance_pct > 15 (ระยะจดจริง vs ระยะระบบบันทึก) | 🔴 |
| `unauthorized_trip` | vehicle_trip ไม่ได้ผูก fuel_dispense + ระยะ > 5 km | 🟡 |

Flag เก็บใน `delivery_assignment.anomaly_flags` (array of strings)

---

## 6) UI Wireframes

### 6.1 หน้าลูกค้าสแกน — `pin.html`
```
┌─────────────────────────────────┐
│ 🏪 ร้าน เอส เค วัสดุ            │
│ บิล #12345 — ฿2,450 บาท         │
├─────────────────────────────────┤
│ ───────── ข้อมูลผู้รับ ─────────│
│ ชื่อ:         [_______________] │
│ เบอร์โทร:    [_______________] │
│ ที่อยู่สั้น:  [_______________] │
│              (เช่น 123/4 สวนหลวง)│
│                                  │
│ ────────── ปักหมุดบน Map ───────│
│ ┌───────────────────────────┐  │
│ │                           │  │
│ │      [แผนที่ Leaflet]      │  │
│ │       (มีหมุดให้ลาก)        │  │
│ │                           │  │
│ └───────────────────────────┘  │
│ [ 📍 ใช้ตำแหน่งปัจจุบัน ]      │
│                                  │
│ ระยะทางจากร้าน: 4.2 กม. 🚗      │
│                                  │
│ ☐ สมัครสมาชิกร้าน (ใช้ครั้งหน้า) │
│                                  │
│ ╔═════════════════════════════╗ │
│ ║      [   ยืนยัน  ]           ║ │
│ ╚═════════════════════════════╝ │
└─────────────────────────────────┘
```

### 6.2 จอลูกค้า — แสดง QR
```
┌─────────────────────────────────┐
│ 🛒 ขณะนี้กำลังทำรายการ           │
│                                  │
│ บิล #12345 — ฿2,450             │
│                                  │
│ ┌──────────────────────────┐    │
│ │                          │    │
│ │      ████████████        │    │
│ │      █  QR CODE  █        │    │
│ │      ████████████        │    │
│ │                          │    │
│ └──────────────────────────┘    │
│                                  │
│ 📱 สแกน QR เพื่อกรอกข้อมูล        │
│    และปักหมุดจุดจัดส่ง            │
│                                  │
│ ⏱️ QR หมดอายุใน 48 ชั่วโมง       │
└─────────────────────────────────┘
```

### 6.3 หน้า "งานส่งของวันนี้" (พนักงาน)
```
┌─────────────────────────────────────────────────────────┐
│ 📦 งานส่งของวันนี้ (5 บิล)              [วันที่: 2026-05-18] │
├─────────────────────────────────────────────────────────┤
│ บิล#  │ ลูกค้า    │ ระยะ(est) │ สถานะ              │ ทำ │
│ 12345 │ นาย A    │ ~4.2 km   │ ⏳ รอจัดส่ง        │[✅ส่งสำเร็จ]│
│ 12346 │ นาง B    │ ~8.7 km   │ ⏳ รอจัดส่ง        │[✅ส่งสำเร็จ]│
│ 12347 │ นาย C    │ ~2.1 km   │ ⏳ ลูกค้ายังไม่ปักหมุด│[📞 ติดตาม]│
│ 12348 │ นาง D    │ 12.3 km✓  │ ✅ ส่งแล้ว (รถฮีโน่)│[ดูรายละเอียด]│
│                                                          │
│ Map View ↓                                              │
│ ┌────────────────────────────────────────┐             │
│ │  📍 ร้าน                                │             │
│ │  📌#12345 (รอ)                          │             │
│ │  📌#12346 (รอ)                          │             │
│ │  ✅#12348 (ส่งแล้ว — รถฮีโน่ 12.3km)    │             │
│ └────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 6.4 Modal "กดส่งสำเร็จ" (ขั้นตอนใหม่ — ผูกรถ + คำนวณระยะจริง)

> นี่คือจุดที่บันทึก vehicle_id จริง + เรียก routing API

```
┌──────────────────────────────────────────────┐
│ ✅ ส่งสำเร็จ — บิล #12345 นาย A                │
├──────────────────────────────────────────────┤
│ 📍 จาก: ร้าน → ถึง: สวนหลวง 123/4              │
│ ระยะประมาณ: 4.2 km (เส้นตรง × 1.3)             │
│                                               │
│ ── เลือกรถที่ใช้ส่ง ──                          │
│ ┌──────────────────────────────────────────┐ │
│ │ ○ อีซูซุน้ำเงิน  (ทะเบียน 1กข-2345)        │ │
│ │ ⊙ ฮีโน่แดง       (ทะเบียน 2คง-6789)  ⭐    │ │
│ │ ○ โตโยต้าขาว    (ทะเบียน 3จฉ-1011)        │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ พขร.:           [สมชาย ▼]                    │
│                                               │
│ ── หลักฐาน ──                                  │
│ 📸 รูปถ่ายตอนส่ง: [📁 เลือกไฟล์]              │
│                                               │
│ หมายเหตุ:       [____________________]        │
│                                               │
│ ⏳ ระบบจะคำนวณระยะทางจริงจากแผนที่             │
│                                               │
│         [ ยืนยันส่งสำเร็จ ]                   │
└──────────────────────────────────────────────┘
```

**เมื่อกดยืนยัน**:
1. POST routing API (OSRM) → ได้ `distance_km` จริง
2. UPDATE delivery_assignment:
   - `vehicle_id`, `driver_name`, `vehicle_assigned_at`
   - `distance_km`, `route_polyline`, `route_source`
   - `completed_at`, `completion_photo_url`
   - `status = 'done'`
3. Trigger auto-link `fuel_dispense` ของ vehicle นี้ในช่วงเวลา 6:00 ของวันนั้น → completed_at + 1h ที่ยังไม่ผูกบิล

> **หมายเหตุ**: ไม่ต้องกรอกเลขไมล์ตอนนี้ — เลขไมล์จดอาทิตย์ละครั้งแยกต่างหาก (ดู §6.8) เพื่อ cross-check ระยะทางสะสม

### 6.4 หน้า "จ่ายน้ำมัน"
```
┌──────────────────────────────────────────────┐
│ ⛽ บันทึกจ่ายน้ำมัน                            │
├──────────────────────────────────────────────┤
│ ถัง:     [ถังดีเซลข้างร้าน ▼] คงเหลือ 1,247 L │
│ รถ:      [อีซูซุน้ำเงิน ▼] avg 8.5 km/L      │
│ ปริมาณ:  [_____] ลิตร                         │
│ เลขไมล์: [_____] กม. (ไม่บังคับ)              │
│                                               │
│ ผูกกับบิลที่จะส่ง:                            │
│ ☑ บิล#12345 — นาย A — 4.2km                  │
│ ☑ บิล#12346 — นาง B — 8.7km                  │
│ ☐ บิล#12347 — นาย C — 2.1km                  │
│                                               │
│ คาดใช้น้ำมัน: 3.05 ลิตร (Σ ×2 ÷ 8.5)          │
│ ค่าน้ำมันคำนวณ: ฿88 (3.05 × 28.8)             │
│                                               │
│ 📸 แนบรูปมิเตอร์: [เลือกไฟล์]                │
│                                               │
│         [ บันทึกการจ่าย ]                     │
└──────────────────────────────────────────────┘
```

### 6.5 Topbar Badge "บิลพัก" + Popover

```
┌─────────────────────────────────────────────────────────┐
│ 🏪 SK POS     [POS] [คลัง] [...]    ⏳ บิลพัก: 2 ✅ 🔔   │ ← topbar
└─────────────────────────────────────────────────────────┘
                                              ↓ คลิก
┌──────────────────────────────────────┐
│ 📋 บิลที่พักไว้ — รอลูกค้ากรอก       │
├──────────────────────────────────────┤
│ ✅ DRAFT-A123    (พร้อมต่อ!)         │
│    นาย A (ใหม่)                       │
│    💰 ฿2,450 · 🛒 5 รายการ           │
│    ⏱️ พักไว้ 1 นาที                   │
│    [ ต่อบิล ▶ ]  [ ❌ ยกเลิก ]        │
│ ─────────────────────────────────── │
│ ⏳ DRAFT-B456    (รอลูกค้า)          │
│    เปลี่ยนที่อยู่: นาง B               │
│    💰 ฿890 · 🛒 2 รายการ             │
│    ⏱️ พักไว้ 3 นาที                   │
│    [ 🔄 ดู QR ที่จอลูกค้า ]            │
│    [ ❌ ยกเลิก ]                       │
│ ─────────────────────────────────── │
│ ⏰ หมดอายุ 24 ชม. นับจากเวลาพัก      │
└──────────────────────────────────────┘
```

**Badge states**:
- 🟢 `✅ พร้อมต่อ: N` — ลูกค้ากรอกครบแล้ว มี draft ที่ status='ready' (มี notification เด้ง)
- 🟡 `⏳ บิลพัก: N` — ยังมีรอกรอก
- ⚪️ (ซ่อน) — ไม่มี draft

### 6.6 รายงานต่อรถ ต่อวัน (สรุปหลัก)

```
┌──────────────────────────────────────────────────────────┐
│ 📊 สรุปการใช้รถ — วันที่ 2026-05-18                       │
├──────────────────────────────────────────────────────────┤
│ รถ           │ ส่ง │ km รวม │ น้ำมัน │ km/L │ ค่าน้ำมัน  │
│ อีซูซุน้ำเงิน │ 3   │ 28.4   │ 4.5L  │ 6.3  │ ฿130       │
│ ฮีโน่แดง     │ 5   │ 67.1   │ 9.2L  │ 7.3  │ ฿265       │
│ โตโยต้าขาว   │ 2   │ 14.8   │ 2.1L  │ 7.0  │ ฿60        │
│ ── รวม ────────────────────────────────────────────────  │
│ ทั้งหมด      │ 10  │ 110.3  │ 15.8L │ 7.0  │ ฿455       │
│                                                           │
│ ── ถังร้าน ───────────────────────────────────────────── │
│ เริ่มต้นวัน: 1,500 L · จ่ายออก: 15.8 L · คงเหลือ: 1,484 L │
│                                                           │
│ ── เปรียบเทียบ baseline (avg_kmpl) ─────────────────────  │
│ อีซูซุน้ำเงิน: avg 8.5 → จริง 6.3 ⚠️ (-26% ต่ำกว่า base)    │
└──────────────────────────────────────────────────────────┘
```

> รายงานนี้คำนวณจาก:
> - `Σ distance_km` ของ delivery_assignment ที่ vehicle_id ตรง + completed วันนี้
> - `Σ qty_l` ของ fuel_dispense ที่ vehicle_id ตรง + dispensed_at วันนี้
> - km/L = total_km / total_fuel_l

### 6.7 หน้า "ทะเบียนรถ" — มีปุ่ม "ใช้รถไปหน้างาน" + "จดเลขไมล์"

```
┌─────────────────────────────────────────────────────────┐
│ 🚙 ทะเบียนรถ                                              │
├─────────────────────────────────────────────────────────┤
│ รถ             │ ทะเบียน    │ avg km/L │ Action            │
│ อีซูซุน้ำเงิน  │ 1กข-2345  │ 8.5      │ [✏️][📋ใช้รถ][📏ไมล์]│
│ ฮีโน่แดง       │ 2คง-6789  │ 7.8      │ [✏️][📋ใช้รถ][📏ไมล์]│
│                                                          │
│ [+ เพิ่มรถใหม่]                                          │
└─────────────────────────────────────────────────────────┘
```

#### Modal "📋 ใช้รถไปหน้างาน" (non-delivery trip)

> ใช้กรณีรถออกจากร้านโดยไม่ใช่ส่งบิล เช่น **ไปดูหน้างาน**, ไปรับสินค้าจาก supplier, ธุระ ฯลฯ

```
┌──────────────────────────────────────────────┐
│ 📋 ใช้รถ — ฮีโน่แดง (2คง-6789)                 │
├──────────────────────────────────────────────┤
│ พขร.:          [สมชาย ▼]                     │
│ จุดประสงค์:    ⊙ ไปดูหน้างาน                  │
│                ○ ไปรับสินค้า                  │
│                ○ ธุระทั่วไป                    │
│                ○ อื่น ๆ: [_____________]      │
│                                               │
│ ── ปักหมุดจุดที่จะไป ──                       │
│ ┌──────────────────────────────────┐         │
│ │                                    │         │
│ │       [แผนที่ Leaflet]              │         │
│ │       (ลากหมุดเลือกจุดหมาย)         │         │
│ │                                    │         │
│ └──────────────────────────────────┘         │
│ [📍 ใช้ตำแหน่งปัจจุบัน]                       │
│                                               │
│ ระยะประมาณ: ~7.5 km                            │
│                                               │
│ หมายเหตุ: [_______________________]            │
│                                               │
│         [ ▶️ เริ่มใช้รถ ]                       │
└──────────────────────────────────────────────┘
```

หลังจากกลับมาที่ร้าน → กดปุ่ม "🏁 จบงาน" → คำนวณ routing + ผูกน้ำมันที่เติม

#### Modal "📏 จดเลขไมล์" (รายสัปดาห์)

```
┌──────────────────────────────────────────────┐
│ 📏 จดเลขไมล์ — ฮีโน่แดง                        │
├──────────────────────────────────────────────┤
│ ครั้งสุดท้ายที่จด: 2026-05-11                  │
│ เลขไมล์ครั้งก่อน:  85,420 km                  │
│ ระยะที่ระบบบันทึก: 312.5 km (7 วัน)            │
│                                               │
│ เลขไมล์ปัจจุบัน:  [_______] km                │
│                                               │
│ ⚠️ ระบบจะเตือนถ้า diff (จริง vs ระบบ) > 15%     │
│                                               │
│ หมายเหตุ: [_______________________]            │
│                                               │
│         [ บันทึก ]                              │
└──────────────────────────────────────────────┘
```

หลังจากบันทึก:
- ระบบเปรียบเทียบ: เลขไมล์ที่จดจริง - เลขครั้งก่อน = "ระยะจริง"
- เทียบกับ "ระยะที่ระบบบันทึก" (Σ distance_km จาก delivery + vehicle_trip ของช่วงเดียวกัน)
- ถ้า diff > 15% → flag "odometer_mismatch" (อาจมีการใช้รถนอกระบบ)

### 6.8 หน้า "ความผิดปกติ"
```
┌──────────────────────────────────────────────┐
│ ⚠️ รายการต้องตรวจสอบ (3)                       │
├──────────────────────────────────────────────┤
│ 🔴 fuel_no_bill (วันนี้ 10:23)               │
│    อีซูซุน้ำเงิน เติม 35L แต่ไม่ผูกบิล         │
│    [ตรวจสอบ]                                  │
│                                               │
│ 🟡 fuel_excess (บิล#12349)                   │
│    ใช้จริง 8L vs คาด 5L (ratio 1.6)           │
│    [ตรวจสอบ]                                  │
│                                               │
│ 🟠 bill_no_fuel (บิล#12350)                  │
│    ส่งสำเร็จ แต่ไม่มีการเติมน้ำมัน             │
│    [ตรวจสอบ]                                  │
└──────────────────────────────────────────────┘
```

---

## 7) Phase Plan

| Phase | งาน | Deliverables | Acceptance Criteria |
|---|---|---|---|
| **1** | Foundation | SQL migration + Settings page (pickup lat/lng + thresholds) | กดดูใน Supabase ตารางครบ + admin ใส่พิกัดร้านได้ |
| **2** | Vehicle + Tank | หน้า CRUD ทะเบียนรถ + ถังน้ำมัน + เติมเข้าถัง | เพิ่ม/แก้/ลบรถได้ • ถังเติมเข้าได้ • level อัปเดต |
| **3** | Fuel Dispense | หน้าจ่ายน้ำมัน + external refill + atomic RPC | จ่ายน้ำมันแล้ว tank ลดถูกต้อง • ผูกบิลได้ |
| **4** | Pin (Case A) | pin.html + customer-display QR + flow ลูกค้าใหม่ | ลูกค้าสแกน → กรอก → submit → POS ได้ข้อมูล |
| **5** | Pin (Case B+C) | flow เปลี่ยนที่อยู่ + flow โทรสั่ง | ใช้กับลูกค้าประจำได้ • พนักงานสแกนเอง/ส่ง Line ได้ |
| **5.5** | **Bill Hold (พักบิล)** | ปุ่มพักบิล + Topbar badge + Popover + Resume flow + Realtime notify | พักได้ • สลับขายคนถัดไปได้ • ลูกค้ากรอกเสร็จเด้งแจ้ง • Resume ครบ state |
| **6** | Delivery + Vehicle Assignment | หน้า "งานวันนี้" + Map view + **Modal "ส่งสำเร็จ" ผูกรถ + เรียก routing** | เห็นงานวันนี้ • กดส่งสำเร็จเลือกรถได้ • routing คำนวณระยะจริง • map แสดงหมุด |
| **6.5** | Vehicle Trip + Odometer Log | ปุ่ม "ใช้รถไปหน้างาน" + Modal "จดเลขไมล์" รายสัปดาห์ + auto-flag mismatch | เริ่ม/จบงานไปหน้างานได้ • จดเลขไมล์เปรียบเทียบกับระบบ • เตือนเมื่อ variance > 15% |
| **7** | Anomaly + Reports | rule engine + รายงาน + alerts | flag ขึ้นถูกต้อง • รายงานสรุปต่อรถ/ต่อวัน |

**ระยะเวลาประมาณการ**: 7-9 รอบ work session

---

## 8) SQL Migration (Preview)

ไฟล์เต็มจะอยู่ที่ `migrations/fuel_delivery_schema.sql` (สร้างใน Phase 1)

```sql
-- ════════════════════════════════════════════════════════════════
-- SK POS — Fuel + Delivery + Pin System Migration
-- ════════════════════════════════════════════════════════════════

-- ── extend customer ────────────────────────────────────────────
alter table customer add column if not exists lat numeric(10,7);
alter table customer add column if not exists lng numeric(10,7);
alter table customer add column if not exists pin_updated_at timestamptz;
alter table customer add column if not exists signup_consent boolean default true;

-- ── shop config ────────────────────────────────────────────────
-- (assume shop_config table exists; if not, store in setting key)
alter table shop_config add column if not exists pickup_lat numeric(10,7);
alter table shop_config add column if not exists pickup_lng numeric(10,7);
alter table shop_config add column if not exists distance_multiplier numeric(3,2) default 1.3;
alter table shop_config add column if not exists routing_service text default 'osrm_demo';
alter table shop_config add column if not exists routing_api_key text;
alter table shop_config add column if not exists fuel_excess_ratio numeric(3,2) default 1.5;
alter table shop_config add column if not exists pin_too_close_meters integer default 500;
alter table shop_config add column if not exists kmpl_drop_warning_ratio numeric(3,2) default 0.6;

-- ── vehicle ────────────────────────────────────────────────────
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

-- ── fuel_tank ──────────────────────────────────────────────────
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

-- ── fuel_tank_refill ───────────────────────────────────────────
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

-- ── fuel_dispense ──────────────────────────────────────────────
create table if not exists fuel_dispense (
  id bigserial primary key,
  tank_id bigint references fuel_tank(id),
  vehicle_id bigint references vehicle(id),
  qty_l numeric(10,2) not null,
  cost_per_l_snapshot numeric(8,2),
  total_cost numeric(12,2),
  odometer_km numeric(10,1),
  bill_ids jsonb default '[]',
  photo_url text,
  dispensed_at timestamptz default now(),
  staff_name text,
  note text
);
create index if not exists fuel_dispense_vehicle_idx on fuel_dispense (vehicle_id, dispensed_at desc);
create index if not exists fuel_dispense_billids_idx on fuel_dispense using gin(bill_ids);

-- ── vehicle_external_refill ────────────────────────────────────
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

-- ── delivery_assignment ────────────────────────────────────────
-- vehicle_id / distance_km / route จะถูก set ตอนกด "ส่งสำเร็จ"
create table if not exists delivery_assignment (
  id bigserial primary key,
  bill_id text unique,
  vehicle_id bigint references vehicle(id),       -- NULL จนกว่าจะกดส่งสำเร็จ
  driver_name text,
  vehicle_assigned_at timestamptz,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  drop_lat numeric(10,7),
  drop_lng numeric(10,7),
  drop_address text,
  drop_pinned_by text,
  drop_pinned_at timestamptz,
  distance_km_estimate numeric(8,2),               -- Haversine × 1.3 (ตอน pin)
  distance_km numeric(8,2),                         -- routing จริง (ตอน complete)
  route_polyline text,
  route_source text,
  route_calculated_at timestamptz,
  odometer_start_km numeric(10,1),
  odometer_end_km numeric(10,1),
  estimated_fuel_l numeric(8,3),
  actual_fuel_l numeric(8,3),
  status text default 'pending',                    -- pending|pinned|driving|done|cancel
  started_at timestamptz,
  completed_at timestamptz,
  completion_photo_url text,
  anomaly_flags jsonb default '[]',
  note text,
  created_at timestamptz default now()
);
create index if not exists delivery_status_idx on delivery_assignment (status, created_at desc);
create index if not exists delivery_vehicle_date_idx on delivery_assignment (vehicle_id, completed_at desc);

-- ── delivery_pin_token ─────────────────────────────────────────
create table if not exists delivery_pin_token (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  mode text not null,
  bill_id text,
  customer_id bigint,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_payload jsonb,
  created_by text,
  created_at timestamptz default now()
);
create index if not exists pin_token_lookup_idx on delivery_pin_token (token);

-- ── vehicle_trip (ไปหน้างาน) ───────────────────────────────────
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
  status text default 'planned',
  started_at timestamptz default now(),
  completed_at timestamptz,
  photo_url text,
  note text,
  staff_name text,
  created_at timestamptz default now()
);
create index if not exists vehicle_trip_vehicle_idx on vehicle_trip (vehicle_id, started_at desc);

-- ── vehicle_odometer_log (รายสัปดาห์) ──────────────────────────
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

-- ── bill_draft (พักบิล) ────────────────────────────────────────
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
  status text default 'waiting'
    check (status in ('waiting','ready','resumed','expired','cancelled')),
  completed_bill_id text,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  resumed_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists bill_draft_staff_status_idx on bill_draft (staff_name, status);
create index if not exists bill_draft_expiry_idx on bill_draft (status, expires_at);

-- Trigger: เมื่อ token ถูกใช้ → mark draft เป็น 'ready'
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

-- ── RPC: atomic fuel dispense ──────────────────────────────────
create or replace function sk_fuel_dispense(
  p_tank_id bigint, p_vehicle_id bigint, p_qty_l numeric,
  p_bill_ids jsonb default '[]'::jsonb,
  p_staff text default null, p_note text default null,
  p_odometer numeric default null
) returns bigint as $$
declare new_id bigint; cur_level numeric;
begin
  select current_level_l into cur_level from fuel_tank where id = p_tank_id for update;
  if cur_level is null then raise exception 'fuel_tank_not_found'; end if;
  if cur_level < p_qty_l then raise exception 'fuel_tank_insufficient'; end if;

  update fuel_tank set current_level_l = current_level_l - p_qty_l where id = p_tank_id;

  insert into fuel_dispense (
    tank_id, vehicle_id, qty_l, bill_ids, staff_name, note, odometer_km
  ) values (
    p_tank_id, p_vehicle_id, p_qty_l, p_bill_ids, p_staff, p_note, p_odometer
  ) returning id into new_id;

  return new_id;
end; $$ language plpgsql security invoker;

grant execute on function sk_fuel_dispense to anon, authenticated;

-- ── RPC: atomic tank refill ────────────────────────────────────
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
    p_tank_id, p_qty_l, p_price_per_l, p_qty_l * p_price_per_l, p_supplier, p_invoice, p_staff, p_note
  ) returning id into new_id;

  return new_id;
end; $$ language plpgsql security invoker;

grant execute on function sk_fuel_tank_refill to anon, authenticated;

-- ── RPC: resume bill_draft (atomic + stock check) ──────────────
create or replace function sk_resume_bill_draft(p_draft_id text, p_staff text)
returns jsonb as $$
declare
  draft_row bill_draft%rowtype;
begin
  select * into draft_row from bill_draft
    where id = p_draft_id and staff_name = p_staff
    for update;

  if draft_row.id is null then
    raise exception 'bill_draft_not_found_or_not_owned';
  end if;
  if draft_row.status = 'resumed' then
    raise exception 'bill_draft_already_resumed';
  end if;
  if draft_row.status = 'cancelled' or draft_row.status = 'expired' then
    raise exception 'bill_draft_unavailable: %', draft_row.status;
  end if;
  if draft_row.expires_at < now() then
    update bill_draft set status = 'expired' where id = p_draft_id;
    raise exception 'bill_draft_expired';
  end if;

  -- mark resumed
  update bill_draft set status = 'resumed', resumed_at = now() where id = p_draft_id;

  return jsonb_build_object(
    'id', draft_row.id,
    'cart', draft_row.cart_snapshot,
    'checkout_state', draft_row.checkout_state,
    'token_id', draft_row.token_id,
    'pin_payload', (select used_payload from delivery_pin_token where id = draft_row.token_id)
  );
end; $$ language plpgsql security invoker;

grant execute on function sk_resume_bill_draft to anon, authenticated;

-- ── RPC: ปิดงานส่ง + ผูกรถ + auto-link fuel_dispense ──────────
-- เรียกตอนกด "ส่งสำเร็จ" หลังจาก JS ดึง routing แล้วส่งค่า distance_km มา
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
  -- หา assignment ของบิลนี้
  select id into v_assignment_id from delivery_assignment
    where bill_id = p_bill_id for update;

  if v_assignment_id is null then
    raise exception 'delivery_assignment_not_found_for_bill: %', p_bill_id;
  end if;

  -- update assignment
  update delivery_assignment set
    vehicle_id = p_vehicle_id,
    driver_name = p_driver_name,
    vehicle_assigned_at = v_completed_at,
    distance_km = coalesce(
      case when p_odometer_start is not null and p_odometer_end is not null
        then p_odometer_end - p_odometer_start
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

  -- auto-link fuel_dispense ของ vehicle นี้ที่ยังไม่ผูกบิล
  -- ในช่วงเวลา 6:00 ของวันนั้น → completed_at + 1 ชั่วโมง
  v_link_window_start := date_trunc('day', v_completed_at) + interval '6 hours';

  with linkable as (
    select id from fuel_dispense
    where vehicle_id = p_vehicle_id
      and dispensed_at between v_link_window_start and v_completed_at + interval '1 hour'
      and (bill_ids is null or jsonb_array_length(bill_ids) = 0)
    for update
  )
  update fuel_dispense set bill_ids = bill_ids || to_jsonb(p_bill_id::text)
    where id in (select id from linkable)
    returning id into v_linked_dispense_ids;

  -- update actual_fuel_l จากที่ผูกมา
  update delivery_assignment set
    actual_fuel_l = (
      select coalesce(sum(qty_l), 0) from fuel_dispense
      where vehicle_id = p_vehicle_id
        and bill_ids ? p_bill_id
    )
  where id = v_assignment_id;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'linked_dispense_ids', v_linked_dispense_ids,
    'completed_at', v_completed_at
  );
end; $$ language plpgsql security invoker;

grant execute on function sk_complete_delivery to anon, authenticated;

-- ── View: สรุปต่อรถต่อวัน (สำหรับรายงาน) ──────────────────────
-- ── RPC: บันทึกเลขไมล์รายสัปดาห์ + คำนวณ variance ──────────────
create or replace function sk_record_odometer(
  p_vehicle_id bigint,
  p_odometer_km numeric,
  p_staff text default null,
  p_note text default null
) returns jsonb as $$
declare
  v_prev_log vehicle_odometer_log%rowtype;
  v_system_km numeric := 0;
  v_actual_km numeric := 0;
  v_variance numeric := 0;
  v_flag boolean := false;
  v_threshold numeric;
  v_new_id bigint;
begin
  -- หาบันทึกครั้งล่าสุดของรถคันนี้
  select * into v_prev_log from vehicle_odometer_log
    where vehicle_id = p_vehicle_id
    order by recorded_at desc limit 1;

  if v_prev_log.id is not null then
    -- ระยะจริงจากเลขไมล์
    v_actual_km := p_odometer_km - v_prev_log.odometer_km;

    -- ระยะที่ระบบบันทึก (delivery + vehicle_trip)
    select coalesce(sum(distance_km), 0) into v_system_km
      from (
        select distance_km from delivery_assignment
         where vehicle_id = p_vehicle_id
           and completed_at > v_prev_log.recorded_at
           and status = 'done'
        union all
        select distance_km from vehicle_trip
         where vehicle_id = p_vehicle_id
           and completed_at > v_prev_log.recorded_at
           and status = 'done'
      ) t;

    if v_actual_km > 0 then
      v_variance := abs(v_actual_km - v_system_km) / v_actual_km * 100;
    end if;

    if v_variance > 15 then v_flag := true; end if;
  end if;

  insert into vehicle_odometer_log (
    vehicle_id, odometer_km, recorded_by,
    system_km_since_last, actual_km_since_last,
    variance_pct, flag_mismatch, note
  ) values (
    p_vehicle_id, p_odometer_km, p_staff,
    v_system_km, v_actual_km,
    v_variance, v_flag, p_note
  ) returning id into v_new_id;

  return jsonb_build_object(
    'log_id', v_new_id,
    'system_km', v_system_km,
    'actual_km', v_actual_km,
    'variance_pct', v_variance,
    'flag_mismatch', v_flag
  );
end; $$ language plpgsql security invoker;

grant execute on function sk_record_odometer to anon, authenticated;

-- ── View: สรุปต่อรถต่อวัน (สำหรับรายงาน) ──────────────────────
create or replace view vw_vehicle_daily_summary as
select
  v.id as vehicle_id,
  v.plate_no,
  v.name as vehicle_name,
  d.day::date as day,
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
  -- รวม delivery + vehicle_trip เพื่อนับ km ของรถทั้งวัน
  select vehicle_id, day,
    sum(delivery_count) as delivery_count, sum(total_km) as total_km
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
) f on f.vehicle_id = v.id and f.day = d.day
where v.active = true;

grant select on vw_vehicle_daily_summary to anon, authenticated;
```

---

## 9) RLS Policies (ถ้าใช้ RLS ใน Supabase)

> Note: ถ้าระบบยังไม่เปิด RLS ข้ามหัวข้อนี้ได้ — ใช้ anon key อยู่แล้ว

```sql
-- delivery_pin_token: ลูกค้าอ่านได้เฉพาะ row ที่ token ตรง (ไม่ต้อง login)
alter table delivery_pin_token enable row level security;
create policy "pin_token_read_by_token" on delivery_pin_token for select
  using (true);  -- ใช้ token check ในฝั่ง JS แทน (เพราะ token unguessable)

-- pin_token submit: เฉพาะ update used_at + used_payload
create policy "pin_token_update_use" on delivery_pin_token for update
  using (used_at is null and expires_at > now())
  with check (used_at is not null);

-- bill_draft: เฉพาะ staff ที่ login เห็น draft ตัวเอง
alter table bill_draft enable row level security;
create policy "bill_draft_own" on bill_draft for all
  using (staff_name = current_setting('app.username', true));
```

---

## 📌 ประเด็นที่ต้องระวัง

1. **Privacy of pin tokens** — token เดา hard ได้ → ใช้ 12-char random, expires 48h, used_at บล็อกการใช้ซ้ำ
2. **GPS permission denied** — fallback ให้ลูกค้าลากหมุดเองบนแผนที่
3. **Tablet เก่า / browser ไม่รองรับ Geolocation** — fallback ตรงนี้สำคัญ
4. **กรณีลูกค้ากด "ใช้ตำแหน่งปัจจุบัน" ที่ร้าน** → ระบบเตือน "หมุดอยู่ใกล้ร้านมาก" + ขอยืนยัน
5. **Customer-display ไม่ได้เปิด** → แสดง QR บน POS เอง (fallback modal)
6. **Realtime ไม่ทำงาน** → fallback polling token.used_at ทุก 3 วินาที (ระหว่างรอ)
7. **น้ำมัน RPC fail** (เช่น tank ไม่พอ) → toast error ชัดเจน + ไม่เขียนข้อมูล
8. **Routing API down / rate limit** → fallback ใช้ Haversine × multiplier + flag route_source='haversine_fallback' ให้รู้
9. **Routing API ส่งพิกัดออกนอกประเทศ** → ระบบเก็บแค่ start/end + distance, ไม่ส่งข้อมูลลูกค้า (เพื่อ privacy)
10. **เปรียบเทียบ km/L กับ baseline** — รถใหม่ ๆ ที่เพิ่งเพิ่มยังไม่มี avg_kmpl → skip anomaly จนกว่าจะมีข้อมูล ≥ 3 บิล
11. **กดส่งสำเร็จซ้ำ** — RPC ตรวจ status='done' แล้ว → reject + toast "บิลนี้ปิดไปแล้ว"

---

*Last updated: 2026-05-18*
