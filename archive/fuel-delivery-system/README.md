# 🗄️ Archive — Fuel / Vehicle / Delivery System

> โปรเจกต์นี้ถูกยกเลิกโดยเจ้าของร้าน เนื่องจากเจอวิธีแก้ที่ดีกว่า
> ไฟล์ทั้งหมดถูกเก็บไว้ที่นี่เผื่อใช้อ้างอิงในอนาคต

## 📦 สิ่งที่อยู่ในโฟลเดอร์นี้

### JavaScript modules (8 ตัว)
- `modules-v83-fuel-delivery-foundation.js` — schema check + Settings + helpers (SK_FUEL)
- `modules-v84-fuel-vehicle-tank.js` — UI ทะเบียนรถ + ถังน้ำมัน + ทริปออกรถ + จดเลขไมล์ (มี Leaflet map)
- `modules-v85-fuel-dispense.js` — UI จ่ายน้ำมัน + external refill (ปั๊มนอก)
- `modules-v86-delivery-pin.js` — QR pin flow สำหรับลูกค้าใหม่ + customer-display
- `modules-v88-delivery-assignment.js` — งานส่งวันนี้ + table view + complete delivery modal
- `modules-v89-fuel-reports-anomaly.js` — รายงานสรุป + anomaly detection
- `modules-v90-delivery-vehicle-bridge.js` — wrap v12DQMarkDone + vehicle picker + Google Maps + auto-deduct fuel
- `modules-v91-delivery-map-view.js` — Leaflet map panel ในหน้าคิวจัดส่ง

### Web pages
- `pin.html` — หน้า standalone ให้ลูกค้ากรอกข้อมูล + ปักหมุดผ่านมือถือ

### Database
- `migrations/fuel_delivery_schema.sql` — DDL สำหรับ tables: `vehicle`, `fuel_tank`, `fuel_tank_refill`, `fuel_dispense`, `vehicle_external_refill`, `delivery_assignment`, `delivery_pin_token`, `vehicle_trip`, `vehicle_odometer_log`, `bill_draft` (ใช้ใน v87) + RPCs + view

### Design Documentation
- `docs/fuel-delivery-system.md` — Design doc ทั้งระบบ (Workflow, Schema, UI wireframes, Phase plan)

## ⚠️ ที่ยังเหลือใน main project (เกี่ยวข้องแต่ไม่ได้ archive)

| ไฟล์ | สถานะ | เหตุผล |
|---|---|---|
| `modules-v87-bill-draft-hold.js` | ✅ เก็บไว้ | ระบบพักบิล — feature ทั่วไป ไม่ได้ผูกกับ fuel เลย ยังใช้ได้ |
| `customer-display.html` | ✅ เก็บไว้ | มี handlers `pin_qr` / `pin_done` ที่เหลืออยู่ แต่ไม่ถูกเรียกแล้ว (dead code, harmless) |
| Customer table columns | ✅ เก็บไว้ใน DB | `customer.lat`, `customer.lng`, `customer.pin_updated_at`, `customer.signup_consent` — เพิ่มไว้แต่ไม่ใช้ |
| Postgres tables | ✅ เก็บไว้ใน Supabase | ทุก table ยังอยู่ใน DB — ถ้าจะเอาออก ต้อง drop ใน SQL Editor เอง |
| `migrations/atomic_stock_debt.sql` | ✅ เก็บไว้ | เป็นของระบบสต็อก/หนี้ทั่วไป ไม่เกี่ยวกับ fuel |

## 🔄 ถ้าจะ restore ระบบกลับมา

1. คัดลอกไฟล์ทั้ง 8 modules + pin.html กลับไปยัง root
2. คัดลอก `migrations/fuel_delivery_schema.sql` กลับไป `migrations/`
3. เพิ่ม script tags กลับใน `index.html` (เรียง v83-v91)
4. เพิ่ม Leaflet CDN ใน `<head>` ของ `index.html`:
   ```html
   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
   <script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
   ```
5. เพิ่ม nav section + page-* sections ใน `index.html`
6. เพิ่ม route cases + titles ใน `app.js`

---

*Archived: 2026-05-19*
