// @ts-nocheck - shared PDF renderer for Supabase Edge Functions and local previews.

export type ReportMetric = {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

export type ReportRow = {
  title: string;
  detail?: string;
  value?: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

export type ReportSection = {
  title: string;
  description?: string;
  rows: ReportRow[];
};

export type MinimalReportSource = {
  title: string;
  subtitle: string;
  accent: string;
  summary: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
  note?: string;
  generatedLabel?: string;
};

export type ProductsReport = {
  top: Array<{ name: string; qty: number; unit: string; amount: number }>;
  productCount: number;
  billCount: number;
  totalQty: number;
  totalAmount: number;
  start: string;
  end: string;
};

const clean = (value: unknown) => String(value ?? "-")
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
  .replace(/[\uFE0E\uFE0F\u200D]/g, "")
  .replace(/\s+/g, " ").trim() || "-";

const thNumber = (value: number) => Number(value || 0).toLocaleString("th-TH", {
  maximumFractionDigits: 2,
});
const baht = (value: number) => `฿${thNumber(value)}`;
const thDate = (value: string) => new Date(value).toLocaleDateString("th-TH", {
  timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
});

function hexRgb(rgb: (red: number, green: number, blue: number) => unknown, value: string) {
  const hex = String(value || "#64748B").replace("#", "").padEnd(6, "0").slice(0, 6);
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function wrap(font: unknown, value: unknown, size: number, maxWidth: number) {
  const words = clean(value).split(" ");
  const lines: string[] = [];
  let current = "";
  const pushChars = (word: string) => {
    let part = "";
    for (const char of Array.from(word)) {
      if (part && font.widthOfTextAtSize(part + char, size) > maxWidth) {
        lines.push(part);
        part = char;
      } else {
        part += char;
      }
    }
    return part;
  };
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = font.widthOfTextAtSize(word, size) <= maxWidth ? word : pushChars(word);
  }
  if (current || !lines.length) lines.push(current || "-");
  return lines;
}

function fit(font: unknown, value: unknown, size: number, maxWidth: number) {
  const text = clean(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && font.widthOfTextAtSize(`${chars.join("")}...`, size) > maxWidth) chars.pop();
  return `${chars.join("")}...`;
}

function toneColor(rgb: unknown, tone = "neutral") {
  if (tone === "good") return rgb(0.05, 0.52, 0.36);
  if (tone === "warn") return rgb(0.85, 0.48, 0.09);
  if (tone === "danger") return rgb(0.86, 0.20, 0.25);
  return rgb(0.29, 0.35, 0.43);
}

export async function createMinimalReportPdf(source: MinimalReportSource, fontBytes: Uint8Array) {
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import("https://esm.sh/pdf-lib@1.17.1"),
    import("https://esm.sh/@pdf-lib/fontkit@1.1.1"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkitModule.default);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(clean(source.title));
  pdf.setAuthor("SK วัสดุ");
  pdf.setSubject(clean(source.summary));
  pdf.setCreationDate(new Date());

  const width = 595.28;
  const height = 841.89;
  const margin = 34;
  const contentWidth = width - margin * 2;
  const accent = hexRgb(rgb, source.accent);
  const ink = rgb(0.10, 0.14, 0.20);
  const muted = rgb(0.40, 0.45, 0.52);
  const line = rgb(0.89, 0.91, 0.94);
  const canvas = rgb(0.975, 0.98, 0.985);
  const white = rgb(1, 1, 1);
  const generatedLabel = clean(source.generatedLabel || new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short",
  }));
  let page: unknown;
  let y = 0;

  const addPage = (first: boolean) => {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: canvas });
    page.drawRectangle({ x: 0, y: 0, width: 8, height, color: accent });
    page.drawText("SK STORE  /  MORNING & DAILY SNAPSHOT", {
      x: margin, y: height - 38, size: 8.2, font, color: accent,
    });
    page.drawText(fit(font, source.title, first ? 22 : 18, contentWidth - 116), {
      x: margin, y: height - (first ? 70 : 66), size: first ? 22 : 18, font, color: ink,
    });
    page.drawText(first ? clean(source.subtitle) : "รายละเอียดต่อจากหน้าก่อน", {
      x: margin, y: height - 92, size: 9.5, font, color: muted,
    });
    const stamp = `อัปเดต ${generatedLabel}`;
    page.drawText(stamp, {
      x: width - margin - font.widthOfTextAtSize(stamp, 8.2), y: height - 38,
      size: 8.2, font, color: muted,
    });
    page.drawLine({ start: { x: margin, y: height - 110 }, end: { x: width - margin, y: height - 110 }, thickness: 0.7, color: line });
    y = height - 132;

    if (first) {
      const summaryLines = wrap(font, source.summary, 11, contentWidth - 30).slice(0, 3);
      const summaryHeight = 30 + summaryLines.length * 15;
      page.drawRectangle({ x: margin, y: y - summaryHeight, width: contentWidth, height: summaryHeight, color: white });
      page.drawRectangle({ x: margin, y: y - summaryHeight, width: 5, height: summaryHeight, color: accent, opacity: 0.75 });
      summaryLines.forEach((text, index) => page.drawText(text, {
        x: margin + 18, y: y - 24 - index * 15, size: 11, font, color: ink,
      }));
      y -= summaryHeight + 14;

      const metrics = (source.metrics || []).slice(0, 4);
      if (metrics.length) {
        const gap = 9;
        const cardWidth = (contentWidth - gap * (metrics.length - 1)) / metrics.length;
        const cardHeight = 70;
        metrics.forEach((metric, index) => {
          const x = margin + index * (cardWidth + gap);
          page.drawRectangle({ x, y: y - cardHeight, width: cardWidth, height: cardHeight, color: white });
          page.drawText(fit(font, metric.label, 8.5, cardWidth - 18), {
            x: x + 10, y: y - 19, size: 8.5, font, color: muted,
          });
          page.drawText(fit(font, metric.value, 15, cardWidth - 18), {
            x: x + 10, y: y - 42, size: 15, font, color: toneColor(rgb, metric.tone),
          });
          if (metric.hint) page.drawText(fit(font, metric.hint, 7.5, cardWidth - 18), {
            x: x + 10, y: y - 59, size: 7.5, font, color: muted,
          });
        });
        y -= cardHeight + 20;
      }
    }
  };

  const ensure = (needed: number) => {
    if (y - needed < 58) addPage(false);
  };

  addPage(true);
  for (const section of source.sections || []) {
    ensure(50);
    page.drawText(clean(section.title), { x: margin, y: y - 2, size: 12, font, color: ink });
    page.drawRectangle({ x: margin, y: y - 12, width: 34, height: 3, color: accent, opacity: 0.72 });
    y -= 24;
    if (section.description) {
      const lines = wrap(font, section.description, 8.5, contentWidth);
      ensure(lines.length * 12 + 8);
      lines.forEach((text, index) => page.drawText(text, {
        x: margin, y: y - index * 12, size: 8.5, font, color: muted,
      }));
      y -= lines.length * 12 + 8;
    }

    if (!section.rows?.length) {
      ensure(40);
      page.drawRectangle({ x: margin, y: y - 34, width: contentWidth, height: 34, color: white });
      page.drawText("วันนี้ยังไม่มีรายการในส่วนนี้", { x: margin + 12, y: y - 22, size: 9.5, font, color: muted });
      y -= 44;
      continue;
    }

    section.rows.forEach((row, rowIndex) => {
      const valueWidth = row.value ? Math.min(132, Math.max(74, font.widthOfTextAtSize(clean(row.value), 10) + 18)) : 0;
      const textWidth = contentWidth - 28 - valueWidth;
      const titleLines = wrap(font, row.title, 9.8, textWidth).slice(0, 2);
      const detailLines = row.detail ? wrap(font, row.detail, 8.2, textWidth).slice(0, 3) : [];
      const rowHeight = Math.max(38, 16 + titleLines.length * 13 + detailLines.length * 11);
      ensure(rowHeight + 2);
      page.drawRectangle({
        x: margin, y: y - rowHeight, width: contentWidth, height: rowHeight,
        color: rowIndex % 2 === 0 ? white : canvas,
      });
      titleLines.forEach((text, index) => page.drawText(text, {
        x: margin + 12, y: y - 18 - index * 13, size: 9.8, font, color: ink,
      }));
      detailLines.forEach((text, index) => page.drawText(text, {
        x: margin + 12, y: y - 18 - titleLines.length * 13 - index * 11,
        size: 8.2, font, color: muted,
      }));
      if (row.value) {
        const value = fit(font, row.value, 10, valueWidth - 8);
        page.drawText(value, {
          x: width - margin - 12 - font.widthOfTextAtSize(value, 10),
          y: y - 20, size: 10, font, color: toneColor(rgb, row.tone),
        });
      }
      page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: width - margin, y: y - rowHeight }, thickness: 0.45, color: line });
      y -= rowHeight;
    });
    y -= 18;
  }

  if (source.note) {
    const noteLines = wrap(font, source.note, 8.2, contentWidth - 24);
    const noteHeight = 20 + noteLines.length * 11;
    ensure(noteHeight + 10);
    page.drawRectangle({ x: margin, y: y - noteHeight, width: contentWidth, height: noteHeight, color: white });
    noteLines.forEach((text, index) => page.drawText(text, {
      x: margin + 12, y: y - 18 - index * 11, size: 8.2, font, color: muted,
    }));
  }

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const left = "สรุปจากข้อมูลในระบบร้าน ณ เวลาที่สร้างไฟล์";
    const right = `หน้า ${index + 1} / ${pages.length}`;
    item.drawText(left, { x: margin, y: 27, size: 7.8, font, color: muted });
    item.drawText(right, {
      x: width - margin - font.widthOfTextAtSize(right, 7.8), y: 27,
      size: 7.8, font, color: muted,
    });
  });
  return await pdf.save();
}

export async function createProductsRankingPdf(report: ProductsReport, fontBytes: Uint8Array) {
  const topThree = report.top.slice(0, 3);
  const remaining = report.top.slice(3);
  const topShare = report.totalAmount > 0
    ? topThree.reduce((sum, item) => sum + item.amount, 0) / report.totalAmount * 100
    : 0;
  const source: MinimalReportSource = {
    title: "สินค้าขายดี 30 วัน",
    subtitle: `ช่วง ${thDate(report.start)} ถึง ${thDate(report.end)}`,
    accent: "#D97706",
    summary: topThree.length
      ? `ช่วง 30 วันที่ผ่านมา ${topThree[0].name} ทำยอดขายสูงที่สุด และสินค้า 3 อันดับแรกคิดเป็น ${thNumber(topShare)}% ของยอดขายทั้งหมด`
      : "ช่วง 30 วันที่ผ่านมายังไม่มีข้อมูลสินค้าที่นำมาจัดอันดับได้",
    metrics: [
      { label: "ยอดขายรวม", value: baht(report.totalAmount), tone: "good" },
      { label: "จำนวนบิล", value: `${thNumber(report.billCount)} บิล`, tone: "neutral" },
      { label: "สินค้าที่ขาย", value: `${thNumber(report.productCount)} รายการ`, tone: "neutral" },
      { label: "จำนวนรวม", value: thNumber(report.totalQty), hint: "รวมทุกหน่วย", tone: "warn" },
    ],
    sections: [
      {
        title: "สามอันดับที่ลูกค้าหยิบบ่อย",
        description: "เรียงตามยอดขายเป็นเงินบาท เพื่อให้เห็นตัวทำรายได้หลักของร้าน",
        rows: topThree.map((item, index) => ({
          title: `${index + 1}. ${item.name}`,
          detail: `ขายได้ ${thNumber(item.qty)} ${item.unit}`,
          value: baht(item.amount),
          tone: index === 0 ? "good" : "warn",
        })),
      },
      {
        title: "อันดับถัดไป",
        rows: remaining.map((item, index) => ({
          title: `${index + 4}. ${item.name}`,
          detail: `ขายได้ ${thNumber(item.qty)} ${item.unit}`,
          value: baht(item.amount),
        })),
      },
    ],
    note: "ไม่รวมบิลยกเลิก คืนสินค้า หนี้เสีย และรายการตัดหนี้",
  };
  return await createMinimalReportPdf(source, fontBytes);
}
