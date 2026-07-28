// @ts-nocheck — Supabase Edge Function (Deno)
// LINE Webhook: ผู้ช่วยร้านแบบแตะดูทีละรายงานเพื่อประหยัดโควต้า
// การแจ้งเช็คชื่ออัตโนมัติถูกปิดเพื่อประหยัดโควต้า LINE — ใช้เมนูกดดูแทน
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_TOKEN = (Deno.env.get("LINE_TOKEN") || "").trim();
const LINE_GROUP_ID = (Deno.env.get("LINE_GROUP_ID") || "").trim();
const LINE_CHANNEL_SECRET = (Deno.env.get("LINE_CHANNEL_SECRET") || "").trim();
const LINE_SELECTOR_URL = (
  Deno.env.get("LINE_SELECTOR_URL") ||
  "https://sk-line-assistant.house01.chatgpt.site"
).trim();
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
const SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const enc = new TextEncoder();
const dec = new TextDecoder();
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
  "ผู้ช่วย", "เมนูผู้ช่วย", "ทดสอบผู้ช่วย",
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
const nowTime = () => new Date().toLocaleTimeString("th-TH", {
  timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
});
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
const kv = (label: string, value: string, color = "#334155", bold = false) => ({
  type: "box", layout: "horizontal", margin: "sm",
  contents: [
    { type: "text", text: label, size: "sm", color: "#64748B", flex: 1, wrap: true },
    { type: "text", text: value, size: "sm", color, align: "end", weight: bold ? "bold" : "regular", flex: 0, wrap: true },
  ],
});
const header = (title: string, subtitle: string, color: string) => ({
  type: "box", layout: "vertical", backgroundColor: color, paddingAll: "18px", spacing: "xs",
  contents: [
    { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true },
    { type: "text", text: subtitle, color: "#FFFFFFCC", size: "sm", wrap: true },
  ],
});
const footer = (text = `อัปเดต ณ ${nowTime()} น.`) => ({
  type: "box", layout: "vertical", backgroundColor: "#F8FAFC", paddingAll: "12px",
  contents: [{ type: "text", text, color: "#64748B", size: "xs", align: "center", wrap: true }],
});
function errorBubble(title: string, detail: string) {
  return {
    type: "bubble", size: "mega", header: header(`⚠️ ${title}`, "ระบบดึงข้อมูลไม่สำเร็จ", "#B91C1C"),
    body: { type: "box", layout: "vertical", paddingAll: "18px",
      contents: [{ type: "text", text: detail, color: "#64748B", size: "sm", wrap: true }] },
  };
}

async function ensureAssistantBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      if (!(data || []).some((bucket) => bucket.name === ASSISTANT_BUCKET)) {
        const created = await supabase.storage.createBucket(ASSISTANT_BUCKET, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
          allowedMimeTypes: ["application/json", "application/pdf"],
        });
        if (created.error && !/already|duplicate/i.test(created.error.message || "")) throw created.error;
      }
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  await bucketReady;
}

async function statePath(sourceId: string, userId: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${sourceId}:${userId}`));
  return `state/${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}.json`;
}

async function loadSelection(sourceId: string, userId: string) {
  await ensureAssistantBucket();
  const path = await statePath(sourceId, userId);
  const { data, error } = await supabase.storage.from(ASSISTANT_BUCKET).download(path);
  if (error) {
    if (/not.?found|does not exist|404/i.test(error.message || "")) return [];
    throw error;
  }
  try {
    const value = JSON.parse(await data.text());
    return Array.isArray(value.selected)
      ? [...new Set(value.selected.map(String).filter((key: string) => VALID_KEYS.has(key)))]
      : [];
  } catch (_) {
    return [];
  }
}

async function saveSelection(sourceId: string, userId: string, selected: string[]) {
  await ensureAssistantBucket();
  const path = await statePath(sourceId, userId);
  const body = new Blob([JSON.stringify({
    selected: [...new Set(selected.filter((key) => VALID_KEYS.has(key)))],
    updated_at: new Date().toISOString(),
  })], { type: "application/json" });
  const { error } = await supabase.storage.from(ASSISTANT_BUCKET).upload(path, body, {
    contentType: "application/json",
    upsert: true,
    cacheControl: "0",
  });
  if (error) throw error;
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

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function selectorSignature(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(LINE_CHANNEL_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(payload)),
  ));
}

async function createSelectorToken(sourceId: string, userId: string) {
  const payload = bytesToBase64Url(enc.encode(JSON.stringify({
    sourceId,
    userId,
    expiresAt: Date.now() + 15 * 60 * 1000,
  })));
  return `${payload}.${await selectorSignature(payload)}`;
}

async function readSelectorToken(token: string) {
  const [payload, received] = String(token || "").split(".");
  if (!payload || !received || !LINE_CHANNEL_SECRET) throw new Error("ลิงก์เลือกข้อมูลไม่ถูกต้อง");
  const expected = await selectorSignature(payload);
  if (expected.length !== received.length) throw new Error("ลิงก์เลือกข้อมูลไม่ถูกต้อง");
  let diff = 0;
  for (let index = 0; index < expected.length; index++) {
    diff |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }
  if (diff !== 0) throw new Error("ลิงก์เลือกข้อมูลไม่ถูกต้อง");
  const data = JSON.parse(dec.decode(base64UrlToBytes(payload)));
  if (!data.sourceId || Number(data.expiresAt || 0) < Date.now()) {
    throw new Error("ลิงก์หมดอายุ กรุณาพิมพ์ “สวัสดีผู้ช่วย” อีกครั้ง");
  }
  if (LINE_GROUP_ID && data.sourceId !== LINE_GROUP_ID) throw new Error("กลุ่ม LINE ไม่ถูกต้อง");
  return data as { sourceId: string; userId: string; expiresAt: number };
}

async function selectorUrl(sourceId: string, userId: string) {
  const token = await createSelectorToken(sourceId, userId);
  const baseUrl = LINE_SELECTOR_URL ||
    `${SUPABASE_URL}/functions/v1/line-attendance-report?assistant=select`;
  const joiner = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${joiner}token=${encodeURIComponent(token)}`;
}

function menuBubble(openUrl: string) {
  return {
    type: "bubble", size: "mega",
    header: {
      type: "box", layout: "vertical", background: {
        type: "linearGradient", angle: "135deg", startColor: "#111827", endColor: "#4338CA",
      }, paddingAll: "22px", spacing: "sm",
      contents: [
        { type: "text", text: "ผู้ช่วยร้าน SK", color: "#A5B4FC", size: "xs", weight: "bold" },
        { type: "text", text: "📊 ต้องการดูข้อมูลอะไรครับ", color: "#FFFFFF", size: "xl", weight: "bold", wrap: true },
        { type: "text", text: "เลือกหลายหัวข้อได้ แล้วรับรายงานกลับมาเพียงข้อความเดียว", color: "#E0E7FF", size: "sm", wrap: true },
      ],
    },
    body: { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
      contents: [
        { type: "box", layout: "horizontal", spacing: "md", contents: [
          { type: "text", text: "✓", size: "lg", color: "#16A34A", weight: "bold", flex: 0 },
          { type: "box", layout: "vertical", flex: 1, spacing: "xs", contents: [
            { type: "text", text: "เลือกได้หลายรายการ", color: "#0F172A", weight: "bold", size: "sm" },
            { type: "text", text: "เครื่องหมายถูกจะแสดงหลังหัวข้อที่เลือก", color: "#64748B", size: "xs", wrap: true },
          ] },
        ] },
        { type: "separator" },
        { type: "text", text: OPTIONS.map((option) => `${option.icon}  ${option.title}`).join("\n"),
          color: "#334155", size: "sm", wrap: true, lineSpacing: "8px" },
      ] },
    footer: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "sm", backgroundColor: "#F8FAFC",
      contents: [
        { type: "button", height: "sm", style: "primary", color: "#4F46E5",
          action: { type: "uri", label: "เลือกหัวข้อรายงาน", uri: openUrl } },
        { type: "text", text: "ไม่มีข้อความเด้งระหว่างเลือก • ส่งผลลัพธ์ครั้งเดียว", size: "xxs", color: "#64748B", align: "center" },
      ] },
  };
}

async function attendanceBubble() {
  const today = todayTH();
  const [{ data: employees, error: employeeError }, { data: attendance, error: attendanceError }] = await Promise.all([
    supabase.from("พนักงาน").select("id,name,lastname,status").eq("status", "ทำงาน").order("name"),
    supabase.from("เช็คชื่อ").select("employee_id,status,time_in,time_out").eq("date", today),
  ]);
  if (employeeError) throw employeeError;
  if (attendanceError) throw attendanceError;
  const map = new Map((attendance || []).map((row) => [String(row.employee_id), row]));
  const counts: Record<string, number> = { มา: 0, มาสาย: 0, ครึ่งวัน: 0, ลา: 0, ขาด: 0 };
  const pending: string[] = [];
  const absent: string[] = [];
  for (const employee of (employees || [])) {
    const row = map.get(String(employee.id));
    if (!row) {
      pending.push(`${employee.name || ""} ${employee.lastname || ""}`.trim());
      continue;
    }
    const status = normStatus(String(row.status || ""));
    if (counts[status] !== undefined) counts[status]++;
    if (status === "ลา" || status === "ขาด") absent.push(`${employee.name} (${status})`);
  }
  const total = (employees || []).length;
  const complete = total > 0 && pending.length === 0;
  const statusText = !attendance?.length
    ? "ยังไม่มีการอัปเดตเช็คชื่อวันนี้"
    : complete ? "อัปเดตครบทุกคนแล้ว" : `ยังไม่อัปเดต ${pending.length} คน`;
  const rows = [
    ["✓ มาทำงาน", counts.มา, "#16A34A"], ["▲ มาสาย", counts.มาสาย, "#D97706"],
    ["◐ ครึ่งวัน", counts.ครึ่งวัน, "#0891B2"], ["○ ลา", counts.ลา, "#7C3AED"],
    ["✗ ขาด", counts.ขาด, "#DC2626"],
  ];
  return {
    type: "bubble", size: "mega",
    header: header("🪪 เช็คชื่อวันนี้", statusText, complete ? "#16A34A" : "#D97706"),
    body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
      contents: [
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: "ลงสถานะแล้ว", size: "sm", color: "#64748B", flex: 0 },
          { type: "text", text: `${map.size}/${total} คน`, size: "xxl", color: complete ? "#16A34A" : "#D97706", weight: "bold", align: "end" },
        ] },
        { type: "separator", margin: "lg" },
        ...rows.map(([label, count, color]) => kv(String(label), `${count} คน`, String(color), true)),
        ...(pending.length ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "⏳ ผู้ที่ยังไม่มีข้อมูล", size: "xs", color: "#B45309", weight: "bold", margin: "md" },
          { type: "text", text: pending.join(", "), size: "sm", color: "#92400E", wrap: true, margin: "xs" },
        ] : []),
        ...(absent.length ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "ไม่ได้มาทำงาน", size: "xs", color: "#B91C1C", weight: "bold", margin: "md" },
          { type: "text", text: absent.join(", "), size: "sm", color: "#DC2626", wrap: true, margin: "xs" },
        ] : []),
      ] },
    footer: footer(),
  };
}

async function debtBubble() {
  const { data, error } = await supabase.from("customer")
    .select("id,name,phone,debt_amount,credit_limit").gt("debt_amount", 0)
    .order("debt_amount", { ascending: false }).limit(500);
  if (error) throw error;
  // เมื่อบันทึกเป็นหนี้เสีย ระบบหลักจะย้ายยอดออกจาก customer.debt_amount แล้ว
  const customers = (data || []).filter((customer) => Number(customer.debt_amount || 0) > 0.009);
  const total = customers.reduce((sum, customer) => sum + Number(customer.debt_amount || 0), 0);
  const shown = customers.slice(0, 6);
  return {
    type: "bubble", size: "mega",
    header: header("👥 ลูกค้าค้างชำระ", "ยอดลูกหนี้ปัจจุบัน ไม่รวมทะเบียนหนี้เสีย", "#B91C1C"),
    body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
      contents: [
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: `${customers.length} ราย`, size: "sm", color: "#64748B", flex: 0 },
          { type: "text", text: baht(total), size: "xxl", color: "#B91C1C", weight: "bold", align: "end" },
        ] },
        { type: "separator", margin: "lg" },
        { type: "text", text: customers.length > shown.length ? `ยอดสูงสุด ${shown.length} รายจากทั้งหมด` : "รายละเอียดลูกหนี้",
          size: "xs", color: "#94A3B8", weight: "bold", margin: "md" },
        ...(shown.length ? shown.map((customer, index) =>
          kv(`${index + 1}. ${customer.name || "-"}${customer.phone ? ` · ${customer.phone}` : ""}`,
            baht(customer.debt_amount), "#B91C1C", true))
          : [{ type: "text", text: "ไม่มีลูกค้าค้างชำระ", size: "sm", color: "#16A34A", margin: "sm" }]),
      ] },
    footer: footer(customers.length > shown.length
      ? `แสดง ${shown.length}/${customers.length} ราย · อัปเดต ${nowTime()} น.`
      : `อัปเดต ณ ${nowTime()} น.`),
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
async function deliveryBubble() {
  const data = await fetchPaged(() => supabase.from("บิลขาย")
    .select("id,bill_no,date,total,method,status,customer_name,delivery_mode,delivery_status,delivery_date,delivery_phone,delivery_address,deposit_amount,received,change,return_info")
    .order("delivery_date", { ascending: true }), 20000);
  const pending = data.map((bill) => ({ bill, state: deliveryState(bill) }))
    .filter((row) => !["cancel", "done", "self"].includes(row.state));
  const priority: Record<string, number> = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3 };
  pending.sort((a, b) => priority[a.state] - priority[b.state]);
  const shown = pending.slice(0, 5);
  const counts = {
    overdue: pending.filter((row) => row.state === "overdue").length,
    today: pending.filter((row) => row.state === "today").length,
    upcoming: pending.filter((row) => row.state === "upcoming").length,
    unscheduled: pending.filter((row) => row.state === "unscheduled").length,
  };
  const stateLabel: Record<string, string> = {
    overdue: "⚠️ เกินกำหนด", today: "🚚 ส่งวันนี้", upcoming: "📅 งานถัดไป", unscheduled: "❔ ยังไม่กำหนดวัน",
  };
  return {
    type: "bubble", size: "mega",
    header: header("🚚 รายการขนส่ง", `${pending.length} งานที่ยังไม่เสร็จ`, "#C2410C"),
    body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
      contents: [
        kv("⚠️ เกินกำหนด", `${counts.overdue} งาน`, counts.overdue ? "#DC2626" : "#64748B", true),
        kv("🚚 ต้องส่งวันนี้", `${counts.today} งาน`, counts.today ? "#EA580C" : "#64748B", true),
        kv("📅 งานถัดไป", `${counts.upcoming} งาน`, "#2563EB", true),
        kv("❔ ยังไม่กำหนดวัน", `${counts.unscheduled} งาน`, "#D97706", true),
        { type: "separator", margin: "lg" },
        { type: "text", text: pending.length > shown.length ? `คิวเร่งด่วน ${shown.length} งานแรก` : "รายละเอียดคิว",
          size: "xs", color: "#94A3B8", weight: "bold", margin: "md" },
        ...(shown.length ? shown.flatMap(({ bill, state }) => [
          { type: "box", layout: "vertical", margin: "md", spacing: "xs",
            contents: [
              { type: "text", text: `${stateLabel[state]} · #${bill.bill_no || String(bill.id).slice(0, 8)}`,
                color: state === "overdue" ? "#B91C1C" : "#0F172A", size: "sm", weight: "bold", wrap: true },
              { type: "text", text: `${bill.customer_name || "ลูกค้าทั่วไป"} · ${bill.delivery_date ? thDate(bill.delivery_date) : "ไม่ระบุวัน"}${billRemaining(bill) ? ` · เก็บ ${baht(billRemaining(bill))}` : " · ชำระครบ"}`,
                color: "#64748B", size: "xs", wrap: true },
            ] },
        ]) : [{ type: "text", text: "ไม่มีงานจัดส่งค้างอยู่", color: "#16A34A", size: "sm", margin: "sm" }]),
      ] },
    footer: footer(pending.length > shown.length
      ? `แสดง ${shown.length}/${pending.length} งาน · อัปเดต ${nowTime()} น.`
      : `อัปเดต ณ ${nowTime()} น.`),
  };
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

function fitPdfText(font: unknown, value: string, size: number, maxWidth: number) {
  const text = String(value || "-");
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && font.widthOfTextAtSize(chars.join("") + "…", size) > maxWidth) chars.pop();
  return chars.join("") + "…";
}

async function createProductsPdf(report: Awaited<ReturnType<typeof loadProductsRanking>>) {
  // โหลดชุดสร้าง PDF เฉพาะเมื่อผู้ใช้ขอรายงานสินค้าขายดี
  // เพื่อให้คำทัก "ผู้ช่วย" และรายงานทั่วไปตอบกลับได้เร็วขึ้นมาก
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import("https://esm.sh/pdf-lib@1.17.1"),
    import("https://esm.sh/@pdf-lib/fontkit@1.1.1"),
  ]);
  const fontkit = fontkitModule.default;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getThaiFontBytes(), { subset: true });
  pdf.setTitle("รายงานสินค้าขายดี 30 วัน");
  pdf.setAuthor("ผู้ช่วยร้าน");
  pdf.setSubject("จัดอันดับตามยอดขายเป็นจำนวนเงิน");
  pdf.setCreationDate(new Date());

  const navy = rgb(0.07, 0.13, 0.27);
  const indigo = rgb(0.31, 0.27, 0.90);
  const violet = rgb(0.49, 0.23, 0.93);
  const slate = rgb(0.28, 0.34, 0.43);
  const muted = rgb(0.58, 0.64, 0.72);
  const line = rgb(0.89, 0.91, 0.94);
  const soft = rgb(0.96, 0.97, 0.99);
  const white = rgb(1, 1, 1);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const rowsPerPage = 22;
  const pages = Math.max(1, Math.ceil(report.top.length / rowsPerPage));
  const period = `${thDate(report.start)} – ${thDate(report.end)}`;

  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: pageHeight - 126, width: pageWidth, height: 126, color: navy });
    page.drawRectangle({ x: 0, y: pageHeight - 126, width: 8, height: 126, color: violet });
    page.drawText("รายงานสินค้าขายดี 30 วัน", {
      x: 34, y: pageHeight - 52, size: 22, font, color: white,
    });
    page.drawText("จัดอันดับตามยอดขายเป็นจำนวนเงิน", {
      x: 35, y: pageHeight - 79, size: 10.5, font, color: rgb(0.78, 0.81, 0.98),
    });
    page.drawText(`ช่วงข้อมูล ${period}`, {
      x: 35, y: pageHeight - 101, size: 9.5, font, color: rgb(0.65, 0.70, 0.82),
    });
    page.drawText(`ยอดรวม ${baht(report.totalAmount)}`, {
      x: 380, y: pageHeight - 53, size: 15, font, color: white,
    });
    page.drawText(`${report.billCount.toLocaleString("th-TH")} บิล · ${report.productCount.toLocaleString("th-TH")} สินค้า`, {
      x: 380, y: pageHeight - 78, size: 9.5, font, color: rgb(0.78, 0.81, 0.98),
    });

    const tableTop = pageHeight - 155;
    page.drawRectangle({ x: 28, y: tableTop - 28, width: pageWidth - 56, height: 28, color: indigo });
    page.drawText("อันดับ", { x: 40, y: tableTop - 19, size: 9, font, color: white });
    page.drawText("สินค้า", { x: 88, y: tableTop - 19, size: 9, font, color: white });
    page.drawText("จำนวนขาย", { x: 372, y: tableTop - 19, size: 9, font, color: white });
    page.drawText("ยอดขาย", { x: 482, y: tableTop - 19, size: 9, font, color: white });

    const rows = report.top.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    rows.forEach((item, rowIndex) => {
      const rank = pageIndex * rowsPerPage + rowIndex + 1;
      const y = tableTop - 28 - (rowIndex + 1) * 27;
      if (rowIndex % 2 === 0) {
        page.drawRectangle({ x: 28, y, width: pageWidth - 56, height: 27, color: soft });
      }
      page.drawLine({ start: { x: 28, y }, end: { x: pageWidth - 28, y }, thickness: 0.5, color: line });
      page.drawText(String(rank), { x: 48, y: y + 9, size: 9.5, font, color: rank <= 3 ? violet : slate });
      page.drawText(fitPdfText(font, item.name, 9.5, 265), {
        x: 88, y: y + 9, size: 9.5, font, color: navy,
      });
      page.drawText(fitPdfText(font, `${number(item.qty)} ${item.unit}`, 9, 88), {
        x: 372, y: y + 9, size: 9, font, color: slate,
      });
      const amount = baht(item.amount);
      page.drawText(amount, {
        x: pageWidth - 38 - font.widthOfTextAtSize(amount, 9.5), y: y + 9,
        size: 9.5, font, color: violet,
      });
    });

    page.drawText("ไม่รวมบิลยกเลิก คืนสินค้า หนี้เสีย และรายการตัดหนี้", {
      x: 29, y: 27, size: 8.5, font, color: muted,
    });
    const pageText = `หน้า ${pageIndex + 1} / ${pages}`;
    page.drawText(pageText, {
      x: pageWidth - 29 - font.widthOfTextAtSize(pageText, 8.5), y: 27,
      size: 8.5, font, color: muted,
    });
  }
  return await pdf.save();
}

async function productsPdfBubble() {
  const report = await loadProductsRanking(100);
  const pdfBytes = await createProductsPdf(report);
  await ensureAssistantBucket();
  const path = `reports/best-sellers-${todayTH()}.pdf`;
  const uploaded = await supabase.storage.from(ASSISTANT_BUCKET).upload(
    path,
    new Blob([pdfBytes], { type: "application/pdf" }),
    { contentType: "application/pdf", upsert: true, cacheControl: "300" },
  );
  if (uploaded.error) throw uploaded.error;
  const signed = await supabase.storage.from(ASSISTANT_BUCKET)
    .createSignedUrl(path, 7 * 86400, { download: `best-sellers-${todayTH()}.pdf` });
  if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("สร้างลิงก์ PDF ไม่สำเร็จ");

  return {
    type: "bubble", size: "mega",
    header: {
      type: "box", layout: "vertical",
      background: { type: "linearGradient", angle: "135deg", startColor: "#312E81", endColor: "#7C3AED" },
      paddingAll: "20px", spacing: "xs",
      contents: [
        { type: "text", text: "🏆 สินค้าขายดี 30 วัน", color: "#FFFFFF", weight: "bold", size: "xl" },
        { type: "text", text: "รายงาน PDF จัดอันดับตามยอดขาย", color: "#DDD6FE", size: "sm" },
      ],
    },
    body: { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md",
      contents: [
        { type: "text", text: baht(report.totalAmount), color: "#6D28D9", weight: "bold", size: "xxl", align: "center" },
        { type: "text", text: `ยอดขายรวม · ${report.billCount.toLocaleString("th-TH")} บิล`,
          color: "#64748B", size: "sm", align: "center" },
        { type: "separator", margin: "sm" },
        { type: "box", layout: "horizontal", spacing: "sm", contents: [
          { type: "box", layout: "vertical", flex: 1, backgroundColor: "#F5F3FF", cornerRadius: "12px", paddingAll: "12px",
            contents: [
              { type: "text", text: `${report.top.length}`, color: "#7C3AED", weight: "bold", size: "xl", align: "center" },
              { type: "text", text: "อันดับใน PDF", color: "#64748B", size: "xs", align: "center" },
            ] },
          { type: "box", layout: "vertical", flex: 1, backgroundColor: "#EFF6FF", cornerRadius: "12px", paddingAll: "12px",
            contents: [
              { type: "text", text: number(report.totalQty), color: "#2563EB", weight: "bold", size: "xl", align: "center" },
              { type: "text", text: "หน่วยที่ขาย", color: "#64748B", size: "xs", align: "center" },
            ] },
        ] },
      ] },
    footer: { type: "box", layout: "vertical", paddingAll: "16px", spacing: "sm",
      contents: [
        { type: "button", height: "sm", style: "primary", color: "#7C3AED",
          action: { type: "uri", label: "เปิด / ดาวน์โหลด PDF", uri: signed.data.signedUrl } },
        { type: "text", text: "ลิงก์มีอายุ 7 วัน · สร้างจากข้อมูลล่าสุด", size: "xxs", color: "#94A3B8", align: "center" },
      ] },
  };
}

async function cashBubbles(selected: string[]) {
  const wanted = selected.filter((key) => key === "sales" || key === "cash");
  if (!wanted.length) return [];
  const response = await fetch(`${SUPABASE_URL}/functions/v1/line-cashdrawer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ action: "assistant-report", selected: wanted }),
  });
  if (!response.ok) throw new Error(`line-cashdrawer ${response.status}: ${await response.text()}`);
  const body = await response.json();
  return Array.isArray(body.bubbles) ? body.bubbles : [];
}

async function buildReports(selected: string[]) {
  const tasks = selected.map(async (key) => {
    try {
      if (key === "attendance") return await attendanceBubble();
      if (key === "debt") return await debtBubble();
      if (key === "delivery") return await deliveryBubble();
      if (key === "products") return await productsPdfBubble();
      if (key === "sales" || key === "cash") return null;
      return null;
    } catch (error) {
      const option = OPTIONS.find((item) => item.key === key);
      return errorBubble(`โหลด ${option?.title || key} ไม่สำเร็จ`,
        error instanceof Error ? error.message : String(error));
    }
  });
  const [local, cash] = await Promise.all([
    Promise.all(tasks),
    cashBubbles(selected).catch((error) => selected.filter((key) => key === "sales" || key === "cash")
      .map((key) => errorBubble(`โหลด ${OPTIONS.find((item) => item.key === key)?.title} ไม่สำเร็จ`,
        error instanceof Error ? error.message : String(error)))),
  ]);
  const cashByKey = new Map<string, unknown>();
  selected.filter((key) => key === "sales" || key === "cash").forEach((key, index) => cashByKey.set(key, cash[index]));
  return selected.map((key, index) => (key === "sales" || key === "cash") ? cashByKey.get(key) : local[index]).filter(Boolean);
}

function selectorPage(token: string) {
  const cards = OPTIONS.map((option) => `
    <label class="pick">
      <input type="checkbox" name="report" value="${option.key}">
      <span class="pick-card">
        <span class="pick-icon">${option.icon}</span>
        <span class="pick-copy">
          <strong>${option.no}. ${option.title}<i class="selected-mark">✓</i></strong>
          <small>${option.hint}</small>
        </span>
        <span class="check"><i>✓</i></span>
      </span>
    </label>`).join("");
  const safeToken = String(token || "").replace(/[<>&"']/g, "");
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#312E81">
  <title>เลือกข้อมูลจากผู้ช่วยร้าน</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&display=swap');
    :root{color-scheme:light;--primary:#4f46e5;--primary-dark:#312e81;--ink:#101828;--muted:#667085;--line:#e4e7ec}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Prompt,system-ui,sans-serif;color:var(--ink);
      background:radial-gradient(circle at 100% 0,#c7d2fe 0,transparent 33%),linear-gradient(180deg,#eef2ff 0,#f8fafc 46%,#fff 100%)}
    .shell{width:min(100%,560px);margin:auto;padding:18px 14px calc(30px + env(safe-area-inset-bottom))}
    .hero{position:relative;overflow:hidden;border-radius:26px;padding:24px 22px;color:#fff;
      background:linear-gradient(135deg,#111827 0,#312e81 55%,#4f46e5 100%);box-shadow:0 20px 45px rgba(49,46,129,.22)}
    .hero:after{content:"";position:absolute;width:190px;height:190px;border:35px solid rgba(255,255,255,.07);border-radius:50%;right:-75px;top:-90px}
    .eyebrow{position:relative;z-index:1;font-size:11px;font-weight:800;letter-spacing:.12em;color:#c7d2fe}
    h1{position:relative;z-index:1;margin:8px 0 6px;font-size:24px;line-height:1.35} .hero p{position:relative;z-index:1;margin:0;color:#e0e7ff;font-size:13px;line-height:1.7}
    .summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 4px 11px}
    .summary strong{font-size:15px}.summary span{font-size:11px;font-weight:700;color:#4338ca;background:#eef2ff;border-radius:999px;padding:7px 11px}
    .list{display:grid;gap:10px}.pick{display:block;cursor:pointer;-webkit-tap-highlight-color:transparent}.pick input{position:absolute;opacity:0;pointer-events:none}
    .pick-card{display:grid;grid-template-columns:50px minmax(0,1fr) 30px;align-items:center;gap:12px;padding:14px;
      border:1.5px solid var(--line);border-radius:18px;background:rgba(255,255,255,.94);box-shadow:0 5px 16px rgba(16,24,40,.045);transition:.17s ease}
    .pick-card:active{transform:scale(.985)}.pick-icon{width:50px;height:50px;display:grid;place-items:center;border-radius:15px;background:#f2f4f7;font-size:24px}
    .pick-copy{min-width:0}.pick-copy strong{display:flex;align-items:center;gap:7px;font-size:14px;line-height:1.35}.pick-copy small{display:block;margin-top:4px;color:#98a2b3;font-size:10.5px;line-height:1.5}
    .selected-mark{display:none;color:#16a34a;font-size:15px;font-style:normal}.check{width:26px;height:26px;display:grid;place-items:center;border:2px solid #d0d5dd;border-radius:50%;color:transparent;transition:.17s}
    .check i{font-style:normal;font-size:14px;font-weight:900}.pick input:checked+.pick-card{border-color:#6366f1;background:#f5f3ff;box-shadow:0 8px 22px rgba(79,70,229,.13)}
    .pick input:checked+.pick-card .pick-icon{background:#e0e7ff}.pick input:checked+.pick-card .selected-mark{display:inline}.pick input:checked+.pick-card .check{border-color:#16a34a;background:#16a34a;color:#fff}
    .action-wrap{position:sticky;bottom:0;margin-top:14px;padding-top:12px;background:linear-gradient(180deg,transparent,#fff 28%)}
    .submit{display:none;width:100%;height:56px;border:0;border-radius:17px;color:#fff;font:800 15px Prompt,sans-serif;cursor:pointer;
      background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 14px 28px rgba(79,70,229,.27)}.submit.show{display:block}.submit:disabled{opacity:.7}
    .help{text-align:center;color:#98a2b3;font-size:10.5px;margin:9px 0 0}.status{display:none;text-align:center;padding:42px 22px;border-radius:24px;background:#fff;box-shadow:0 16px 40px rgba(16,24,40,.08)}
    .status.show{display:block}.status .done{width:68px;height:68px;display:grid;place-items:center;margin:0 auto 15px;border-radius:50%;background:#dcfce7;color:#16a34a;font-size:34px;font-weight:900}
    .status h2{margin:0;font-size:20px}.status p{color:var(--muted);font-size:12px;line-height:1.7}.error{color:#b42318!important}
    @media(max-width:380px){.shell{padding-left:10px;padding-right:10px}.hero{padding:21px 18px}.pick-card{grid-template-columns:45px minmax(0,1fr) 27px;padding:12px}.pick-icon{width:45px;height:45px}}
  </style>
</head>
<body>
  <main class="shell">
    <section id="picker">
      <header class="hero">
        <div class="eyebrow">SK STORE ASSISTANT</div>
        <h1>เลือกข้อมูลที่ต้องการดู</h1>
        <p>เลือกได้หลายหัวข้อ ระบบจะส่งรายงานกลับเข้า LINE เพียงข้อความเดียว</p>
      </header>
      <div class="summary"><strong>รายการรายงาน</strong><span id="count">ยังไม่ได้เลือก</span></div>
      <div class="list">${cards}</div>
      <div class="action-wrap">
        <button id="submit" class="submit" type="button">แสดงรายงานที่เลือก <span id="button-count"></span></button>
        <p class="help">ปุ่มจะแสดงเมื่อเลือกอย่างน้อย 1 รายการ</p>
      </div>
    </section>
    <section id="status" class="status">
      <div class="done">✓</div>
      <h2>ส่งรายงานเข้า LINE แล้ว</h2>
      <p>กลับไปที่ห้องแชตเพื่อดูข้อมูลได้เลยครับ</p>
    </section>
  </main>
  <script>
    const token=${JSON.stringify(safeToken)};
    const inputs=[...document.querySelectorAll('input[name="report"]')];
    const button=document.getElementById('submit');
    const count=document.getElementById('count');
    const buttonCount=document.getElementById('button-count');
    function selected(){return inputs.filter(input=>input.checked).map(input=>input.value)}
    function update(){
      const total=selected().length;
      count.textContent=total?('เลือกแล้ว '+total+' รายการ'):'ยังไม่ได้เลือก';
      buttonCount.textContent=total?('('+total+')'):'';
      button.classList.toggle('show',total>0);
    }
    inputs.forEach(input=>input.addEventListener('change',update));
    button.addEventListener('click',async()=>{
      const reports=selected(); if(!reports.length)return;
      button.disabled=true; button.textContent='กำลังจัดทำรายงาน...';
      try{
        const response=await fetch(location.pathname+'?assistant=run',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({token,selected:reports})
        });
        const result=await response.json();
        if(!response.ok||!result.ok)throw new Error(result.error||'ส่งรายงานไม่สำเร็จ');
        document.getElementById('picker').style.display='none';
        document.getElementById('status').classList.add('show');
      }catch(error){
        button.disabled=false; button.innerHTML='ลองส่งรายงานอีกครั้ง';
        const help=document.querySelector('.help');
        help.textContent=error.message||String(error); help.classList.add('error');
      }
    });
    update();
  </script>
</body>
</html>`;
}

async function openSelector(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  try {
    await readSelectorToken(token);
    return new Response(selectorPage(token), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;text-align:center;padding:60px 20px"><h2>เปิดตัวเลือกรายงานไม่ได้</h2><p>${message}</p></body>`, {
      status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}

async function runSelector(req: Request) {
  try {
    const body = await req.json();
    await readSelectorToken(String(body?.token || ""));
    const selected = Array.isArray(body?.selected)
      ? [...new Set(body.selected.map(String).filter((key: string) => VALID_KEYS.has(key)))]
      : [];
    if (!selected.length) throw new Error("กรุณาเลือกรายงานอย่างน้อย 1 รายการ");
    selected.sort((a, b) => OPTIONS.findIndex((option) => option.key === a)
      - OPTIONS.findIndex((option) => option.key === b));
    const bubbles = await buildReports(selected);
    if (!bubbles.length) throw new Error("ไม่พบรายงานที่ส่งได้");
    await push([{
      type: "flex",
      altText: `รายงานผู้ช่วยร้าน ${selected.length} รายการ`,
      contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
    }]);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false, error: error instanceof Error ? error.message : String(error),
    }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
  }
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
    if (event.type !== "message" && event.type !== "postback") continue;
    const sourceId = event.source?.groupId || event.source?.roomId || event.source?.userId || "";
    const eventText = event.type === "message" && event.message?.type === "text"
      ? String(event.message.text || "").replace(/\s+/g, "").toLowerCase()
      : "";
    const isWakeWord = WAKE_WORDS.has(eventText);
    console.log(`[assistant] event=${event.type} sourceType=${event.source?.type || "-"} source=${sourceId || "-"} text=${eventText || "-"}`);
    if (LINE_GROUP_ID && sourceId !== LINE_GROUP_ID) {
      console.warn(`[assistant] LINE_GROUP_ID mismatch: received=${sourceId || "-"} configured=${LINE_GROUP_ID}`);
      if (isWakeWord && event.replyToken) {
        await reply(event.replyToken, [{
          type: "text",
          text: `กลุ่มนี้ยังไม่ได้รับอนุญาตครับ\n\nนำ Group ID ด้านล่างไปใส่ใน Supabase Secret ชื่อ LINE_GROUP_ID แล้วกด Save\n\n${sourceId}`,
        }]);
      }
      continue;
    }
    if (!event.replyToken) continue;
    const userId = event.source?.userId || "group";
    if (event.type === "message" && event.message?.type === "text") {
      if (isWakeWord) {
        console.log("[assistant] wake word matched; replying with selector menu");
        const openUrl = await selectorUrl(sourceId, userId);
        try {
          await reply(event.replyToken, [{
            type: "flex", altText: "สวัสดีครับ เลือกรายงานได้หลายหัวข้อ", contents: menuBubble(openUrl),
          }]);
          console.log("[assistant] selector menu replied successfully");
        } catch (flexError) {
          console.error("[assistant] Flex reply failed; trying text fallback", flexError);
          await reply(event.replyToken, [{
            type: "text",
            text: `สวัสดีครับ เลือกรายงานได้จากลิงก์นี้\n${openUrl}`,
          }]);
          console.log("[assistant] text fallback replied successfully");
        }
      }
      continue;
    }
    if (event.type === "postback") {
      const params = new URLSearchParams(String(event.postback?.data || ""));
      if (params.get("a") !== "assistant") continue;
      const mode = params.get("mode");
      let selected = safeSelected(params.get("selected"));
      if (mode === "toggle-state") {
        const item = String(params.get("item") || "");
        if (!VALID_KEYS.has(item)) continue;
        selected = await loadSelection(sourceId, userId);
        // เพิ่มอย่างเดียวเพื่อให้ข้อความ displayText ตรงกับสถานะจริง
        // หากต้องการเริ่มใหม่ให้ใช้ปุ่ม "ล้างตัวเลือก"
        if (!selected.includes(item)) selected.push(item);
        selected.sort((a, b) => OPTIONS.findIndex((option) => option.key === a)
          - OPTIONS.findIndex((option) => option.key === b));
        await saveSelection(sourceId, userId, selected);
        // จงใจไม่ reply: เมนูเดิมอยู่ใบเดียวและไม่ใช้โควต้าข้อความเพิ่ม
        continue;
      }
      if (mode === "clear-state" || mode === "clear") {
        await saveSelection(sourceId, userId, []);
        // ล้างเงียบ ๆ โดยไม่ส่งข้อความ "ล้างแล้ว"
        continue;
      }
      if (mode === "run-state") {
        selected = await loadSelection(sourceId, userId);
      }
      // รองรับปุ่มจากเมนูเวอร์ชันเก่า: แตะตัวเลือกแล้วเปิดรายงานนั้นทันที
      if (mode === "toggle") {
        const item = String(params.get("item") || "");
        selected = VALID_KEYS.has(item) ? [item] : [];
      }
      if (mode === "run-state" || mode === "run" || mode === "run-one" || mode === "toggle") {
        if (!selected.length) {
          await reply(event.replyToken, [{
            type: "text", text: "ยังไม่ได้เลือกรายงานครับ แตะหัวข้อที่ต้องการแล้วกดดูรายงานอีกครั้ง",
          }]);
        } else {
          await saveSelection(sourceId, userId, []);
          const bubbles = await buildReports(selected);
          await reply(event.replyToken, [{
            type: "flex", altText: `รายงานผู้ช่วยร้าน ${selected.length} รายการ`,
            contents: bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles },
          }]);
        }
      }
    }
  }
  return new Response("ok", { status: 200 });
}

async function attendanceDatabaseNotification() {
  // รองรับ Database Webhook เดิมโดยตอบสำเร็จ แต่ไม่ส่ง LINE อัตโนมัติ
  // ผู้ใช้ดูข้อมูลล่าสุดได้จาก "สวัดดีผู้ช่วย" > เช็คชื่อวันนี้
  return new Response("automatic attendance push disabled; use assistant menu", { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const assistantMode = new URL(req.url).searchParams.get("assistant");
    if (req.method === "GET" && assistantMode === "select") return await openSelector(req);
    if (req.method === "POST" && assistantMode === "run") return await runSelector(req);
    const raw = await req.text();
    let body: Record<string, unknown> = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch (_) {}
    if (Array.isArray(body.events)) return await handleLineWebhook(raw, req);
    return await attendanceDatabaseNotification();
  } catch (error) {
    console.error(error);
    return new Response(`error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
});
