// Generates a deterministic visual QA pack for all six LINE PDF reports.
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  createMinimalReportPdf,
  createProductsRankingPdf,
  type MinimalReportSource,
} from "../supabase/functions/line-attendance-report/pdf-renderer.ts";

const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf";
const outputDir = "output/pdf";
const tempDir = "tmp/pdfs/line-report-preview";
await Deno.mkdir(outputDir, { recursive: true });
await Deno.mkdir(tempDir, { recursive: true });
const fontResponse = await fetch(FONT_URL);
if (!fontResponse.ok) throw new Error(`font download failed: ${fontResponse.status}`);
const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
const generatedLabel = "17 ส.ค. 2569 เวลา 08:30 น.";

const reports: Array<{ key: string; source: MinimalReportSource }> = [
  {
    key: "attendance",
    source: {
      title: "เช้านี้ทีมเราเป็นอย่างไร",
      subtitle: "สรุปเช็คชื่อแบบอ่านง่าย พร้อมเวลาลงงาน",
      accent: "#16A34A",
      generatedLabel,
      summary: "เช็คชื่อครบแล้ว 8 คน วันนี้มาทำงาน 7 คน และมี 1 คนที่ลา",
      metrics: [
        { label: "ลงสถานะแล้ว", value: "8/8 คน", tone: "good" },
        { label: "มาทำงาน", value: "7 คน", tone: "good" },
        { label: "มาสาย / ครึ่งวัน", value: "1 คน", tone: "warn" },
        { label: "ลา / ขาด", value: "1 คน", tone: "neutral" },
      ],
      sections: [{
        title: "รายชื่อทีมวันนี้",
        description: "มองแถวเดียวก็รู้ว่าใครมาแบบไหน และลงเวลาเมื่อไร",
        rows: [
          ["สมชาย ใจดี", "08:01 น.", "มา", "good"],
          ["สมหญิง ตั้งใจ", "08:04 น.", "มา", "good"],
          ["ณัฐวุฒิ ขยันงาน", "08:18 น.", "มาสาย", "warn"],
          ["อรทัย ยิ้มแย้ม", "08:02 น.", "มา", "good"],
          ["ปรีชา รอบคอบ", "08:06 น.", "มา", "good"],
          ["วิภา เป็นสุข", "-", "ลา", "neutral"],
          ["ธนา พร้อมช่วย", "08:00 น.", "มา", "good"],
          ["กมลชนก คนเก่ง", "08:03 น.", "มา", "good"],
        ].map(([name, time, status, tone], index) => ({
          title: `${index + 1}. ${name}`,
          detail: time === "-" ? "แจ้งลาประจำวันแล้ว" : `เข้างาน ${time}  •  ยังไม่ลงเวลาออกงาน`,
          value: status,
          tone: tone as "good" | "warn" | "danger" | "neutral",
        })),
      }],
      note: "เช็คชื่อครบทุกคนแล้ว ระบบจะส่งสรุปอัตโนมัติเข้ากลุ่มเพียงหนึ่งครั้งต่อวัน",
    },
  },
  {
    key: "sales",
    source: {
      title: "วันนี้ร้านขายเป็นอย่างไร",
      subtitle: "ภาพรวมยอดขายตั้งแต่เปิดรอบ พร้อมช่องทางรับเงิน",
      accent: "#3B82F6",
      generatedLabel,
      summary: "ตั้งแต่เปิดรอบ ร้านขายแล้ว 18 บิล รวม ฿42,850 ช่องทางหลักวันนี้คือเงินโอน",
      metrics: [
        { label: "ยอดขายรวม", value: "฿42,850", tone: "good" },
        { label: "จำนวนบิล", value: "18 บิล", tone: "neutral" },
        { label: "รับเงินสด", value: "฿16,200", tone: "good" },
        { label: "รับเงินโอน", value: "฿26,650", tone: "neutral" },
      ],
      sections: [
        { title: "เงินเข้าทางไหนบ้าง", rows: [
          { title: "โอนเงิน", detail: "10 บิล", value: "฿26,650" },
          { title: "เงินสด", detail: "8 บิล", value: "฿16,200", tone: "good" },
        ] },
        { title: "บิลล่าสุด", rows: [
          { title: "#INV-02651", detail: "ขายเมื่อ 08:24 น.", value: "฿4,850" },
          { title: "#INV-02650", detail: "ขายเมื่อ 08:16 น.", value: "฿2,300" },
          { title: "#INV-02649", detail: "ขายเมื่อ 08:05 น.", value: "฿1,250" },
        ] },
      ],
      note: "รอบนี้เปิดโดย แอดมิน เมื่อ 07:45 น.",
    },
  },
  {
    key: "cash",
    source: {
      title: "เงินในลิ้นชักตอนนี้",
      subtitle: "ยอดรวมและจำนวนธนบัตรตามข้อมูลในระบบ",
      accent: "#059669",
      generatedLabel,
      summary: "ตอนนี้เงินในลิ้นชักตามระบบรวม ฿18,475 แยกจำนวนธนบัตรและเหรียญไว้ให้ตรวจนับง่ายแล้ว",
      metrics: [
        { label: "ยอดรวมตามระบบ", value: "฿18,475", tone: "good" },
        { label: "ชนิดเงินที่มี", value: "7 ชนิด", tone: "neutral" },
        { label: "สถานะตรวจนับ", value: "ปกติ", tone: "good" },
        { label: "ผู้เปิดรอบ", value: "แอดมิน", tone: "neutral" },
      ],
      sections: [{ title: "นับแบงค์และเหรียญ", rows: [
        ["ธนบัตร 1,000 บาท", "12 ใบ", "฿12,000"],
        ["ธนบัตร 500 บาท", "5 ใบ", "฿2,500"],
        ["ธนบัตร 100 บาท", "28 ใบ", "฿2,800"],
        ["ธนบัตร 50 บาท", "11 ใบ", "฿550"],
        ["ธนบัตร 20 บาท", "20 ใบ", "฿400"],
        ["เหรียญ 10 บาท", "20 เหรียญ", "฿200"],
        ["เหรียญ 5 บาท", "5 เหรียญ", "฿25"],
      ].map(([title, detail, value]) => ({ title, detail, value })) }],
      note: "จำนวนคำนวณจากยอดเปิด บวกเงินเข้า ลบเงินออก และหักเงินทอน ควรนับเงินจริงก่อนปิดรอบทุกครั้ง",
    },
  },
  {
    key: "debt",
    source: {
      title: "ภาพรวมลูกค้าที่ค้างชำระ",
      subtitle: "ยอดปัจจุบันที่ควรติดตาม ไม่รวมทะเบียนหนี้เสีย",
      accent: "#8B5CF6",
      generatedLabel,
      summary: "ตอนนี้มีลูกค้าค้างชำระ 6 ราย รวม ฿86,400 โดยเรียงรายที่ควรติดตามก่อนจากยอดสูงสุด",
      metrics: [
        { label: "ยอดค้างทั้งหมด", value: "฿86,400", tone: "danger" },
        { label: "จำนวนลูกหนี้", value: "6 ราย", tone: "warn" },
        { label: "ยอดสูงสุด", value: "฿32,000", tone: "danger" },
        { label: "เฉลี่ยต่อราย", value: "฿14,400", tone: "neutral" },
      ],
      sections: [{ title: "เรียงตามยอดที่ควรติดตาม", rows: [
        ["บริษัท บ้านสวย จำกัด", "081-234-5678", "฿32,000"],
        ["ช่างเอก รับเหมา", "089-555-0123", "฿18,500"],
        ["ร้านรุ่งเรือง", "086-321-9988", "฿14,900"],
        ["คุณสมพร", "ยังไม่มีเบอร์โทรในระบบ", "฿9,500"],
        ["หจก. งานดี", "082-778-9090", "฿7,000"],
        ["คุณนภา", "095-445-6677", "฿4,500"],
      ].map(([name, phone, value], index) => ({
        title: `${index + 1}. ${name}`, detail: phone.startsWith("0") ? `โทร ${phone}` : phone,
        value, tone: index < 3 ? "danger" : "neutral",
      })) }],
      note: "รายงานนี้ใช้ยอดลูกหนี้ปัจจุบัน และไม่รวมรายการที่ย้ายไปทะเบียนหนี้เสียแล้ว",
    },
  },
  {
    key: "delivery",
    source: {
      title: "วันนี้มีอะไรต้องจัดส่งบ้าง",
      subtitle: "เรียงงานเร่งด่วนก่อน พร้อมยอดที่ต้องเก็บ",
      accent: "#F97316",
      generatedLabel,
      summary: "มีงานจัดส่งค้าง 5 งาน ระบบเรียงงานเกินกำหนดและงานวันนี้ไว้บนสุด เพื่อให้ทีมเริ่มจากเรื่องเร่งด่วนก่อน",
      metrics: [
        { label: "เกินกำหนด", value: "1 งาน", tone: "danger" },
        { label: "ต้องส่งวันนี้", value: "2 งาน", tone: "warn" },
        { label: "งานที่รออยู่", value: "5 งาน", tone: "warn" },
        { label: "ยอดที่ต้องเก็บ", value: "฿24,600", tone: "good" },
      ],
      sections: [
        { title: "เกินกำหนด", rows: [{ title: "1. #DL-1048  คุณวรพล", detail: "นัด 16 ส.ค. 2569  •  โทร 081-222-7788  •  บ้านเลขที่ 45 หมู่ 3", value: "เก็บ ฿8,500", tone: "danger" }] },
        { title: "ส่งวันนี้", rows: [
          { title: "1. #DL-1051  ร้านบ้านสวน", detail: "นัด 17 ส.ค. 2569  •  โทร 089-321-4567", value: "ชำระแล้ว", tone: "warn" },
          { title: "2. #DL-1052  คุณวาสนา", detail: "นัด 17 ส.ค. 2569  •  โทร 086-555-0198", value: "เก็บ ฿12,100", tone: "warn" },
        ] },
        { title: "งานถัดไป", rows: [
          { title: "1. #DL-1053  ช่างหนุ่ม", detail: "นัด 18 ส.ค. 2569", value: "เก็บ ฿4,000" },
          { title: "2. #DL-1054  คุณกมล", detail: "นัด 19 ส.ค. 2569", value: "ชำระแล้ว" },
        ] },
      ],
      note: "ไม่รวมบิลยกเลิก คืนสินค้า งานรับเอง และงานที่ส่งสำเร็จแล้ว",
    },
  },
];

const bytes: Uint8Array[] = [];
for (const report of reports) {
  const pdf = await createMinimalReportPdf(report.source, fontBytes);
  await Deno.writeFile(`${tempDir}/${report.key}.pdf`, pdf);
  bytes.push(pdf);
}

const products = await createProductsRankingPdf({
  top: Array.from({ length: 34 }, (_, index) => ({
    name: ["ปูนซีเมนต์ปอร์ตแลนด์", "เหล็กเส้นข้ออ้อย 12 มม.", "อิฐมวลเบา", "ทรายหยาบ", "สีทาภายใน", "ท่อพีวีซี", "กระเบื้องหลังคา"][index % 7] + ` รุ่น ${index + 1}`,
    qty: 125 - index * 2.35,
    unit: index % 3 === 0 ? "ถุง" : index % 3 === 1 ? "เส้น" : "ชิ้น",
    amount: Math.max(1200, 45200 - index * 1175),
  })),
  productCount: 74,
  billCount: 182,
  totalQty: 2840,
  totalAmount: 684250,
  start: "2026-07-19T00:00:00+07:00",
  end: "2026-08-17T08:30:00+07:00",
}, fontBytes);
await Deno.writeFile(`${tempDir}/products.pdf`, products);
bytes.push(products);

const combined = await PDFDocument.create();
for (const reportBytes of bytes) {
  const source = await PDFDocument.load(reportBytes);
  const pages = await combined.copyPages(source, source.getPageIndices());
  pages.forEach((page) => combined.addPage(page));
}
const outputPath = `${outputDir}/SK-LINE-Report-Design-Preview.pdf`;
await Deno.writeFile(outputPath, await combined.save());
console.log(outputPath);
