// @ts-nocheck  — รันบน Deno (Supabase Edge Functions)
// ════════════════════════════════════════════════════════════════════
//  line-bill-notify — แจ้งเตือน "เฉพาะเหตุการณ์สำคัญ" เข้า LINE กลุ่ม (การ์ด Flex)
//  ทริกเกอร์ด้วย Database Webhook (INSERT):
//    • บิลขาย   → ค้างชำระ / คืนสินค้า / บิลใหญ่เกินเกณฑ์
//    • รายจ่าย  → จ่ายก้อนใหญ่เกินเกณฑ์
//  ENV: LINE_TOKEN, LINE_GROUP_ID, ALERT_BILL_MIN(0), ALERT_EXP_MIN(2000)
// ════════════════════════════════════════════════════════════════════

const LINE_TOKEN = Deno.env.get("LINE_TOKEN")!;
const LINE_GROUP_ID = Deno.env.get("LINE_GROUP_ID")!;
const ALERT_BILL_MIN = Number(Deno.env.get("ALERT_BILL_MIN") || "0");
const ALERT_EXP_MIN = Number(Deno.env.get("ALERT_EXP_MIN") || "2000");

const baht = (n: number) => "฿" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const timeTH = (iso: string) => {
  try { return new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

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
    { type: "text", text: label, size: "sm", color: "#64748B", flex: 0 },
    { type: "text", text: value, size: "sm", color, align: "end", weight: bold ? "bold" : "regular", flex: 1 },
  ],
});

function bubble(headerColor: string, title: string, amount: string, amountColor: string, rows: unknown[]) {
  return {
    type: "bubble", size: "kilo",
    header: { type: "box", layout: "vertical", backgroundColor: headerColor, paddingAll: "14px",
      contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md" }] },
    body: { type: "box", layout: "vertical", paddingAll: "16px", spacing: "none",
      contents: [
        { type: "text", text: amount, size: "xxl", weight: "bold", color: amountColor },
        { type: "separator", margin: "md" },
        { type: "box", layout: "vertical", margin: "md", spacing: "none", contents: rows },
      ] },
  };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const table = body.table || "";
    const r = body.record || {};
    let alt = "", bub: unknown = null;

    if (table === "บิลขาย") {
      const total = Number(r.total || 0);
      const deposit = Number(r.deposit_amount || 0);
      const who = r.customer_name || "ลูกค้าทั่วไป";
      if (r.status === "ค้างชำระ") {
        const debt = total - deposit;
        alt = `ค้างชำระ ${baht(debt)} — ${who}`;
        bub = bubble("#D97706", "🟠 ให้เครดิต / ค้างชำระ", baht(debt), "#B45309", [
          kv("ลูกค้า", who, "#0F172A", true),
          kv("ยอดบิล", baht(total)),
          ...(deposit > 0 ? [kv("มัดจำ", baht(deposit), "#16A34A")] : []),
          kv("พนักงาน", `${r.staff_name || "-"}`),
          kv("เวลา", timeTH(r.date)),
        ]);
      } else if (r.status === "คืนสินค้า") {
        alt = `คืนสินค้า ${baht(total)} — ${who}`;
        bub = bubble("#DC2626", "↩️ คืนสินค้า / ยกเลิกบิล", baht(total), "#DC2626", [
          kv("ลูกค้า", who, "#0F172A", true),
          kv("วิธีจ่าย", `${r.method || "-"}`),
          kv("พนักงาน", `${r.staff_name || "-"}`),
          kv("เวลา", timeTH(r.date)),
        ]);
      } else if (ALERT_BILL_MIN > 0 && total >= ALERT_BILL_MIN) {
        alt = `บิลใหญ่ ${baht(total)} — ${who}`;
        bub = bubble("#2563EB", "💎 บิลใหญ่", baht(total), "#1D4ED8", [
          kv("ลูกค้า", who, "#0F172A", true),
          kv("วิธีจ่าย", `${r.method || "-"}`),
          kv("พนักงาน", `${r.staff_name || "-"}`),
          kv("เวลา", timeTH(r.date)),
        ]);
      }
    } else if (table === "รายจ่าย") {
      const amt = Number(r.amount || 0);
      if (amt >= ALERT_EXP_MIN) {
        alt = `รายจ่าย ${baht(amt)} — ${r.description || ""}`;
        bub = bubble("#7C2D12", "💸 รายจ่ายก้อนใหญ่", baht(amt), "#9A3412", [
          kv("รายการ", `${r.description || "-"}`, "#0F172A", true),
          kv("หมวด", `${r.category || "อื่นๆ"}`),
          kv("จ่ายโดย", `${r.method || "-"}`),
          kv("พนักงาน", `${r.staff_name || "-"}`),
          kv("เวลา", timeTH(r.date)),
        ]);
      }
    }

    if (bub) await pushFlex(alt, bub);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 200 });
  }
});
