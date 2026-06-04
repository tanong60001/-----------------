// @ts-nocheck  — ไฟล์นี้รันบน Deno (Supabase Edge Functions) IDE อาจขึ้น error เก๊ ไม่ต้องสนใจ
// ════════════════════════════════════════════════════════════════════
//  line-webhook — รับเหตุการณ์จาก LINE เพื่อ "ดึง groupId" เท่านั้น
//   • เชิญบอทเข้ากลุ่ม หรือพิมพ์ "id" ในกลุ่ม → บอทตอบ groupId กลับมา
//   • ก๊อป groupId ไปตั้งเป็น ENV: LINE_GROUP_ID
//  ตั้ง URL นี้ใน LINE Console → Messaging API → Webhook URL
//  ENV: LINE_TOKEN
// ════════════════════════════════════════════════════════════════════

const LINE_TOKEN = Deno.env.get("LINE_TOKEN")!;

async function reply(replyToken: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    for (const ev of body.events || []) {
      const replyToken = ev.replyToken;
      const id = ev.source?.groupId || ev.source?.roomId || ev.source?.userId || "(ไม่พบ)";

      if (ev.type === "join") {
        await reply(replyToken, `เข้ากลุ่มแล้ว ✅\ngroupId:\n${id}\n\nก๊อปไปตั้ง ENV: LINE_GROUP_ID`);
      } else if (ev.type === "message" && ev.message?.type === "text" && /^\s*id\s*$/i.test(ev.message.text)) {
        await reply(replyToken, `groupId:\n${id}`);
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("ok", { status: 200 });
  }
});
