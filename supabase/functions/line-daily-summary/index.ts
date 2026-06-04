// @ts-nocheck  — ไฟล์นี้รันบน Deno (Supabase Edge Functions) IDE อาจขึ้น error เก๊ ไม่ต้องสนใจ
// ════════════════════════════════════════════════════════════════════
//  line-daily-summary — สรุปยอดร้าน "รายวันแบบละเอียด" เข้า LINE กลุ่ม
//  เรียกได้ 2 ทาง:
//    1) pg_cron + pg_net ยิงตอนปิดร้านทุกวัน (เช่น 21:00)
//    2) เรียก URL ตรงๆ เพื่อทดสอบ / กดดูเดี๋ยวนั้น
//  รับ query: ?date=YYYY-MM-DD (ไม่ใส่ = วันนี้ตามเวลาไทย)
//  ENV: LINE_TOKEN, LINE_GROUP_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_TOKEN = Deno.env.get("LINE_TOKEN")!;
const LINE_GROUP_ID = Deno.env.get("LINE_GROUP_ID")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const baht = (n: number) =>
  "฿" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });

// ช่วงเวลาวันหนึ่ง (เวลาไทย UTC+7) → ISO เริ่ม/จบ
function dayRangeTH(dateStr?: string) {
  let y: number, m: number, d: number;
  if (dateStr) {
    [y, m, d] = dateStr.split("-").map(Number);
    m -= 1;
  } else {
    const bkk = new Date(Date.now() + 7 * 3600 * 1000);
    y = bkk.getUTCFullYear(); m = bkk.getUTCMonth(); d = bkk.getUTCDate();
  }
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - 7 * 3600 * 1000).toISOString();
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59) - 7 * 3600 * 1000).toISOString();
  const label = new Date(Date.UTC(y, m, d, 5)).toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return { start, end, label };
}

async function pushFlex(altText: string, bubble: unknown) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to: LINE_GROUP_ID, messages: [{ type: "flex", altText, contents: bubble }] }),
  });
  if (!res.ok) console.error("LINE push failed:", res.status, await res.text());
}

// แถวข้อมูล label ─ value
const kv = (label: string, value: string, color = "#334155", bold = false, indent = false) => ({
  type: "box", layout: "horizontal", margin: "sm",
  contents: [
    { type: "text", text: (indent ? "  • " : "") + label, size: "sm", color: indent ? "#94A3B8" : "#64748B", flex: 1, gravity: "center" },
    { type: "text", text: value, size: "sm", color, align: "end", weight: bold ? "bold" : "regular", flex: 0 },
  ],
});

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const { start, end, label } = dayRangeTH(url.searchParams.get("date") || undefined);

    // ── ยอดขาย ──
    const { data: bills } = await supabase
      .from("บิลขาย").select("total,discount,method,status,deposit_amount")
      .gte("date", start).lte("date", end);

    const sales = (bills || []).filter((b) => b.status !== "คืนสินค้า");
    const refunds = (bills || []).filter((b) => b.status === "คืนสินค้า");

    const totalSales = sales.reduce((s, b) => s + Number(b.total || 0), 0);
    const byMethod: Record<string, number> = {};
    for (const b of sales) byMethod[b.method || "เงินสด"] = (byMethod[b.method || "เงินสด"] || 0) + Number(b.total || 0);

    // รับเงิน "จริง" แยกช่องทาง (ค้างชำระนับเฉพาะมัดจำที่รับมา)
    const recvByMethod: Record<string, number> = {};
    for (const b of sales) {
      const recv = b.status === "ค้างชำระ" ? Number(b.deposit_amount || 0) : Number(b.total || 0);
      const m = b.method || "เงินสด";
      recvByMethod[m] = (recvByMethod[m] || 0) + recv;
    }
    const mIcon: Record<string, string> = { "เงินสด": "💵", "โอนเงิน": "🏦", "บัตรเครดิต": "💳" };

    const outstanding = sales
      .filter((b) => b.status === "ค้างชำระ")
      .reduce((s, b) => s + (Number(b.total || 0) - Number(b.deposit_amount || 0)), 0);
    const debtCount = sales.filter((b) => b.status === "ค้างชำระ").length;
    const received = totalSales - outstanding;           // รับเงินจริงเข้าวันนี้
    const refundTotal = refunds.reduce((s, b) => s + Number(b.total || 0), 0);

    // ── รายจ่าย ──
    const { data: expenses } = await supabase
      .from("รายจ่าย").select("amount,category,method")
      .gte("date", start).lte("date", end);
    const expTotal = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const byCat: Record<string, number> = {};
    for (const e of (expenses || [])) byCat[e.category || "อื่นๆ"] = (byCat[e.category || "อื่นๆ"] || 0) + Number(e.amount || 0);

    const cashIn = (byMethod["เงินสด"] || 0)
      - sales.filter((b) => b.method === "เงินสด" && b.status === "ค้างชำระ")
        .reduce((s, b) => s + (Number(b.total || 0) - Number(b.deposit_amount || 0)), 0);
    const cashOut = (expenses || []).filter((e) => e.method === "เงินสด").reduce((s, e) => s + Number(e.amount || 0), 0);

    // ── ประกอบการ์ด Flex ──
    const net = cashIn - cashOut;
    const body: unknown[] = [
      // ยอดขายรวม
      { type: "box", layout: "baseline", contents: [
        { type: "text", text: "🧾 ยอดขายรวม", size: "sm", color: "#64748B", flex: 0 },
        { type: "text", text: baht(totalSales), size: "xl", weight: "bold", color: "#0F172A", align: "end" },
      ] },
      { type: "text", text: `${sales.length} บิล`, size: "xs", color: "#94A3B8", align: "end" },
      { type: "separator", margin: "lg" },
      // รับเงินจริง แยกช่องทาง (เงินสด/โอน/บัตร)
      { type: "text", text: "รับเงินจริง แยกช่องทาง", size: "xs", color: "#94A3B8", margin: "md", weight: "bold" },
      ...Object.entries(recvByMethod).filter(([, v]) => v > 0).map(([m, v]) =>
        kv(`${mIcon[m] || "•"} ${m}`, baht(v), m === "เงินสด" ? "#16A34A" : m === "โอนเงิน" ? "#2563EB" : "#7C3AED", true)),
      { type: "separator", margin: "lg" },
      // รับจริง / ค้างชำระ
      kv("✅ รับเงินจริงรวม", baht(received), "#16A34A", true),
      ...(outstanding > 0 ? [kv(`⏳ ค้างชำระ (${debtCount} บิล)`, baht(outstanding), "#DC2626", true)] : []),
      ...(refundTotal > 0 ? [kv(`↩️ คืนสินค้า (${refunds.length} บิล)`, baht(refundTotal), "#9333EA", true)] : []),
      { type: "separator", margin: "lg" },
      // รายจ่าย
      kv(`💸 รายจ่าย (${(expenses || []).length} รายการ)`, baht(expTotal), "#DC2626", true),
      ...Object.entries(byCat).map(([c, v]) => kv(c, baht(v), "#334155", false, true)),
    ];

    const bubble = {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#1E293B", paddingAll: "18px", spacing: "xs",
        contents: [
          { type: "text", text: "📊 สรุปยอดร้าน", color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: label, color: "#94A3B8", size: "sm" },
        ],
      },
      body: { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none", contents: body },
      footer: {
        type: "box", layout: "vertical", backgroundColor: net >= 0 ? "#ECFDF5" : "#FEF2F2", paddingAll: "16px", spacing: "xs",
        contents: [
          { type: "box", layout: "baseline", contents: [
            { type: "text", text: "🟢 เงินสดสุทธิ", size: "sm", color: "#475569", flex: 0, weight: "bold" },
            { type: "text", text: baht(net), size: "lg", weight: "bold", color: net >= 0 ? "#047857" : "#DC2626", align: "end" },
          ] },
          { type: "text", text: `เงินสดเข้า ${baht(cashIn)} − จ่ายสด ${baht(cashOut)}`, size: "xxs", color: "#94A3B8", align: "end" },
        ],
      },
    };

    await pushFlex(`สรุปยอดร้าน ${label}: ขาย ${baht(totalSales)}`, bubble);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
