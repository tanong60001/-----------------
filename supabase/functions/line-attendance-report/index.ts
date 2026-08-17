// @ts-nocheck — Supabase Edge Function (Deno)
// LINE Webhook: ผู้ช่วยร้านแบบแตะดูทีละรายงานเพื่อประหยัดโควต้า
// การแจ้งเช็คชื่ออัตโนมัติถูกปิดเพื่อประหยัดโควต้า LINE — ใช้เมนูกดดูแทน
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      if (!(data || []).some((bucket) => bucket.name === ASSISTANT_BUCKET)) {
        const created = await supabase.storage.createBucket(ASSISTANT_BUCKET, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
          allowedMimeTypes: ["application/pdf"],
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

function fitPdfText(font: unknown, value: string, size: number, maxWidth: number) {
  const text = String(value || "-");
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && font.widthOfTextAtSize(chars.join("") + "…", size) > maxWidth) chars.pop();
  return chars.join("") + "…";
}

const PDF_META: Record<string, { title: string; subtitle: string; accent: string }> = {
  attendance: { title: "เช็คชื่อวันนี้", subtitle: "สถานะพนักงานและเวลาลงงาน", accent: "#16A34A" },
  sales: { title: "ยอดขายวันนี้", subtitle: "ยอดขายตั้งแต่เปิดรอบและวิธีชำระ", accent: "#3B82F6" },
  cash: { title: "จำนวนเงินในลิ้นชัก", subtitle: "ธนบัตร เหรียญ และยอดรวมตามระบบ", accent: "#059669" },
  debt: { title: "ลูกค้าค้างชำระทั้งหมด", subtitle: "ยอดลูกหนี้ปัจจุบัน ไม่รวมทะเบียนหนี้เสีย", accent: "#8B5CF6" },
  delivery: { title: "รายการขนส่ง", subtitle: "งานค้าง ส่งวันนี้ เกินกำหนด และยอดเก็บ", accent: "#F97316" },
  products: { title: "สินค้าขายดี 30 วัน", subtitle: "จัดอันดับตามยอดขายเป็นจำนวนเงิน", accent: "#D97706" },
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

const pdfClock = (value: unknown) => value
  ? new Date(String(value)).toLocaleTimeString("th-TH", {
      timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
    })
  : "-";

async function attendancePdfSource() {
  const today = todayTH();
  const [{ data: employees, error: employeeError }, { data: attendance, error: attendanceError }] = await Promise.all([
    supabase.from("พนักงาน").select("id,name,lastname,status").eq("status", "ทำงาน").order("name"),
    supabase.from("เช็คชื่อ").select("employee_id,status,time_in,time_out").eq("date", today),
  ]);
  if (employeeError) throw employeeError;
  if (attendanceError) throw attendanceError;
  const byEmployee = new Map((attendance || []).map((row) => [String(row.employee_id), row]));
  const rows = (employees || []).map((employee, index) => {
    const attendanceRow = byEmployee.get(String(employee.id));
    const status = attendanceRow ? normStatus(String(attendanceRow.status || "ไม่ระบุ")) : "ยังไม่อัปเดต";
    return `${index + 1}. ${employee.name || "-"} ${employee.lastname || ""} | ${status} | เข้า ${pdfClock(attendanceRow?.time_in)} | ออก ${pdfClock(attendanceRow?.time_out)}`;
  });
  rows.unshift(`ลงสถานะแล้ว ${byEmployee.size}/${(employees || []).length} คน`);
  return { ...PDF_META.attendance, rows };
}

async function debtPdfSource() {
  const { data, error } = await supabase.from("customer")
    .select("id,name,phone,debt_amount,credit_limit").gt("debt_amount", 0)
    .order("debt_amount", { ascending: false }).limit(500);
  if (error) throw error;
  const customers = (data || []).filter((customer) => Number(customer.debt_amount || 0) > 0.009);
  const total = customers.reduce((sum, customer) => sum + Number(customer.debt_amount || 0), 0);
  const rows = customers.map((customer, index) =>
    `${index + 1}. ${customer.name || "-"}${customer.phone ? ` | ${customer.phone}` : ""} | ${baht(customer.debt_amount)}`);
  rows.unshift(`ลูกหนี้ ${customers.length} ราย | ยอดรวม ${baht(total)}`);
  if (!customers.length) rows.push("ไม่มีลูกค้าค้างชำระ");
  return { ...PDF_META.debt, rows };
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
  const rows = pending.map(({ bill, state }, index) =>
    `${index + 1}. ${labels[state]} | #${bill.bill_no || String(bill.id).slice(0, 8)} | ${bill.customer_name || "ลูกค้าทั่วไป"} | ${bill.delivery_date ? thDate(bill.delivery_date) : "ไม่ระบุวัน"} | เก็บ ${baht(billRemaining(bill))}${bill.delivery_phone ? ` | ${bill.delivery_phone}` : ""}${bill.delivery_address ? ` | ${bill.delivery_address}` : ""}`);
  rows.unshift(`งานค้าง ${pending.length} งาน | ยอดเก็บรวม ${baht(collect)}`);
  if (!pending.length) rows.push("ไม่มีงานจัดส่งค้างอยู่");
  return { ...PDF_META.delivery, rows };
}

async function cashPdfSource(key: "sales" | "cash") {
  const bubble = (await cashBubbles([key]))[0];
  if (!bubble) throw new Error("ไม่พบข้อมูลรายงาน");
  const rows = collectFlexText(bubble).filter((value, index, all) => value && value !== all[index - 1]);
  return { ...PDF_META[key], rows };
}

function wrapPdfLine(font: unknown, value: string, size: number, maxWidth: number) {
  const result: string[] = [];
  let current = "";
  for (const char of Array.from(cleanPdfText(value))) {
    const next = current + char;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      result.push(current.trimEnd());
      current = char.trimStart();
    } else {
      current = next;
    }
  }
  if (current || !result.length) result.push(current || "-");
  return result;
}

function hexRgb(rgb: (red: number, green: number, blue: number) => unknown, value: string) {
  const hex = value.replace("#", "");
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

async function createSimpleReportPdf(source: { title: string; subtitle: string; accent: string; rows: string[] }) {
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import("https://esm.sh/pdf-lib@1.17.1"),
    import("https://esm.sh/@pdf-lib/fontkit@1.1.1"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkitModule.default);
  const font = await pdf.embedFont(await getThaiFontBytes(), { subset: true });
  pdf.setTitle(source.title);
  pdf.setAuthor("SK วัสดุ");
  pdf.setCreationDate(new Date());
  const width = 595.28;
  const height = 841.89;
  const margin = 34;
  const ink = rgb(0.09, 0.13, 0.20);
  const muted = rgb(0.40, 0.45, 0.52);
  const line = rgb(0.89, 0.91, 0.94);
  const soft = rgb(0.97, 0.98, 0.99);
  const accent = hexRgb(rgb, source.accent);
  let page: unknown;
  let y = 0;
  let rowIndex = 0;

  const addPage = () => {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: height - 112, width, height: 112, color: accent });
    page.drawRectangle({ x: 0, y: height - 112, width: 9, height: 112, color: rgb(1, 1, 1), opacity: 0.35 });
    page.drawText(fitPdfText(font, cleanPdfText(source.title), 21, width - 2 * margin), {
      x: margin, y: height - 48, size: 21, font, color: rgb(1, 1, 1),
    });
    page.drawText(fitPdfText(font, cleanPdfText(source.subtitle), 10.5, width - 2 * margin), {
      x: margin, y: height - 76, size: 10.5, font, color: rgb(1, 1, 1), opacity: 0.84,
    });
    page.drawText(`สร้าง ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`, {
      x: margin, y: height - 96, size: 8.5, font, color: rgb(1, 1, 1), opacity: 0.68,
    });
    y = height - 136;
  };

  addPage();
  for (const raw of source.rows) {
    const wrapped = wrapPdfLine(font, raw, 9.5, width - 2 * margin - 22);
    const rowHeight = Math.max(31, 14 + wrapped.length * 13);
    if (y - rowHeight < 54) addPage();
    if (rowIndex % 2 === 0) page.drawRectangle({ x: margin, y: y - rowHeight, width: width - 2 * margin, height: rowHeight, color: soft });
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: width - margin, y: y - rowHeight }, thickness: 0.45, color: line });
    wrapped.forEach((text, index) => page.drawText(text, {
      x: margin + 11, y: y - 20 - index * 13, size: 9.5, font,
      color: rowIndex === 0 ? accent : ink,
    }));
    y -= rowHeight;
    rowIndex++;
  }

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const footerText = `หน้า ${index + 1} / ${pages.length}  |  ดึงข้อมูลเมื่อกดเมนู`;
    item.drawText(footerText, { x: margin, y: 27, size: 8.5, font, color: muted });
  });
  return await pdf.save();
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
    bytes = await createProductsPdf(await loadProductsRanking(100));
  } else {
    const source = key === "attendance" ? await attendancePdfSource()
      : key === "debt" ? await debtPdfSource()
      : key === "delivery" ? await deliveryPdfSource()
      : await cashPdfSource(key as "sales" | "cash");
    bytes = await createSimpleReportPdf(source);
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

async function attendanceDatabaseNotification() {
  // รองรับ Database Webhook เดิมโดยตอบสำเร็จ แต่ไม่ส่ง LINE อัตโนมัติ
  // ผู้ใช้แตะเมนูที่ปักหมุดไว้เพื่อดึง PDF ล่าสุดแทน
  return new Response("automatic attendance push disabled; use assistant menu", { status: 200 });
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
    return await attendanceDatabaseNotification();
  } catch (error) {
    console.error(error);
    return new Response(`error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
});
