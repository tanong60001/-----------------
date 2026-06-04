// @ts-nocheck  — รันบน Deno (Supabase Edge Functions)
// ════════════════════════════════════════════════════════════════════
//  line-cashdrawer — การ์ด LINE "เปิด/ปิดลิ้นชัก" พร้อมจำนวนแบงค์/เหรียญ
//  เรียกจากแอป (POST JSON):
//   { type:"open"|"close", total, expected?, diff?, denominations:{ "1000":2,... }, user, note? }
//  ENV: LINE_TOKEN, LINE_GROUP_ID
// ════════════════════════════════════════════════════════════════════

const LINE_TOKEN = Deno.env.get("LINE_TOKEN")!;
const LINE_GROUP_ID = Deno.env.get("LINE_GROUP_ID")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DENOMS = [1000, 500, 100, 50, 20, 10, 5, 1, 0.5, 0.25];
const baht = (n: number) => "฿" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const dlabel = (v: number) => (v < 1 ? `${v * 100} สต.` : `฿${v.toLocaleString("th-TH")}`);

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
    { type: "text", text: label, size: "sm", color: "#64748B", flex: 1 },
    { type: "text", text: value, size: "sm", color, align: "end", weight: bold ? "bold" : "regular", flex: 0 },
  ],
});

// แถวแบงค์: ฿1,000 × 2   =   ฿2,000
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const isOpen = b.type === "open";
    const den = b.denominations || {};
    const rows = DENOMS.filter((v) => Number(den[v] || 0) > 0).map((v) => denomRow(v, Number(den[v])));
    const time = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const headerColor = isOpen ? "#2563EB" : "#0F172A";
    const title = isOpen ? "🔓 เปิดลิ้นชัก" : "🔒 ปิดลิ้นชัก";
    const diff = Number(b.diff || 0);

    const summaryRows = isOpen
      ? [kv("💰 ยอดเปิด", baht(b.total), "#2563EB", true)]
      : [
          kv("ยอดตามระบบ", baht(b.expected)),
          kv("💵 นับจริงในลิ้นชัก", baht(b.total), "#0F172A", true),
          kv("ส่วนต่าง", (diff > 0 ? "+" : "") + baht(diff), Math.abs(diff) < 0.01 ? "#16A34A" : "#DC2626", true),
        ];

    const bubble = {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: headerColor, paddingAll: "18px", spacing: "xs",
        contents: [
          { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: `${b.user || "-"} · ${time} น.`, color: "#CBD5E1", size: "sm" },
        ],
      },
      body: {
        type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
        contents: [
          ...summaryRows,
          { type: "separator", margin: "lg" },
          { type: "text", text: "จำนวนแบงค์/เหรียญ", size: "xs", color: "#94A3B8", weight: "bold", margin: "md" },
          ...(rows.length ? rows : [{ type: "text", text: "— ไม่มีรายการ —", size: "sm", color: "#CBD5E1", margin: "sm" }]),
          ...(b.note ? [{ type: "separator", margin: "lg" }, { type: "text", text: `📝 ${b.note}`, size: "xs", color: "#94A3B8", wrap: true, margin: "md" }] : []),
        ],
      },
    };

    await pushFlex(`${title} ${baht(b.total)}`, bubble);
    return new Response("ok", { status: 200, headers: CORS });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 200, headers: CORS });
  }
});
