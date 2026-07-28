// @ts-nocheck — Supabase Edge Function (Deno)
// แจ้งเตือนเปิด/ปิดลิ้นชักเหมือนเดิม และเป็นแหล่งรายงานยอดขาย/เงินในลิ้นชัก
// สำหรับ line-attendance-report ผ่าน action: "assistant-report"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_TOKEN = Deno.env.get("LINE_TOKEN") || "";
const LINE_GROUP_ID = Deno.env.get("LINE_GROUP_ID") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// ปิดเป็นค่าเริ่มต้นเพื่อประหยัดโควต้า LINE — ข้อมูลยังเรียกดูจากเมนูผู้ช่วยได้
// หากต้องการเปิดแจ้งเปิด/ปิดลิ้นชักอีกครั้ง ให้ตั้ง ENABLE_LINE_CASHDRAWER_PUSH=true
const ENABLE_CASHDRAWER_PUSH = Deno.env.get("ENABLE_LINE_CASHDRAWER_PUSH") === "true";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const DENOMS = [1000, 500, 100, 50, 20, 10, 5, 1, 0.5, 0.25];
const baht = (n: number) =>
  "฿" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const dlabel = (v: number) => v < 1 ? `${v * 100} สต.` : `฿${v.toLocaleString("th-TH")}`;
const nowLabel = () => new Date().toLocaleTimeString("th-TH", {
  timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
});
const parseInfo = (value: unknown) => {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try { return JSON.parse(String(value)); } catch (_) { return {}; }
};
const effectiveTotal = (bill: Record<string, unknown>) => {
  const info = parseInfo(bill.return_info);
  const value = Number(info.new_total ?? bill.total ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};
const isValidBill = (bill: Record<string, unknown>) =>
  !/ยกเลิก|คืนสินค้า|หนี้เสีย|ตัดหนี้/i.test(String(bill.status || ""));

async function pushFlex(altText: string, bubble: unknown) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to: LINE_GROUP_ID, messages: [{ type: "flex", altText, contents: bubble }] }),
  });
  if (!res.ok) console.error("LINE push failed:", res.status, await res.text());
}

const kv = (label: string, value: string, color = "#334155", bold = false) => ({
  type: "box", layout: "horizontal", margin: "sm",
  contents: [
    { type: "text", text: label, size: "sm", color: "#64748B", flex: 1, wrap: true },
    { type: "text", text: value, size: "sm", color, align: "end", weight: bold ? "bold" : "regular", flex: 0 },
  ],
});

function denomRow(v: number, n: number) {
  return {
    type: "box", layout: "horizontal", margin: "xs",
    contents: [
      { type: "text", text: dlabel(v), size: "sm", color: "#475569", flex: 3 },
      { type: "text", text: `× ${n}`, size: "sm", color: "#94A3B8", align: "center", flex: 2 },
      { type: "text", text: baht(v * n), size: "sm", color: "#0F172A", align: "end", weight: "bold", flex: 3 },
    ],
  };
}

function errorBubble(title: string, detail: string) {
  return {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", backgroundColor: "#B91C1C", paddingAll: "18px",
      contents: [{ type: "text", text: `⚠️ ${title}`, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true }] },
    body: { type: "box", layout: "vertical", paddingAll: "18px",
      contents: [{ type: "text", text: detail, color: "#64748B", size: "sm", wrap: true }] },
  };
}

async function currentSession() {
  const { data, error } = await supabase.from("cash_session").select("*")
    .eq("status", "open").order("opened_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function salesBubble() {
  const session = await currentSession();
  if (!session) {
    return {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", backgroundColor: "#D97706", paddingAll: "18px",
        contents: [
          { type: "text", text: "🧾 ยอดขายรอบปัจจุบัน", color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: "ยังไม่ได้เปิดรอบลิ้นชัก", color: "#FEF3C7", size: "sm", margin: "xs" },
        ] },
      body: { type: "box", layout: "vertical", paddingAll: "18px",
        contents: [{ type: "text", text: "ไม่พบรอบเงินสดที่กำลังเปิด จึงยังระบุเวลาเริ่มรอบและยอดขายของรอบนี้ไม่ได้", size: "sm", color: "#64748B", wrap: true }] },
    };
  }

  const [{ data, error }, { data: cashTransactions, error: cashError }] = await Promise.all([
    supabase.from("บิลขาย")
      .select("id,bill_no,date,total,method,status,received,change,deposit_amount,return_info")
      .gte("date", session.opened_at).order("date", { ascending: false }).limit(500),
    supabase.from("cash_transaction")
      .select("ref_id,net_amount,type").eq("session_id", session.id).eq("direction", "in"),
  ]);
  if (error) throw error;
  if (cashError) throw cashError;
  const bills = (data || []).filter(isValidBill);
  const cashByBill = new Map<string, number>();
  for (const tx of (cashTransactions || [])) {
    if (!tx.ref_id || !/ขาย/.test(String(tx.type || ""))) continue;
    const key = String(tx.ref_id);
    cashByBill.set(key, (cashByBill.get(key) || 0) + Number(tx.net_amount || 0));
  }
  const methods: Record<string, { count: number; amount: number }> = {};
  let total = 0;
  for (const bill of bills) {
    const amount = effectiveTotal(bill);
    total += amount;
    const method = String(bill.method || "ไม่ระบุ");
    if (method === "เงินโอน+เงินสด") {
      const cashPart = Math.min(amount, Math.max(0, cashByBill.get(String(bill.id)) || 0));
      const transferPart = Math.max(0, amount - cashPart);
      if (cashPart > 0) {
        if (!methods["เงินสด"]) methods["เงินสด"] = { count: 0, amount: 0 };
        methods["เงินสด"].count++;
        methods["เงินสด"].amount += cashPart;
      }
      if (transferPart > 0) {
        if (!methods["โอนเงิน"]) methods["โอนเงิน"] = { count: 0, amount: 0 };
        methods["โอนเงิน"].count++;
        methods["โอนเงิน"].amount += transferPart;
      }
    } else {
      if (!methods[method]) methods[method] = { count: 0, amount: 0 };
      methods[method].count++;
      methods[method].amount += amount;
    }
  }
  const opened = new Date(session.opened_at).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const recent = bills.slice(0, 5);
  const icon: Record<string, string> = { เงินสด: "💵", โอนเงิน: "🏦", บัตรเครดิต: "💳", ค้างชำระ: "⏳" };
  return {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", backgroundColor: "#1D4ED8", paddingAll: "18px", spacing: "xs",
      contents: [
        { type: "text", text: "🧾 ยอดขายรอบปัจจุบัน", color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: `ตั้งแต่เปิดรอบ ${opened} น.`, color: "#DBEAFE", size: "sm" },
      ] },
    body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
      contents: [
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: `${bills.length} บิล`, color: "#64748B", size: "sm", flex: 0 },
          { type: "text", text: baht(total), color: "#1D4ED8", size: "xxl", weight: "bold", align: "end" },
        ] },
        { type: "separator", margin: "lg" },
        { type: "text", text: "แยกตามวิธีชำระ", color: "#94A3B8", size: "xs", weight: "bold", margin: "md" },
        ...Object.entries(methods).map(([method, row]) =>
          kv(`${icon[method] || "•"} ${method} (${row.count})`, baht(row.amount),
            method === "เงินสด" ? "#16A34A" : method === "โอนเงิน" ? "#2563EB" : "#7C3AED", true)),
        { type: "separator", margin: "lg" },
        { type: "text", text: `บิลล่าสุด${bills.length > recent.length ? ` (แสดง ${recent.length}/${bills.length})` : ""}`,
          color: "#94A3B8", size: "xs", weight: "bold", margin: "md" },
        ...(recent.length ? recent.map((bill) => {
          const time = new Date(bill.date).toLocaleTimeString("th-TH", {
            timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
          });
          return kv(`#${bill.bill_no || String(bill.id).slice(0, 8)} · ${time}`, baht(effectiveTotal(bill)));
        }) : [{ type: "text", text: "ยังไม่มีบิลในรอบนี้", size: "sm", color: "#94A3B8", margin: "sm" }]),
      ] },
    footer: { type: "box", layout: "vertical", backgroundColor: "#EFF6FF", paddingAll: "12px",
      contents: [{ type: "text", text: `อัปเดต ณ ${nowLabel()} น.`, size: "xs", color: "#64748B", align: "center" }] },
  };
}

async function drawerBubble() {
  const session = await currentSession();
  if (!session) {
    return {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", backgroundColor: "#D97706", paddingAll: "18px",
        contents: [{ type: "text", text: "💵 เงินในลิ้นชัก", color: "#FFFFFF", weight: "bold", size: "lg" }] },
      body: { type: "box", layout: "vertical", paddingAll: "18px",
        contents: [{ type: "text", text: "ยังไม่ได้เปิดรอบลิ้นชักวันนี้ จึงไม่มีจำนวนธนบัตรและเหรียญให้ตรวจสอบ", size: "sm", color: "#64748B", wrap: true }] },
    };
  }
  const { data: txs, error } = await supabase.from("cash_transaction")
    .select("direction,denominations,change_denominations").eq("session_id", session.id);
  if (error) throw error;
  const drawer: Record<string, number> = {};
  DENOMS.forEach((value) => drawer[String(value)] = 0);
  const opening = session.opening_denominations || session.denominations || {};
  DENOMS.forEach((value) => drawer[String(value)] += Number(opening[String(value)] ?? opening[value] ?? 0));
  for (const tx of (txs || [])) {
    const direction = tx.direction === "in" ? 1 : -1;
    const den = tx.denominations || {};
    const change = tx.change_denominations || {};
    DENOMS.forEach((value) => {
      const key = String(value);
      drawer[key] += direction * Number(den[key] ?? den[value] ?? 0);
      drawer[key] += tx.direction === "in"
        ? -Number(change[key] ?? change[value] ?? 0)
        : Number(change[key] ?? change[value] ?? 0);
    });
  }
  const rows = DENOMS.filter((value) => Math.abs(drawer[String(value)]) > 0.0001);
  const total = DENOMS.reduce((sum, value) => sum + value * drawer[String(value)], 0);
  const hasNegative = rows.some((value) => drawer[String(value)] < 0);
  const note = hasNegative
    ? "พบจำนวนติดลบในบางชนิด ควรนับเงินจริงและตรวจรายการเงินทอน"
    : "จำนวนคำนวณจากยอดเปิด + เงินเข้า/ออก − เงินทอน";
  return {
    type: "bubble", size: "mega",
    header: { type: "box", layout: "vertical", backgroundColor: "#047857", paddingAll: "18px", spacing: "xs",
      contents: [
        { type: "text", text: "💵 เงินในลิ้นชัก", color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: `รอบของ ${session.opened_by || "-"}`, color: "#D1FAE5", size: "sm" },
      ] },
    body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
      contents: [
        { type: "box", layout: "baseline", contents: [
          { type: "text", text: "ยอดตามจำนวนแบงค์", color: "#64748B", size: "sm", flex: 0 },
          { type: "text", text: baht(total), color: hasNegative ? "#DC2626" : "#047857", size: "xxl", weight: "bold", align: "end" },
        ] },
        { type: "separator", margin: "lg" },
        { type: "text", text: "ธนบัตร / เหรียญ", color: "#94A3B8", size: "xs", weight: "bold", margin: "md" },
        ...(rows.length
          ? rows.map((value) => denomRow(value, drawer[String(value)]))
          : [{ type: "text", text: "ไม่มีข้อมูลจำนวนเงิน", color: "#94A3B8", size: "sm", margin: "sm" }]),
        { type: "separator", margin: "lg" },
        { type: "text", text: note, color: hasNegative ? "#B91C1C" : "#64748B", size: "xs", wrap: true, margin: "md" },
      ] },
    footer: { type: "box", layout: "vertical", backgroundColor: hasNegative ? "#FEF2F2" : "#ECFDF5", paddingAll: "12px",
      contents: [{ type: "text", text: `อัปเดต ณ ${nowLabel()} น.`, size: "xs", color: "#64748B", align: "center" }] },
  };
}

async function assistantReport(req: Request, body: Record<string, unknown>) {
  const auth = req.headers.get("authorization") || "";
  if (!SERVICE_KEY || auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const selected = Array.isArray(body.selected) ? body.selected.map(String) : [];
  const bubbles: unknown[] = [];
  for (const key of selected) {
    try {
      if (key === "sales") bubbles.push(await salesBubble());
      if (key === "cash") bubbles.push(await drawerBubble());
    } catch (error) {
      bubbles.push(errorBubble(key === "sales" ? "โหลดยอดขายไม่สำเร็จ" : "โหลดลิ้นชักไม่สำเร็จ",
        error instanceof Error ? error.message : String(error)));
    }
  }
  return new Response(JSON.stringify({ bubbles }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    if (body?.action === "assistant-report") return await assistantReport(req, body);

    // พฤติกรรมแจ้งเปิด/ปิดลิ้นชักเดิม
    const isOpen = body.type === "open";
    const den = body.denominations || {};
    const rows = DENOMS.filter((v) => Number(den[v] || 0) > 0).map((v) => denomRow(v, Number(den[v])));
    const time = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    const headerColor = isOpen ? "#2563EB" : "#0F172A";
    const title = isOpen ? "🔓 เปิดลิ้นชัก" : "🔒 ปิดลิ้นชัก";
    const diff = Number(body.diff || 0);
    const summaryRows = isOpen
      ? [kv("💰 ยอดเปิด", baht(body.total), "#2563EB", true)]
      : [
          kv("ยอดตามระบบ", baht(body.expected)),
          kv("💵 นับจริงในลิ้นชัก", baht(body.total), "#0F172A", true),
          kv("ส่วนต่าง", (diff > 0 ? "+" : "") + baht(diff), Math.abs(diff) < 0.01 ? "#16A34A" : "#DC2626", true),
        ];
    const bubble = {
      type: "bubble", size: "mega",
      header: { type: "box", layout: "vertical", backgroundColor: headerColor, paddingAll: "18px", spacing: "xs",
        contents: [
          { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: `${body.user || "-"} · ${time} น.`, color: "#CBD5E1", size: "sm" },
        ] },
      body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
        contents: [
          ...summaryRows,
          { type: "separator", margin: "lg" },
          { type: "text", text: "จำนวนแบงค์/เหรียญ", size: "xs", color: "#94A3B8", weight: "bold", margin: "md" },
          ...(rows.length ? rows : [{ type: "text", text: "— ไม่มีรายการ —", size: "sm", color: "#CBD5E1", margin: "sm" }]),
          ...(body.note ? [
            { type: "separator", margin: "lg" },
            { type: "text", text: `📝 ${body.note}`, size: "xs", color: "#94A3B8", wrap: true, margin: "md" },
          ] : []),
        ] },
    };
    if (ENABLE_CASHDRAWER_PUSH) {
      await pushFlex(`${title} ${baht(body.total)}`, bubble);
    }
    return new Response("ok", { status: 200, headers: CORS });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 200, headers: CORS });
  }
});
