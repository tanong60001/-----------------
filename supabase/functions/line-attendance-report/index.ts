// @ts-nocheck  — รันบน Deno (Supabase Edge Functions)
// ════════════════════════════════════════════════════════════════════
//  line-attendance-report — แจ้ง LINE กลุ่ม "เมื่อเช็คชื่อครบทุกคน" (การ์ด Flex)
//  ทริกเกอร์ด้วย Database Webhook: ตาราง "เช็คชื่อ" event INSERT
//  จะส่งก็ต่อเมื่อ พนักงานที่ทำงานทุกคน มีการลงเวลาของวันนี้ครบแล้ว
//  ENV: LINE_TOKEN, LINE_GROUP_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LINE_TOKEN = Deno.env.get("LINE_TOKEN")!;
const LINE_GROUP_ID = Deno.env.get("LINE_GROUP_ID")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const norm = (s: string) => (s === "มาครึ่งวัน" ? "ครึ่งวัน" : s);
function todayTH() {
  const b = new Date(Date.now() + 7 * 3600 * 1000);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
}

async function pushFlex(altText: string, bubble: unknown) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to: LINE_GROUP_ID, messages: [{ type: "flex", altText, contents: bubble }] }),
  });
  if (!res.ok) console.error("LINE push failed:", res.status, await res.text());
}

const ROW = (icon: string, label: string, count: number, color: string) => ({
  type: "box", layout: "horizontal", margin: "sm",
  contents: [
    { type: "text", text: icon, flex: 0, color, weight: "bold", size: "md" },
    { type: "text", text: label, flex: 1, color: "#475569", size: "sm", margin: "sm", gravity: "center" },
    { type: "text", text: `${count} คน`, flex: 0, color: count > 0 ? color : "#CBD5E1", weight: "bold", size: "sm", align: "end" },
  ],
});

Deno.serve(async (req) => {
  try {
    await req.json().catch(() => ({})); // กิน payload ทิ้ง (ทำงานตาม state จริงใน DB)
    const today = todayTH();

    const [{ data: emps }, { data: att }] = await Promise.all([
      supabase.from("พนักงาน").select("id,name,lastname,status").eq("status", "ทำงาน"),
      supabase.from("เช็คชื่อ").select("employee_id,status").eq("date", today),
    ]);
    const total = (emps || []).length;
    if (!total) return new Response("no emps", { status: 200 });

    const map: Record<string, string> = {};
    (att || []).forEach((a) => { map[String(a.employee_id)] = norm(a.status); });

    // ครบทุกคนหรือยัง
    const allChecked = (emps || []).every((e) => map[String(e.id)]);
    if (!allChecked) return new Response("not complete yet", { status: 200 });

    // นับสถานะ
    const cnt: Record<string, number> = { มา: 0, มาสาย: 0, ครึ่งวัน: 0, ลา: 0, ขาด: 0 };
    const absent: string[] = [];
    for (const e of emps!) {
      const s = map[String(e.id)];
      if (cnt[s] !== undefined) cnt[s]++;
      if (s === "ขาด" || s === "ลา") absent.push(`${e.name}${s === "ลา" ? " (ลา)" : ""}`);
    }
    const working = cnt["มา"] + cnt["มาสาย"] + cnt["ครึ่งวัน"];
    const dateLabel = new Date(today + "T05:00:00Z").toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const timeLabel = new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

    const bubble = {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#16A34A", paddingAll: "18px", spacing: "xs",
        contents: [
          { type: "text", text: "✅ เช็คชื่อครบทุกคนแล้ว", color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: dateLabel, color: "#DCFCE7", size: "sm" },
        ],
      },
      body: {
        type: "box", layout: "vertical", paddingAll: "18px", spacing: "none",
        contents: [
          {
            type: "box", layout: "baseline", contents: [
              { type: "text", text: "มาทำงาน", size: "sm", color: "#94A3B8", flex: 0 },
              { type: "text", text: `${working}/${total} คน`, size: "xxl", weight: "bold", color: "#16A34A", align: "end" },
            ],
          },
          { type: "separator", margin: "lg" },
          { type: "box", layout: "vertical", margin: "lg", spacing: "none", contents: [
            ROW("✓", "มาทำงาน", cnt["มา"], "#16A34A"),
            ROW("▲", "มาสาย", cnt["มาสาย"], "#D97706"),
            ROW("◐", "ครึ่งวัน", cnt["ครึ่งวัน"], "#0891B2"),
            ROW("○", "ลา", cnt["ลา"], "#7C3AED"),
            ROW("✗", "ขาด", cnt["ขาด"], "#DC2626"),
          ] },
          ...(absent.length ? [
            { type: "separator", margin: "lg" },
            { type: "box", layout: "vertical", margin: "lg", backgroundColor: "#FEF2F2", cornerRadius: "8px", paddingAll: "10px", contents: [
              { type: "text", text: "ไม่ได้มา", size: "xs", color: "#B91C1C", weight: "bold" },
              { type: "text", text: absent.join(", "), size: "sm", color: "#DC2626", wrap: true, margin: "xs" },
            ] },
          ] : []),
        ],
      },
      footer: {
        type: "box", layout: "vertical", paddingAll: "12px",
        contents: [{ type: "text", text: `ลงเวลาครบเมื่อ ${timeLabel} น.`, size: "xs", color: "#AAAAAA", align: "center" }],
      },
    };

    await pushFlex(`เช็คชื่อครบ: มา ${working}/${total} คน`, bubble);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 200 });
  }
});
