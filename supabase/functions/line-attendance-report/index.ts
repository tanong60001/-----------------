// @ts-nocheck — Supabase Edge Function (Deno)
// LINE Webhook: ผู้ช่วยร้านแบบเมนู PDF และแจ้งสรุปเช็คชื่ออัตโนมัติเมื่อครบทุกคน
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createMinimalReportPdf,
  createProductsRankingPdf,
  type MinimalReportSource,
} from "./pdf-renderer.ts";

const LINE_TOKEN = (Deno.env.get("LINE_TOKEN") || "").trim();
const LINE_GROUP_ID = (Deno.env.get("LINE_GROUP_ID") || "").trim();
const LINE_CHANNEL_SECRET = (Deno.env.get("LINE_CHANNEL_SECRET") || "").trim();
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const enc = new TextEncoder();
const ASSISTANT_BUCKET = "line-assistant";
const THAI_FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf";
let bucketReady: Promise<void> | null = null;
let thaiFontBytes: Promise<Uint8Array> | null = null;

const OPTIONS = [
  { key: "attendance", no: 1, icon: "🪪", title: "เช็คชื่อวันนี้", hint: "มา สาย ลา ขาด และผู้ที่ยังไม่อัปเดต" },
  { key: "sales", no: 2, icon: "🧾", title: "ยอดขายวันนี้", hint: "ตั้งแต่เปิดรอบ แยกบิล เงินสด และเงินโอน" },
  { key: "cash", no: 3, icon: "💵", title: "จำนวนแบงค์ในลิ้นชัก", hint: "แยกธนบัตรและเหรียญอย่างละเอียด" },
  { key: "debt", no: 4, icon: "👥", title: "ลูกค้าค้างชำระทั้งหมด", hint: "ยอดปัจจุบัน ไม่รวมทะเบียนหนี้เสีย" },
  { key: "delivery", no: 5, icon: "🚚", title: "รายการขนส่ง", hint: "งานค้าง ส่งวันนี้ เกินกำหนด และยอดเก็บ" },
  { key: "products", no: 6, icon: "🏆", title: "สินค้าขายดี 30 วัน", hint: "อันดับ จำนวนขาย และยอดขายโดยประมาณ" },
];
const VALID_KEYS = new Set(OPTIONS.map((option) => option.key));
const WAKE_WORDS = new Set([
  "สวัดดี", "สวัสดี",
  "สวัดดีผู้ช่วย", "สวัสดีผู้ช่วย",
  "ผู้ช่วย", "เมนู", "เมนูผู้ช่วย", "ทดสอบผู้ช่วย",
]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-line-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const baht = (n: number) =>
  "฿" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const number = (n: number) =>
  Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const normStatus = (value: string) => value === "มาครึ่งวัน" ? "ครึ่งวัน" : value;
const parseInfo = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try { return JSON.parse(String(value)); } catch (_) { return {}; }
};
function todayTH() {
  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
}
function thDate(value: string, withTime = false) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
const safeSelected = (raw: string | null) =>
  [...new Set(String(raw || "").split(",").filter((key) => VALID_KEYS.has(key)))];
const selectionData = (mode: string, selected: string[], item?: string) => {
  const query = new URLSearchParams({ a: "assistant", mode, selected: selected.join(",") });
  if (item) query.set("item", item);
  return query.toString();
};
async function ensureAssistantBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      const bucketExists = (data || []).some((bucket) => bucket.name === ASSISTANT_BUCKET);
      const bucketOptions = {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf", "application/json"],
      };
      if (!bucketExists) {
        const created = await supabase.storage.createBucket(ASSISTANT_BUCKET, {
          ...bucketOptions,
        });
        if (created.error && !/already|duplicate/i.test(created.error.message || "")) throw created.error;
      } else {
        const updated = await supabase.storage.updateBucket(ASSISTANT_BUCKET, bucketOptions);
        if (updated.error) throw updated.error;
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

async function getThaiFontBytes() {
  if (!thaiFontBytes) {
    thaiFontBytes = fetch(THAI_FONT_URL).then(async (response) => {
      if (!response.ok) throw new Error(`โหลดฟอนต์ภาษาไทยไม่สำเร็จ (${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    }).catch((error) => {
      thaiFontBytes = null;
      throw error;
    });
  }
  return await thaiFontBytes;
}

async function lineRequest(path: "reply" | "push", body: unknown) {
  const response = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`LINE ${path} ${response.status}: ${await response.text()}`);
}
async function reply(replyToken: string, messages: unknown[]) {
  await lineRequest("reply", { replyToken, messages });
}
async function push(messages: unknown[]) {
  if (!LINE_GROUP_ID) throw new Error("ยังไม่ได้ตั้ง LINE_GROUP_ID");
  await lineRequest("push", { to: LINE_GROUP_ID, messages });
}

async function validSignature(raw: string, received: string) {
  if (!LINE_CHANNEL_SECRET || !received) return false;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(LINE_CHANNEL_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  let binary = "";
  signed.forEach((byte) => binary += String.fromCharCode(byte));
  const expected = btoa(binary);
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

function menuBubble() {
  const styles = [
    ["#ECFDF3", "#16A34A"], ["#EFF6FF", "#3B82F6"],
    ["#F0FDF4", "#22C55E"], ["#F5F3FF", "#8B5CF6"],
    ["#FFF7ED", "#F97316"], ["#FFFBEB", "#D97706"],
  ];
  const tiles = OPTIONS.map((option, index) => ({
    type: "box", layout: "vertical", flex: 1, spacing: "sm",
    backgroundColor: styles[index][0], cornerRadius: "18px", paddingAll: "15px",
    borderWidth: "1px", borderColor: `${styles[index][1]}33`,
    action: {
      type: "postback", label: option.title,
      data: selectionData("pdf", [option.key], option.key),
    },
    contents: [
      { type: "text", text: option.icon, size: "xxl", align: "center" },
      { type: "text", text: option.title, size: "sm", color: "#172033", weight: "bold", align: "center", wrap: true },
      { type: "text", text: "แตะเพื่อรับ PDF", size: "xxs", color: styles[index][1], align: "center" },
    ],
  }));
  const rows = [0, 2, 4].map((start) => ({
    type: "box", layout: "horizontal", spacing: "md",
    contents: [tiles[start], tiles[start + 1]],
  }));
  return {
    type: "bubble", size: "mega",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#FFFFFF",
      paddingAll: "20px", spacing: "xs",
      contents: [
        { type: "text", text: "🏪  เมนูลัดร้าน SK", color: "#172033", size: "xl", weight: "bold" },
        { type: "text", text: "เลือกข้อมูลที่ต้องการ ระบบจะดึงข้อมูลล่าสุดเมื่อแตะ", color: "#718096", size: "sm", wrap: true },
      ],
    },
    body: { type: "box", layout: "vertical", paddingAll: "14px", spacing: "md",
      backgroundColor: "#F8FAFC", contents: rows },
    footer: { type: "box", layout: "vertical", paddingAll: "14px", spacing: "xs", backgroundColor: "#FFFFFF",
      contents: [
        { type: "text", text: "PDF อายุ 24 ชม. • แคชข้อมูล 5 นาที • ไม่มีหน้าเว็บคั่น", size: "xxs", color: "#94A3B8", align: "center" },
      ] },
  };
}

function deliveryState(bill: Record<string, unknown>) {
  const status = `${bill.status || ""} ${bill.delivery_status || ""}`;
  if (/ยกเลิก|คืนสินค้า|cancel/i.test(status)) return "cancel";
  if (/จัดส่งสำเร็จ|ส่งแล้ว|delivered|complete/i.test(String(bill.delivery_status || ""))) return "done";
  const mode = String(bill.delivery_mode || "");
  if (/รับเอง|ไม่จัดส่ง/.test(mode)) return "self";
  if (!/ส่ง|จัดส่ง|deliver|partial/i.test(`${mode} ${bill.delivery_status || ""}`)) return "self";
  const date = String(bill.delivery_date || "").slice(0, 10);
  const today = todayTH();
  if (!date) return "unscheduled";
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}
function billRemaining(bill: Record<string, unknown>) {
  const info = parseInfo(bill.return_info);
  if (Object.prototype.hasOwnProperty.call(info, "remaining_amount")) {
    return Math.max(0, Number(info.remaining_amount || 0));
  }
  const total = Math.max(0, Number(info.new_total ?? bill.total ?? 0));
  const received = Math.max(Number(bill.deposit_amount || 0),
    Math.max(0, Number(bill.received || 0) - Number(bill.change || 0)));
  if (!/ค้าง|เครดิต|ชำระหน้างาน|เก็บปลายทาง|cod/i.test(`${bill.method || ""} ${bill.status || ""}`)) return 0;
  return Math.max(0, total - received);
}
async function fetchPaged(buildQuery: () => unknown, maxRows = 10000) {
  const rows: unknown[] = [];
  const pageSize = 1000;
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await buildQuery().range(from, Math.min(from + pageSize - 1, maxRows - 1));
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
  }
  return rows;
}
async function loadProductsRanking(limit = 100) {
  const start = new Date(Date.now() - 30 * 86400000).toISOString();
  const bills = await fetchPaged(() => supabase.from("บิลขาย")
    .select("id,status").gte("date", start).order("date", { ascending: true }), 10000);
  const validIds = bills.filter((bill) =>
    !/ยกเลิก|คืนสินค้า|หนี้เสีย|ตัดหนี้/i.test(String(bill.status || ""))).map((bill) => bill.id);
  const items: unknown[] = [];
  for (let index = 0; index < validIds.length; index += 100) {
    const ids = validIds.slice(index, index + 100);
    const rows = await fetchPaged(() => supabase.from("รายการในบิล")
      .select("bill_id,name,qty,unit,price,total").in("bill_id", ids), 5000);
    items.push(...rows);
  }
  const grouped = new Map<string, { name: string; qty: number; unit: string; amount: number }>();
  for (const item of items) {
    const name = String(item.name || "ไม่ระบุสินค้า").trim();
    const unit = String(item.unit || "ชิ้น");
    const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;
    if (!grouped.has(key)) grouped.set(key, { name, qty: 0, unit, amount: 0 });
    const row = grouped.get(key)!;
    row.qty += Number(item.qty || 0);
    row.amount += Number(item.total || Number(item.price || 0) * Number(item.qty || 0));
  }
  const all = [...grouped.values()].sort((a, b) => b.amount - a.amount);
  return {
    top: all.slice(0, limit),
    productCount: all.length,
    billCount: validIds.length,
    totalQty: all.reduce((sum, item) => sum + item.qty, 0),
    totalAmount: all.reduce((sum, item) => sum + item.amount, 0),
    start,
    end: new Date().toISOString(),
  };
}

const PDF_META: Record<string, { title: string; subtitle: string; accent: string }> = {
  attendance: { title: "เช้านี้ทีมเราเป็นอย่างไร", subtitle: "สรุปเช็คชื่อแบบอ่านง่าย พร้อมเวลาลงงาน", accent: "#16A34A" },
  sales: { title: "วันนี้ร้านขายเป็นอย่างไร", subtitle: "ภาพรวมยอดขายตั้งแต่เปิดรอบ พร้อมช่องทางรับเงิน", accent: "#3B82F6" },
  cash: { title: "เงินในลิ้นชักตอนนี้", subtitle: "ยอดรวมและจำนวนธนบัตรตามข้อมูลในระบบ", accent: "#059669" },
  debt: { title: "ภาพรวมลูกค้าที่ค้างชำระ", subtitle: "ยอดปัจจุบันที่ควรติดตาม ไม่รวมทะเบียนหนี้เสีย", accent: "#8B5CF6" },
  delivery: { title: "วันนี้มีอะไรต้องจัดส่งบ้าง", subtitle: "เรียงงานเร่งด่วนก่อน พร้อมยอดที่ต้องเก็บ", accent: "#F97316" },
  products: { title: "สินค้าขายดี 30 วัน", subtitle: "ดูง่ายว่าอะไรขายดีและทำยอดให้ร้าน", accent: "#D97706" },
};

function cleanPdfText(value: unknown) {
  return String(value ?? "-")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\uFE0E\uFE0F\u200D]/g, "")
    .replace(/\s+/g, " ").trim() || "-";
}

function collectFlexText(node: unknown, output: string[] = []) {
  if (!node || typeof node !== "object") return output;
  const value = node as Record<string, unknown>;
  if (value.type === "text" && value.text) output.push(cleanPdfText(value.text));
  for (const key of ["header", "hero", "body", "footer"]) collectFlexText(value[key], output);
  if (Array.isArray(value.contents)) value.contents.forEach((item) => collectFlexText(item, output));
  return output;
}

const pdfClock = (value: unknown) => {
  if (!value) return "ยังไม่มีเวลา";
  const text = String(value);
  const clock = text.match(/^(\d{1,2}:\d{2})/);
  if (clock) return `${clock[1]} น.`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return `${parsed.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
  })} น.`;
};

async function attendanceSnapshot() {
  const today = todayTH();
  const [{ data: employees, error: employeeError }, { data: attendance, error: attendanceError }] = await Promise.all([
    supabase.from("พนักงาน").select("id,name,lastname,status").eq("status", "ทำงาน").order("name"),
    supabase.from("เช็คชื่อ").select("employee_id,status,time_in,time_out").eq("date", today),
  ]);
  if (employeeError) throw employeeError;
  if (attendanceError) throw attendanceError;
  const byEmployee = new Map((attendance || []).map((row) => [String(row.employee_id), row]));
  const counts: Record<string, number> = { มา: 0, มาสาย: 0, ครึ่งวัน: 0, ลา: 0, ขาด: 0 };
  const rows = (employees || []).map((employee) => {
    const attendanceRow = byEmployee.get(String(employee.id));
    const status = attendanceRow ? normStatus(String(attendanceRow.status || "ไม่ระบุ")) : "ยังไม่ลงสถานะ";
    if (counts[status] !== undefined) counts[status]++;
    return {
      employee,
      attendance: attendanceRow,
      name: `${employee.name || "-"} ${employee.lastname || ""}`.trim(),
      status,
    };
  });
  const checked = rows.filter((row) => row.attendance).length;
  const total = rows.length;
  return {
    today, rows, counts, checked, total,
    complete: total > 0 && checked === total,
    working: counts.มา + counts.มาสาย + counts.ครึ่งวัน,
    pending: rows.filter((row) => !row.attendance),
    away: rows.filter((row) => row.status === "ลา" || row.status === "ขาด"),
  };
}

function attendancePdfSource(snapshot: Awaited<ReturnType<typeof attendanceSnapshot>>): MinimalReportSource {
  const { counts, checked, total, complete, working, pending, away } = snapshot;
  const summary = !total
    ? "ยังไม่มีรายชื่อพนักงานที่อยู่ในสถานะทำงาน จึงยังสรุปเช็คชื่อไม่ได้"
    : complete && away.length === 0 && counts.มาสาย === 0
      ? `เช้านี้ทีมมาครบ ${total} คน ทุกอย่างเรียบร้อย พร้อมเริ่มงานได้เลย`
      : complete
        ? `เช็คชื่อครบแล้ว ${total} คน วันนี้มาทำงาน ${working} คน และมี ${away.length} คนที่ลาหรือขาด`
        : `ลงสถานะแล้ว ${checked} จาก ${total} คน ยังรออีก ${pending.length} คนก่อนปิดสรุปเช้านี้`;
  const tone: Record<string, string> = {
    มา: "good", มาสาย: "warn", ครึ่งวัน: "warn", ลา: "neutral", ขาด: "danger", "ยังไม่ลงสถานะ": "warn",
  };
  return {
    ...PDF_META.attendance,
    summary,
    metrics: [
      { label: "ลงสถานะแล้ว", value: `${checked}/${total} คน`, tone: complete ? "good" : "warn" },
      { label: "มาทำงาน", value: `${working} คน`, tone: "good" },
      { label: "มาสาย / ครึ่งวัน", value: `${counts.มาสาย + counts.ครึ่งวัน} คน`, tone: counts.มาสาย + counts.ครึ่งวัน ? "warn" : "neutral" },
      { label: "ลา / ขาด", value: `${counts.ลา + counts.ขาด} คน`, tone: counts.ขาด ? "danger" : "neutral" },
    ],
    sections: [{
      title: "รายชื่อทีมวันนี้",
      description: "มองแถวเดียวก็รู้ว่าใครมาแบบไหน และลงเวลาเมื่อไร",
      rows: snapshot.rows.map((row, index) => ({
        title: `${index + 1}. ${row.name}`,
        detail: row.attendance
          ? `เข้างาน ${pdfClock(row.attendance.time_in)}  •  ออกงาน ${pdfClock(row.attendance.time_out)}`
          : "ยังไม่มีข้อมูลเช็คชื่อของวันนี้",
        value: row.status,
        tone: tone[row.status] || "neutral",
      })),
    }],
    note: complete
      ? "เช็คชื่อครบทุกคนแล้ว ระบบจะส่งสรุปอัตโนมัติเข้ากลุ่มเพียงหนึ่งครั้งต่อวัน"
      : `คนที่ยังไม่มีข้อมูล: ${pending.map((row) => row.name).join(", ") || "ไม่มี"}`,
  };
}

async function debtPdfSource() {
  const { data, error } = await supabase.from("customer")
    .select("id,name,phone,debt_amount,credit_limit").gt("debt_amount", 0)
    .order("debt_amount", { ascending: false }).limit(500);
  if (error) throw error;
  const customers = (data || []).filter((customer) => Number(customer.debt_amount || 0) > 0.009);
  const total = customers.reduce((sum, customer) => sum + Number(customer.debt_amount || 0), 0);
  const highest = customers[0];
  const average = customers.length ? total / customers.length : 0;
  return {
    ...PDF_META.debt,
    summary: customers.length
      ? `ตอนนี้มีลูกค้าค้างชำระ ${customers.length} ราย รวม ${baht(total)} โดยเรียงรายที่ควรติดตามก่อนจากยอดสูงสุด`
      : "ยอดเยี่ยม ตอนนี้ไม่มีลูกค้าค้างชำระในระบบ",
    metrics: [
      { label: "ยอดค้างทั้งหมด", value: baht(total), tone: total ? "danger" : "good" },
      { label: "จำนวนลูกหนี้", value: `${customers.length} ราย`, tone: customers.length ? "warn" : "good" },
      { label: "ยอดสูงสุด", value: highest ? baht(highest.debt_amount) : "฿0", tone: highest ? "danger" : "good" },
      { label: "เฉลี่ยต่อราย", value: baht(average), tone: "neutral" },
    ],
    sections: [{
      title: "เรียงตามยอดที่ควรติดตาม",
      rows: customers.map((customer, index) => ({
        title: `${index + 1}. ${customer.name || "ไม่ระบุชื่อลูกค้า"}`,
        detail: customer.phone ? `โทร ${customer.phone}` : "ยังไม่มีเบอร์โทรในระบบ",
        value: baht(customer.debt_amount),
        tone: index < 3 ? "danger" : "neutral",
      })),
    }],
    note: "รายงานนี้ใช้ยอดลูกหนี้ปัจจุบัน และไม่รวมรายการที่ย้ายไปทะเบียนหนี้เสียแล้ว",
  };
}

async function deliveryPdfSource() {
  const data = await fetchPaged(() => supabase.from("บิลขาย")
    .select("id,bill_no,total,method,status,customer_name,delivery_mode,delivery_status,delivery_date,delivery_phone,delivery_address,deposit_amount,received,change,return_info")
    .order("delivery_date", { ascending: true }), 20000);
  const pending = data.map((bill) => ({ bill, state: deliveryState(bill) }))
    .filter((row) => !["cancel", "done", "self"].includes(row.state));
  const priority: Record<string, number> = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3 };
  pending.sort((a, b) => priority[a.state] - priority[b.state]);
  const labels: Record<string, string> = {
    overdue: "เกินกำหนด", today: "ส่งวันนี้", upcoming: "งานถัดไป", unscheduled: "ยังไม่กำหนดวัน",
  };
  const collect = pending.reduce((sum, row) => sum + billRemaining(row.bill), 0);
  const count = (state: string) => pending.filter((row) => row.state === state).length;
  const tone: Record<string, string> = { overdue: "danger", today: "warn", unscheduled: "warn", upcoming: "neutral" };
  return {
    ...PDF_META.delivery,
    summary: pending.length
      ? `มีงานจัดส่งค้าง ${pending.length} งาน ระบบเรียงงานเกินกำหนดและงานวันนี้ไว้บนสุด เพื่อให้ทีมเริ่มจากเรื่องเร่งด่วนก่อน`
      : "วันนี้ไม่มีงานจัดส่งค้าง ทีมจัดส่งเคลียร์เรียบร้อยแล้ว",
    metrics: [
      { label: "เกินกำหนด", value: `${count("overdue")} งาน`, tone: count("overdue") ? "danger" : "good" },
      { label: "ต้องส่งวันนี้", value: `${count("today")} งาน`, tone: count("today") ? "warn" : "neutral" },
      { label: "งานที่รออยู่", value: `${pending.length} งาน`, tone: pending.length ? "warn" : "good" },
      { label: "ยอดที่ต้องเก็บ", value: baht(collect), tone: collect ? "good" : "neutral" },
    ],
    sections: ["overdue", "today", "unscheduled", "upcoming"].map((state) => ({
      title: labels[state],
      rows: pending.filter((row) => row.state === state).map(({ bill }, index) => ({
        title: `${index + 1}. #${bill.bill_no || String(bill.id).slice(0, 8)}  ${bill.customer_name || "ลูกค้าทั่วไป"}`,
        detail: [
          bill.delivery_date ? `นัด ${thDate(bill.delivery_date)}` : "ยังไม่ได้นัดวัน",
          bill.delivery_phone ? `โทร ${bill.delivery_phone}` : "",
          bill.delivery_address || "",
        ].filter(Boolean).join("  •  "),
        value: billRemaining(bill) > 0 ? `เก็บ ${baht(billRemaining(bill))}` : "ชำระแล้ว",
        tone: tone[state] || "neutral",
      })),
    })),
    note: "ไม่รวมบิลยกเลิก คืนสินค้า งานรับเอง และงานที่ส่งสำเร็จแล้ว",
  };
}

async function cashPdfSource(key: "sales" | "cash") {
  const response = await cashAssistantReports([key]);
  const report = response.reports?.[key];
  if (!report) {
    const bubble = response.bubbles?.[0];
    if (!bubble) throw new Error("ไม่พบข้อมูลรายงาน");
    const rows = collectFlexText(bubble).filter((value, index, all) => value && value !== all[index - 1]);
    return {
      ...PDF_META[key],
      summary: "สรุปข้อมูลล่าสุดจากระบบลิ้นชัก",
      metrics: [],
      sections: [{ title: "รายละเอียด", rows: rows.map((title) => ({ title })) }],
    };
  }
  if (key === "sales") {
    if (!report.open) return {
      ...PDF_META.sales,
      summary: "วันนี้ยังไม่ได้เปิดรอบลิ้นชัก จึงยังไม่มียอดขายของรอบให้สรุป",
      metrics: [
        { label: "ยอดขาย", value: "฿0", tone: "neutral" },
        { label: "จำนวนบิล", value: "0 บิล", tone: "neutral" },
      ],
      sections: [{ title: "สิ่งที่ต้องทำ", rows: [{ title: "เปิดรอบลิ้นชักในโปรแกรมก่อนเริ่มขาย" }] }],
    };
    const methods = Array.isArray(report.methods) ? report.methods : [];
    const recent = Array.isArray(report.recent) ? report.recent : [];
    const cash = methods.find((item) => item.method === "เงินสด")?.amount || 0;
    const transfer = methods.find((item) => item.method === "โอนเงิน")?.amount || 0;
    return {
      ...PDF_META.sales,
      summary: report.billCount
        ? `ตั้งแต่เปิดรอบ ร้านขายแล้ว ${report.billCount} บิล รวม ${baht(report.total)} ช่องทางหลักวันนี้คือ ${methods[0]?.method || "ยังไม่ระบุ"}`
        : "เปิดรอบแล้ว แต่ยังไม่มีบิลขายในรอบนี้",
      metrics: [
        { label: "ยอดขายรวม", value: baht(report.total), tone: "good" },
        { label: "จำนวนบิล", value: `${report.billCount} บิล`, tone: "neutral" },
        { label: "รับเงินสด", value: baht(cash), tone: "good" },
        { label: "รับเงินโอน", value: baht(transfer), tone: "neutral" },
      ],
      sections: [
        {
          title: "เงินเข้าทางไหนบ้าง",
          rows: methods.map((item) => ({
            title: item.method || "ไม่ระบุช่องทาง",
            detail: `${item.count || 0} บิล`,
            value: baht(item.amount),
            tone: item.method === "เงินสด" ? "good" : "neutral",
          })),
        },
        {
          title: "บิลล่าสุด",
          rows: recent.map((item) => ({
            title: `#${item.billNo || "-"}`,
            detail: `ขายเมื่อ ${item.time || "ไม่ระบุเวลา"}`,
            value: baht(item.amount),
          })),
        },
      ],
      note: `รอบนี้เปิดโดย ${report.openedBy || "ไม่ระบุ"} เมื่อ ${report.openedLabel || "ไม่ระบุเวลา"}`,
    };
  }
  if (!report.open) return {
    ...PDF_META.cash,
    summary: "วันนี้ยังไม่ได้เปิดรอบลิ้นชัก จึงยังไม่มีจำนวนธนบัตรและเหรียญให้ตรวจสอบ",
    metrics: [{ label: "ยอดในลิ้นชัก", value: "฿0", tone: "neutral" }],
    sections: [{ title: "สิ่งที่ต้องทำ", rows: [{ title: "เปิดรอบลิ้นชักและระบุจำนวนเงินตั้งต้น" }] }],
  };
  const denominations = Array.isArray(report.denominations) ? report.denominations : [];
  return {
    ...PDF_META.cash,
    summary: report.hasNegative
      ? `ระบบคำนวณเงินในลิ้นชักได้ ${baht(report.total)} แต่พบจำนวนติดลบบางชนิด ควรนับเงินจริงก่อนปิดรอบ`
      : `ตอนนี้เงินในลิ้นชักตามระบบรวม ${baht(report.total)} แยกจำนวนธนบัตรและเหรียญไว้ให้ตรวจนับง่ายแล้ว`,
    metrics: [
      { label: "ยอดรวมตามระบบ", value: baht(report.total), tone: report.hasNegative ? "danger" : "good" },
      { label: "ชนิดเงินที่มี", value: `${denominations.length} ชนิด`, tone: "neutral" },
      { label: "สถานะตรวจนับ", value: report.hasNegative ? "ควรตรวจ" : "ปกติ", tone: report.hasNegative ? "danger" : "good" },
      { label: "ผู้เปิดรอบ", value: report.openedBy || "-", tone: "neutral" },
    ],
    sections: [{
      title: "นับแบงค์และเหรียญ",
      rows: denominations.map((item) => ({
        title: item.label,
        detail: `${item.count} ใบ / เหรียญ`,
        value: baht(item.amount),
        tone: item.count < 0 ? "danger" : "neutral",
      })),
    }],
    note: report.note,
  };
}

async function signedPdfUrl(path: string, downloadName: string) {
  const signed = await supabase.storage.from(ASSISTANT_BUCKET)
    .createSignedUrl(path, 86400, { download: downloadName });
  if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("สร้างลิงก์ PDF ไม่สำเร็จ");
  return signed.data.signedUrl;
}

async function cachedPdfUrl(key: string) {
  await ensureAssistantBucket();
  const fileName = `${key}-${todayTH()}.pdf`;
  const path = `reports/${fileName}`;
  const listed = await supabase.storage.from(ASSISTANT_BUCKET).list("reports", {
    limit: 10, search: fileName,
  });
  const item = (listed.data || []).find((entry) => entry.name === fileName);
  const updatedAt = item?.updated_at || item?.created_at;
  if (!updatedAt || Date.now() - new Date(updatedAt).getTime() > 5 * 60 * 1000) return null;
  return { url: await signedPdfUrl(path, fileName), path, fileName };
}

function pdfDownloadBubble(key: string, url: string, cached: boolean) {
  const meta = PDF_META[key];
  return {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", backgroundColor: meta.accent, paddingAll: "20px", spacing: "xs",
      contents: [
        { type: "text", text: meta.title, color: "#FFFFFF", weight: "bold", size: "xl", wrap: true },
        { type: "text", text: "จัดทำเป็น PDF จากข้อมูลร้านล่าสุด", color: "#FFFFFFCC", size: "sm", wrap: true },
      ] },
    body: { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
      contents: [
        { type: "text", text: cached ? "ใช้ไฟล์ที่สร้างไว้ไม่เกิน 5 นาที เพื่อลดการดึงข้อมูลซ้ำ" : "สร้างไฟล์ใหม่เรียบร้อยแล้ว", color: "#64748B", size: "sm", wrap: true },
        { type: "button", height: "sm", style: "primary", color: meta.accent,
          action: { type: "uri", label: "เปิด / ดาวน์โหลด PDF", uri: url } },
      ] },
    footer: { type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#F8FAFC",
      contents: [{ type: "text", text: "ลิงก์มีอายุ 24 ชั่วโมง • ไม่มีหน้าเว็บคั่น", size: "xxs", color: "#94A3B8", align: "center" }] },
  };
}

async function createReportPdfBubble(key: string) {
  if (!VALID_KEYS.has(key)) throw new Error("ไม่รู้จักรายงานที่เลือก");
  const cached = await cachedPdfUrl(key);
  if (cached) return pdfDownloadBubble(key, cached.url, true);
  let bytes: Uint8Array;
  if (key === "products") {
    bytes = await createProductsRankingPdf(await loadProductsRanking(100), await getThaiFontBytes());
  } else {
    const source = key === "attendance" ? attendancePdfSource(await attendanceSnapshot())
      : key === "debt" ? await debtPdfSource()
      : key === "delivery" ? await deliveryPdfSource()
      : await cashPdfSource(key as "sales" | "cash");
    bytes = await createMinimalReportPdf(source, await getThaiFontBytes());
  }
  await ensureAssistantBucket();
  const fileName = `${key}-${todayTH()}.pdf`;
  const path = `reports/${fileName}`;
  const uploaded = await supabase.storage.from(ASSISTANT_BUCKET).upload(path,
    new Blob([bytes], { type: "application/pdf" }), {
      contentType: "application/pdf", upsert: true, cacheControl: "300",
    });
  if (uploaded.error) throw uploaded.error;
  return pdfDownloadBubble(key, await signedPdfUrl(path, fileName), false);
}

async function cashAssistantReports(selected: string[]) {
  const wanted = selected.filter((key) => key === "sales" || key === "cash");
  if (!wanted.length) return { bubbles: [], reports: {} };
  const response = await fetch(`${SUPABASE_URL}/functions/v1/line-cashdrawer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ action: "assistant-report", selected: wanted }),
  });
  if (!response.ok) throw new Error(`line-cashdrawer ${response.status}: ${await response.text()}`);
  const body = await response.json();
  return {
    bubbles: Array.isArray(body.bubbles) ? body.bubbles : [],
    reports: body.reports && typeof body.reports === "object" ? body.reports : {},
  };
}

function attendanceNotificationBubble(snapshot: Awaited<ReturnType<typeof attendanceSnapshot>>) {
  const { counts, total, working } = snapshot;
  const dateLabel = new Date(`${snapshot.today}T05:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const lateNames = snapshot.rows.filter((row) => row.status === "มาสาย" || row.status === "ครึ่งวัน");
  const awayNames = snapshot.rows.filter((row) => row.status === "ลา" || row.status === "ขาด");
  const allReady = working === total && !lateNames.length;
  const message = allReady
    ? "เช้านี้ทีมมาครบ พร้อมเริ่มงานแล้วครับ"
    : `เช็คชื่อครบแล้ว วันนี้มาทำงาน ${working} จาก ${total} คน`;
  const statusRow = (label: string, value: number, color: string) => ({
    type: "box", layout: "horizontal", margin: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#64748B", flex: 1 },
      { type: "text", text: `${value} คน`, size: "sm", color, weight: "bold", align: "end", flex: 0 },
    ],
  });
  return {
    type: "bubble", size: "mega",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#ECFDF5", paddingAll: "20px", spacing: "xs",
      contents: [
        { type: "text", text: "เช็คชื่อเช้านี้ครบแล้ว", color: "#047857", weight: "bold", size: "xl" },
        { type: "text", text: dateLabel, color: "#65A30D", size: "sm" },
      ],
    },
    body: {
      type: "box", layout: "vertical", paddingAll: "20px", spacing: "none",
      contents: [
        { type: "text", text: message, size: "md", color: "#172033", weight: "bold", wrap: true },
        { type: "text", text: `มาทำงาน ${working}/${total} คน`, size: "xxl", color: "#16A34A", weight: "bold", margin: "md" },
        { type: "separator", margin: "lg" },
        statusRow("มาตามเวลา", counts.มา, "#16A34A"),
        statusRow("มาสาย", counts.มาสาย, "#D97706"),
        statusRow("ครึ่งวัน", counts.ครึ่งวัน, "#0891B2"),
        statusRow("ลา", counts.ลา, "#7C3AED"),
        statusRow("ขาด", counts.ขาด, "#DC2626"),
        ...(lateNames.length ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "คนที่ควรรู้ไว้", size: "xs", color: "#B45309", weight: "bold", margin: "md" },
          { type: "text", text: lateNames.map((row) => `${row.name} (${row.status})`).join(", "), size: "sm", color: "#92400E", wrap: true, margin: "xs" },
        ] : []),
        ...(awayNames.length ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "วันนี้ไม่ได้มาทำงาน", size: "xs", color: "#B91C1C", weight: "bold", margin: "md" },
          { type: "text", text: awayNames.map((row) => `${row.name} (${row.status})`).join(", "), size: "sm", color: "#DC2626", wrap: true, margin: "xs" },
        ] : []),
      ],
    },
    footer: {
      type: "box", layout: "vertical", paddingAll: "12px", backgroundColor: "#F8FAFC",
      contents: [{ type: "text", text: `สรุปอัตโนมัติเมื่อเช็คชื่อครบ • ${new Date().toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
      })} น.`, size: "xxs", color: "#94A3B8", align: "center" }],
    },
  };
}

async function claimAttendanceNotification(date: string) {
  await ensureAssistantBucket();
  const path = `notifications/attendance-${date}.json`;
  const storage = supabase.storage.from(ASSISTANT_BUCKET);
  const existing = await storage.download(path);
  if (!existing.error && existing.data) {
    try {
      const marker = JSON.parse(await existing.data.text());
      const age = Date.now() - new Date(marker.createdAt || 0).getTime();
      if (marker.status === "sent" || age < 10 * 60 * 1000) return { claimed: false, path };
      await storage.remove([path]);
    } catch (_) {
      await storage.remove([path]);
    }
  }
  const createdAt = new Date().toISOString();
  const claimed = await storage.upload(path,
    new Blob([JSON.stringify({ status: "pending", createdAt })], { type: "application/json" }), {
      contentType: "application/json", upsert: false, cacheControl: "0",
    });
  if (claimed.error) {
    if (/already|duplicate|exist/i.test(claimed.error.message || "")) return { claimed: false, path };
    throw claimed.error;
  }
  return { claimed: true, path };
}

async function finishAttendanceNotification(path: string, sent: boolean) {
  const storage = supabase.storage.from(ASSISTANT_BUCKET);
  if (!sent) {
    await storage.remove([path]);
    return;
  }
  await storage.upload(path,
    new Blob([JSON.stringify({ status: "sent", createdAt: new Date().toISOString() })], { type: "application/json" }), {
      contentType: "application/json", upsert: true, cacheControl: "0",
    });
}

async function handleLineWebhook(raw: string, req: Request) {
  const signature = req.headers.get("x-line-signature") || "";
  if (!await validSignature(raw, signature)) {
    console.error("[assistant] rejected: invalid LINE signature or LINE_CHANNEL_SECRET");
    return new Response("invalid signature", { status: 401 });
  }
  const body = JSON.parse(raw);
  console.log(`[assistant] webhook accepted: ${(body.events || []).length} event(s)`);
  for (const event of (body.events || [])) {
    if (event.type !== "join" && event.type !== "message" && event.type !== "postback") continue;
    const sourceId = event.source?.groupId || event.source?.roomId || event.source?.userId || "";
    const eventText = event.type === "message" && event.message?.type === "text"
      ? String(event.message.text || "").replace(/\s+/g, "").toLowerCase()
      : "";
    const isWakeWord = WAKE_WORDS.has(eventText);
    console.log(`[assistant] event=${event.type} sourceType=${event.source?.type || "-"} source=${sourceId || "-"} text=${eventText || "-"}`);
    if (LINE_GROUP_ID && sourceId !== LINE_GROUP_ID) {
      console.warn(`[assistant] LINE_GROUP_ID mismatch: received=${sourceId || "-"} configured=${LINE_GROUP_ID}`);
      if ((isWakeWord || event.type === "join") && event.replyToken) {
        await reply(event.replyToken, [{
          type: "text",
          text: `กลุ่มนี้ยังไม่ได้รับอนุญาตครับ\n\nนำ Group ID ด้านล่างไปใส่ใน Supabase Secret ชื่อ LINE_GROUP_ID แล้วกด Save\n\n${sourceId}`,
        }]);
      }
      continue;
    }
    if (!event.replyToken) continue;
    if (event.type === "join") {
      console.log(`[assistant] joined source=${sourceId}; sending native Flex menu`);
      await reply(event.replyToken, [{
        type: "flex", altText: "เมนูลัดร้าน SK - แตะเพื่อรับรายงาน PDF", contents: menuBubble(),
      }]);
      continue;
    }
    if (event.type === "message" && event.message?.type === "text") {
      if (isWakeWord) {
        console.log("[assistant] menu requested; replying with native Flex menu");
        await reply(event.replyToken, [{
          type: "flex", altText: "เมนูลัดร้าน SK - แตะเพื่อรับรายงาน PDF", contents: menuBubble(),
        }]);
      }
      continue;
    }
    if (event.type === "postback") {
      const params = new URLSearchParams(String(event.postback?.data || ""));
      if (params.get("a") !== "assistant") continue;
      const mode = params.get("mode");
      const item = String(params.get("item") || safeSelected(params.get("selected"))[0] || "");
      if (mode === "pdf" || mode === "toggle" || mode === "run-one") {
        if (!VALID_KEYS.has(item)) continue;
        try {
          const bubble = await createReportPdfBubble(item);
          await reply(event.replyToken, [{
            type: "flex", altText: `${PDF_META[item].title} - ดาวน์โหลด PDF`, contents: bubble,
          }]);
        } catch (error) {
          console.error(`[assistant] PDF ${item} failed`, error);
          await reply(event.replyToken, [{
            type: "text",
            text: `สร้าง PDF ${PDF_META[item]?.title || item} ไม่สำเร็จครับ\n${error instanceof Error ? error.message : String(error)}`,
          }]);
        }
      }
    }
  }
  return new Response("ok", { status: 200 });
}

async function attendanceDatabaseNotification(body: Record<string, unknown>) {
  if (body.table && String(body.table) !== "เช็คชื่อ") {
    return new Response("ignored non-attendance webhook", { status: 200 });
  }
  const snapshot = await attendanceSnapshot();
  if (!snapshot.total) return new Response("no active employees", { status: 200 });
  if (!snapshot.complete) {
    return new Response(`attendance ${snapshot.checked}/${snapshot.total}; waiting`, { status: 200 });
  }
  const marker = await claimAttendanceNotification(snapshot.today);
  if (!marker.claimed) return new Response("attendance summary already sent today", { status: 200 });
  try {
    await push([{
      type: "flex",
      altText: `เช็คชื่อครบแล้ว: มาทำงาน ${snapshot.working}/${snapshot.total} คน`,
      contents: attendanceNotificationBubble(snapshot),
    }]);
    await finishAttendanceNotification(marker.path, true);
    return new Response("attendance summary sent", { status: 200 });
  } catch (error) {
    await finishAttendanceNotification(marker.path, false);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "sk-line-pdf-menu" }), {
        status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    const raw = await req.text();
    let body: Record<string, unknown> = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (Array.isArray(body.events)) return await handleLineWebhook(raw, req);
    return await attendanceDatabaseNotification(body);
  } catch (error) {
    console.error(error);
    return new Response(`error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
});
