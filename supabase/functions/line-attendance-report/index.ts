// @ts-nocheck

// supabase/functions/line-attendance-report/source.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// supabase/functions/line-attendance-report/pdf-renderer.ts
var clean = (value) => String(value ?? "-").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/[\uFE0E\uFE0F\u200D]/g, "").replace(/\s+/g, " ").trim() || "-";
var thNumber = (value) => Number(value || 0).toLocaleString("th-TH", {
  maximumFractionDigits: 2
});
var baht = (value) => `\u0E3F${thNumber(value)}`;
var thDate = (value) => new Date(value).toLocaleDateString("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric"
});
function hexRgb(rgb, value) {
  const hex = String(value || "#64748B").replace("#", "").padEnd(6, "0").slice(0, 6);
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255
  );
}
function wrap(font, value, size, maxWidth) {
  const words = clean(value).split(" ");
  const lines = [];
  let current = "";
  const pushChars = (word) => {
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
function fit(font, value, size, maxWidth) {
  const text = clean(value);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1 && font.widthOfTextAtSize(`${chars.join("")}...`, size) > maxWidth) chars.pop();
  return `${chars.join("")}...`;
}
function toneColor(rgb, tone = "neutral") {
  if (tone === "good") return rgb(0.05, 0.52, 0.36);
  if (tone === "warn") return rgb(0.85, 0.48, 0.09);
  if (tone === "danger") return rgb(0.86, 0.2, 0.25);
  return rgb(0.29, 0.35, 0.43);
}
async function createMinimalReportPdf(source, fontBytes) {
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import("https://esm.sh/pdf-lib@1.17.1"),
    import("https://esm.sh/@pdf-lib/fontkit@1.1.1")
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkitModule.default);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(clean(source.title));
  pdf.setAuthor("SK \u0E27\u0E31\u0E2A\u0E14\u0E38");
  pdf.setSubject(clean(source.summary));
  pdf.setCreationDate(/* @__PURE__ */ new Date());
  const width = 595.28;
  const height = 841.89;
  const margin = 34;
  const contentWidth = width - margin * 2;
  const accent = hexRgb(rgb, source.accent);
  const ink = rgb(0.1, 0.14, 0.2);
  const muted = rgb(0.4, 0.45, 0.52);
  const line = rgb(0.89, 0.91, 0.94);
  const canvas = rgb(0.975, 0.98, 0.985);
  const white = rgb(1, 1, 1);
  const generatedLabel = clean(source.generatedLabel || (/* @__PURE__ */ new Date()).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short"
  }));
  let page;
  let y = 0;
  const addPage = (first) => {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: canvas });
    page.drawRectangle({ x: 0, y: 0, width: 8, height, color: accent });
    page.drawText("SK STORE  /  MORNING & DAILY SNAPSHOT", {
      x: margin,
      y: height - 38,
      size: 8.2,
      font,
      color: accent
    });
    page.drawText(fit(font, source.title, first ? 22 : 18, contentWidth - 116), {
      x: margin,
      y: height - (first ? 70 : 66),
      size: first ? 22 : 18,
      font,
      color: ink
    });
    page.drawText(first ? clean(source.subtitle) : "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E48\u0E2D\u0E19", {
      x: margin,
      y: height - 92,
      size: 9.5,
      font,
      color: muted
    });
    const stamp = `\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15 ${generatedLabel}`;
    page.drawText(stamp, {
      x: width - margin - font.widthOfTextAtSize(stamp, 8.2),
      y: height - 38,
      size: 8.2,
      font,
      color: muted
    });
    page.drawLine({ start: { x: margin, y: height - 110 }, end: { x: width - margin, y: height - 110 }, thickness: 0.7, color: line });
    y = height - 132;
    if (first) {
      const summaryLines = wrap(font, source.summary, 11, contentWidth - 30).slice(0, 3);
      const summaryHeight = 30 + summaryLines.length * 15;
      page.drawRectangle({ x: margin, y: y - summaryHeight, width: contentWidth, height: summaryHeight, color: white });
      page.drawRectangle({ x: margin, y: y - summaryHeight, width: 5, height: summaryHeight, color: accent, opacity: 0.75 });
      summaryLines.forEach((text, index) => page.drawText(text, {
        x: margin + 18,
        y: y - 24 - index * 15,
        size: 11,
        font,
        color: ink
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
            x: x + 10,
            y: y - 19,
            size: 8.5,
            font,
            color: muted
          });
          page.drawText(fit(font, metric.value, 15, cardWidth - 18), {
            x: x + 10,
            y: y - 42,
            size: 15,
            font,
            color: toneColor(rgb, metric.tone)
          });
          if (metric.hint) page.drawText(fit(font, metric.hint, 7.5, cardWidth - 18), {
            x: x + 10,
            y: y - 59,
            size: 7.5,
            font,
            color: muted
          });
        });
        y -= cardHeight + 20;
      }
    }
  };
  const ensure = (needed) => {
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
        x: margin,
        y: y - index * 12,
        size: 8.5,
        font,
        color: muted
      }));
      y -= lines.length * 12 + 8;
    }
    if (!section.rows?.length) {
      ensure(40);
      page.drawRectangle({ x: margin, y: y - 34, width: contentWidth, height: 34, color: white });
      page.drawText("\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E19\u0E35\u0E49", { x: margin + 12, y: y - 22, size: 9.5, font, color: muted });
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
        x: margin,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: rowIndex % 2 === 0 ? white : canvas
      });
      titleLines.forEach((text, index) => page.drawText(text, {
        x: margin + 12,
        y: y - 18 - index * 13,
        size: 9.8,
        font,
        color: ink
      }));
      detailLines.forEach((text, index) => page.drawText(text, {
        x: margin + 12,
        y: y - 18 - titleLines.length * 13 - index * 11,
        size: 8.2,
        font,
        color: muted
      }));
      if (row.value) {
        const value = fit(font, row.value, 10, valueWidth - 8);
        page.drawText(value, {
          x: width - margin - 12 - font.widthOfTextAtSize(value, 10),
          y: y - 20,
          size: 10,
          font,
          color: toneColor(rgb, row.tone)
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
      x: margin + 12,
      y: y - 18 - index * 11,
      size: 8.2,
      font,
      color: muted
    }));
  }
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const left = "\u0E2A\u0E23\u0E38\u0E1B\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E49\u0E32\u0E19 \u0E13 \u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C";
    const right = `\u0E2B\u0E19\u0E49\u0E32 ${index + 1} / ${pages.length}`;
    item.drawText(left, { x: margin, y: 27, size: 7.8, font, color: muted });
    item.drawText(right, {
      x: width - margin - font.widthOfTextAtSize(right, 7.8),
      y: 27,
      size: 7.8,
      font,
      color: muted
    });
  });
  return await pdf.save();
}
async function createProductsRankingPdf(report, fontBytes) {
  const topThree = report.top.slice(0, 3);
  const remaining = report.top.slice(3);
  const topShare = report.totalAmount > 0 ? topThree.reduce((sum, item) => sum + item.amount, 0) / report.totalAmount * 100 : 0;
  const source = {
    title: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35 30 \u0E27\u0E31\u0E19",
    subtitle: `\u0E0A\u0E48\u0E27\u0E07 ${thDate(report.start)} \u0E16\u0E36\u0E07 ${thDate(report.end)}`,
    accent: "#D97706",
    summary: topThree.length ? `\u0E0A\u0E48\u0E27\u0E07 30 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E32 ${topThree[0].name} \u0E17\u0E33\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E2A\u0E39\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14 \u0E41\u0E25\u0E30\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 3 \u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E41\u0E23\u0E01\u0E04\u0E34\u0E14\u0E40\u0E1B\u0E47\u0E19 ${thNumber(topShare)}% \u0E02\u0E2D\u0E07\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14` : "\u0E0A\u0E48\u0E27\u0E07 30 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E32\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E19\u0E33\u0E21\u0E32\u0E08\u0E31\u0E14\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E44\u0E14\u0E49",
    metrics: [
      { label: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E23\u0E27\u0E21", value: baht(report.totalAmount), tone: "good" },
      { label: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E1A\u0E34\u0E25", value: `${thNumber(report.billCount)} \u0E1A\u0E34\u0E25`, tone: "neutral" },
      { label: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E32\u0E22", value: `${thNumber(report.productCount)} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23`, tone: "neutral" },
      { label: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E23\u0E27\u0E21", value: thNumber(report.totalQty), hint: "\u0E23\u0E27\u0E21\u0E17\u0E38\u0E01\u0E2B\u0E19\u0E48\u0E27\u0E22", tone: "warn" }
    ],
    sections: [
      {
        title: "\u0E2A\u0E32\u0E21\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E2B\u0E22\u0E34\u0E1A\u0E1A\u0E48\u0E2D\u0E22",
        description: "\u0E40\u0E23\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E07\u0E34\u0E19\u0E1A\u0E32\u0E17 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E40\u0E2B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E17\u0E33\u0E23\u0E32\u0E22\u0E44\u0E14\u0E49\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E23\u0E49\u0E32\u0E19",
        rows: topThree.map((item, index) => ({
          title: `${index + 1}. ${item.name}`,
          detail: `\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49 ${thNumber(item.qty)} ${item.unit}`,
          value: baht(item.amount),
          tone: index === 0 ? "good" : "warn"
        }))
      },
      {
        title: "\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B",
        rows: remaining.map((item, index) => ({
          title: `${index + 4}. ${item.name}`,
          detail: `\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49 ${thNumber(item.qty)} ${item.unit}`,
          value: baht(item.amount)
        }))
      }
    ],
    note: "\u0E44\u0E21\u0E48\u0E23\u0E27\u0E21\u0E1A\u0E34\u0E25\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 \u0E04\u0E37\u0E19\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u0E2B\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E35\u0E22 \u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E15\u0E31\u0E14\u0E2B\u0E19\u0E35\u0E49"
  };
  return await createMinimalReportPdf(source, fontBytes);
}

// supabase/functions/line-attendance-report/source.ts
var LINE_TOKEN = (Deno.env.get("LINE_TOKEN") || "").trim();
var LINE_GROUP_ID = (Deno.env.get("LINE_GROUP_ID") || "").trim();
var LINE_CHANNEL_SECRET = (Deno.env.get("LINE_CHANNEL_SECRET") || "").trim();
var SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
var SERVICE_KEY = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
var supabase = createClient(SUPABASE_URL, SERVICE_KEY);
var enc = new TextEncoder();
var ASSISTANT_BUCKET = "line-assistant";
var THAI_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf";
var bucketReady = null;
var thaiFontBytes = null;
var OPTIONS = [
  { key: "attendance", no: 1, icon: "\u{1FAAA}", title: "\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49", hint: "\u0E21\u0E32 \u0E2A\u0E32\u0E22 \u0E25\u0E32 \u0E02\u0E32\u0E14 \u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15" },
  { key: "sales", no: 2, icon: "\u{1F9FE}", title: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49", hint: "\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A \u0E41\u0E22\u0E01\u0E1A\u0E34\u0E25 \u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14 \u0E41\u0E25\u0E30\u0E40\u0E07\u0E34\u0E19\u0E42\u0E2D\u0E19" },
  { key: "cash", no: 3, icon: "\u{1F4B5}", title: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E41\u0E1A\u0E07\u0E04\u0E4C\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01", hint: "\u0E41\u0E22\u0E01\u0E18\u0E19\u0E1A\u0E31\u0E15\u0E23\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14" },
  { key: "debt", no: 4, icon: "\u{1F465}", title: "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E04\u0E49\u0E32\u0E07\u0E0A\u0E33\u0E23\u0E30\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", hint: "\u0E22\u0E2D\u0E14\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19 \u0E44\u0E21\u0E48\u0E23\u0E27\u0E21\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E2B\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E35\u0E22" },
  { key: "delivery", no: 5, icon: "\u{1F69A}", title: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E02\u0E19\u0E2A\u0E48\u0E07", hint: "\u0E07\u0E32\u0E19\u0E04\u0E49\u0E32\u0E07 \u0E2A\u0E48\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49 \u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14 \u0E41\u0E25\u0E30\u0E22\u0E2D\u0E14\u0E40\u0E01\u0E47\u0E1A" },
  { key: "products", no: 6, icon: "\u{1F3C6}", title: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35 30 \u0E27\u0E31\u0E19", hint: "\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A \u0E08\u0E33\u0E19\u0E27\u0E19\u0E02\u0E32\u0E22 \u0E41\u0E25\u0E30\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E42\u0E14\u0E22\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13" }
];
var VALID_KEYS = new Set(OPTIONS.map((option) => option.key));
var WAKE_WORDS = /* @__PURE__ */ new Set([
  "\u0E2A\u0E27\u0E31\u0E14\u0E14\u0E35",
  "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35",
  "\u0E2A\u0E27\u0E31\u0E14\u0E14\u0E35\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22",
  "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22",
  "\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22",
  "\u0E40\u0E21\u0E19\u0E39",
  "\u0E40\u0E21\u0E19\u0E39\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22",
  "\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22"
]);
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-line-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
var baht2 = (n) => "\u0E3F" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
var normStatus = (value) => value === "\u0E21\u0E32\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19" ? "\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19" : value;
var parseInfo = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return {};
  }
};
function todayTH() {
  const bkk = new Date(Date.now() + 7 * 3600 * 1e3);
  return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, "0")}-${String(bkk.getUTCDate()).padStart(2, "0")}`;
}
function thDate2(value, withTime = false) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    ...withTime ? { hour: "2-digit", minute: "2-digit" } : {}
  });
}
var safeSelected = (raw) => [...new Set(String(raw || "").split(",").filter((key) => VALID_KEYS.has(key)))];
var selectionData = (mode, selected, item) => {
  const query = new URLSearchParams({ a: "assistant", mode, selected: selected.join(",") });
  if (item) query.set("item", item);
  return query.toString();
};
async function ensureAssistantBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      const bucketExists = (data || []).some((bucket) => bucket.name === ASSISTANT_BUCKET);
      const bucketOptions = {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ["application/pdf", "application/json"]
      };
      if (!bucketExists) {
        const created = await supabase.storage.createBucket(ASSISTANT_BUCKET, {
          ...bucketOptions
        });
        if (created.error && !/already|duplicate/i.test(created.error.message || "")) throw created.error;
      } else {
        const updated = await supabase.storage.updateBucket(ASSISTANT_BUCKET, bucketOptions);
        if (updated.error) throw updated.error;
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
      if (!response.ok) throw new Error(`\u0E42\u0E2B\u0E25\u0E14\u0E1F\u0E2D\u0E19\u0E15\u0E4C\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    }).catch((error) => {
      thaiFontBytes = null;
      throw error;
    });
  }
  return await thaiFontBytes;
}
async function lineRequest(path, body) {
  const response = await fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`LINE ${path} ${response.status}: ${await response.text()}`);
}
async function reply(replyToken, messages) {
  await lineRequest("reply", { replyToken, messages });
}
async function push(messages) {
  if (!LINE_GROUP_ID) throw new Error("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07 LINE_GROUP_ID");
  await lineRequest("push", { to: LINE_GROUP_ID, messages });
}
async function validSignature(raw, received) {
  if (!LINE_CHANNEL_SECRET || !received) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
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
    { bg: "#ECFDF5", color: "#059669", iconBg: "#D1FAE5", short: "\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49", hint: "\u0E43\u0E04\u0E23\u0E21\u0E32 \u0E2A\u0E32\u0E22 \u0E25\u0E32 \u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E32\u0E14" },
    { bg: "#EFF6FF", color: "#2563EB", iconBg: "#DBEAFE", short: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49", hint: "\u0E14\u0E39\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21\u0E41\u0E25\u0E30\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32" },
    { bg: "#F0FDFA", color: "#0F766E", iconBg: "#CCFBF1", short: "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01", hint: "\u0E19\u0E31\u0E1A\u0E41\u0E1A\u0E07\u0E04\u0E4C\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D" },
    { bg: "#FAF5FF", color: "#7C3AED", iconBg: "#EDE9FE", short: "\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E15\u0E32\u0E21", hint: "\u0E40\u0E23\u0E35\u0E22\u0E07\u0E22\u0E2D\u0E14\u0E04\u0E49\u0E32\u0E07\u0E08\u0E32\u0E01\u0E21\u0E32\u0E01\u0E44\u0E1B\u0E19\u0E49\u0E2D\u0E22" },
    { bg: "#FFF7ED", color: "#EA580C", iconBg: "#FFEDD5", short: "\u0E04\u0E34\u0E27\u0E2A\u0E48\u0E07\u0E02\u0E2D\u0E07", hint: "\u0E07\u0E32\u0E19\u0E14\u0E48\u0E27\u0E19 \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49 \u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E16\u0E31\u0E14\u0E44\u0E1B" },
    { bg: "#FFFBEB", color: "#CA8A04", iconBg: "#FEF3C7", short: "\u0E02\u0E2D\u0E07\u0E02\u0E32\u0E22\u0E14\u0E35", hint: "\u0E2D\u0E31\u0E19\u0E14\u0E31\u0E1A\u0E40\u0E14\u0E48\u0E19\u0E43\u0E19 30 \u0E27\u0E31\u0E19" }
  ];
  const tiles = OPTIONS.map((option, index) => ({
    type: "box",
    layout: "vertical",
    flex: 1,
    spacing: "sm",
    backgroundColor: styles[index].bg,
    cornerRadius: "20px",
    paddingAll: "14px",
    borderWidth: "1px",
    borderColor: styles[index].iconBg,
    action: {
      type: "postback",
      label: option.title,
      data: selectionData("pdf", [option.key], option.key)
    },
    contents: [
      {
        type: "box",
        layout: "vertical",
        width: "48px",
        height: "48px",
        backgroundColor: styles[index].iconBg,
        cornerRadius: "24px",
        alignItems: "center",
        justifyContent: "center",
        contents: [{ type: "text", text: option.icon, size: "xl", align: "center" }]
      },
      { type: "text", text: styles[index].short, size: "sm", color: "#172033", weight: "bold", wrap: true },
      { type: "text", text: styles[index].hint, size: "xxs", color: "#64748B", wrap: true, maxLines: 2 },
      {
        type: "box",
        layout: "horizontal",
        margin: "sm",
        spacing: "xs",
        alignItems: "center",
        contents: [
          { type: "text", text: "\u0E40\u0E1B\u0E34\u0E14\u0E2A\u0E23\u0E38\u0E1B", size: "xxs", color: styles[index].color, weight: "bold", flex: 0 },
          { type: "text", text: "\u203A", size: "md", color: styles[index].color, weight: "bold", flex: 0 }
        ]
      }
    ]
  }));
  const rows = [0, 2, 4].map((start) => ({
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [tiles[start], tiles[start + 1]]
  }));
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FFF7F2",
      paddingAll: "20px",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "md",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              width: "54px",
              height: "54px",
              backgroundColor: "#FFE4D6",
              cornerRadius: "27px",
              alignItems: "center",
              justifyContent: "center",
              flex: 0,
              contents: [{ type: "text", text: "\u{1F3E1}", size: "xxl", align: "center" }]
            },
            {
              type: "box",
              layout: "vertical",
              spacing: "xs",
              contents: [
                { type: "text", text: "\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35\u0E04\u0E23\u0E31\u0E1A \u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E23\u0E49\u0E32\u0E19\u0E21\u0E32\u0E41\u0E25\u0E49\u0E27", color: "#7C2D12", size: "lg", weight: "bold", wrap: true },
                { type: "text", text: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E2D\u0E22\u0E32\u0E01\u0E14\u0E39\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E44\u0E2B\u0E19\u0E14\u0E35\u0E04\u0E23\u0E31\u0E1A?", color: "#9A6A55", size: "sm", wrap: true }
              ]
            }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#FFFFFF",
          cornerRadius: "14px",
          paddingAll: "10px",
          spacing: "sm",
          contents: [
            { type: "text", text: "\u2728", size: "sm", flex: 0 },
            { type: "text", text: "\u0E41\u0E15\u0E30\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07 \u0E41\u0E25\u0E49\u0E27\u0E1C\u0E21\u0E08\u0E30\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E1B\u0E47\u0E19 PDF \u0E2D\u0E48\u0E32\u0E19\u0E07\u0E48\u0E32\u0E22\u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35", color: "#7C5B4B", size: "xs", wrap: true }
          ]
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "md",
      backgroundColor: "#FFFDFC",
      contents: rows
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "sm",
      backgroundColor: "#FFFFFF",
      contents: [
        { type: "separator", color: "#F1E7E1" },
        { type: "text", text: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 \u2022 PDF \u0E40\u0E1B\u0E34\u0E14\u0E44\u0E14\u0E49 24 \u0E0A\u0E21. \u2022 \u0E01\u0E14\u0E0B\u0E49\u0E33\u0E43\u0E19 5 \u0E19\u0E32\u0E17\u0E35\u0E44\u0E21\u0E48\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E2B\u0E21\u0E48", size: "xxs", color: "#A18A7E", align: "center", wrap: true },
        { type: "text", text: "\u0E1E\u0E34\u0E21\u0E1E\u0E4C \u201C\u0E40\u0E21\u0E19\u0E39\u201D \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E2D\u0E22\u0E32\u0E01\u0E40\u0E23\u0E35\u0E22\u0E01\u0E1C\u0E39\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32", size: "xxs", color: "#C08457", align: "center" }
      ]
    }
  };
}
function deliveryState(bill) {
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
function billRemaining(bill) {
  const info = parseInfo(bill.return_info);
  if (Object.prototype.hasOwnProperty.call(info, "remaining_amount")) {
    return Math.max(0, Number(info.remaining_amount || 0));
  }
  const total = Math.max(0, Number(info.new_total ?? bill.total ?? 0));
  const received = Math.max(
    Number(bill.deposit_amount || 0),
    Math.max(0, Number(bill.received || 0) - Number(bill.change || 0))
  );
  if (!/ค้าง|เครดิต|ชำระหน้างาน|เก็บปลายทาง|cod/i.test(`${bill.method || ""} ${bill.status || ""}`)) return 0;
  return Math.max(0, total - received);
}
async function fetchPaged(buildQuery, maxRows = 1e4) {
  const rows = [];
  const pageSize = 1e3;
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await buildQuery().range(from, Math.min(from + pageSize - 1, maxRows - 1));
    if (error) throw error;
    rows.push(...data || []);
    if ((data || []).length < pageSize) break;
  }
  return rows;
}
async function loadProductsRanking(limit = 100) {
  const start = new Date(Date.now() - 30 * 864e5).toISOString();
  const bills = await fetchPaged(() => supabase.from("\u0E1A\u0E34\u0E25\u0E02\u0E32\u0E22").select("id,status").gte("date", start).order("date", { ascending: true }), 1e4);
  const validIds = bills.filter((bill) => !/ยกเลิก|คืนสินค้า|หนี้เสีย|ตัดหนี้/i.test(String(bill.status || ""))).map((bill) => bill.id);
  const items = [];
  for (let index = 0; index < validIds.length; index += 100) {
    const ids = validIds.slice(index, index + 100);
    const rows = await fetchPaged(() => supabase.from("\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E1A\u0E34\u0E25").select("bill_id,name,qty,unit,price,total").in("bill_id", ids), 5e3);
    items.push(...rows);
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const item of items) {
    const name = String(item.name || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32").trim();
    const unit = String(item.unit || "\u0E0A\u0E34\u0E49\u0E19");
    const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;
    if (!grouped.has(key)) grouped.set(key, { name, qty: 0, unit, amount: 0 });
    const row = grouped.get(key);
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
    end: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var PDF_META = {
  attendance: { title: "\u0E40\u0E0A\u0E49\u0E32\u0E19\u0E35\u0E49\u0E17\u0E35\u0E21\u0E40\u0E23\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23", subtitle: "\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E1A\u0E1A\u0E2D\u0E48\u0E32\u0E19\u0E07\u0E48\u0E32\u0E22 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E27\u0E25\u0E32\u0E25\u0E07\u0E07\u0E32\u0E19", accent: "#16A34A" },
  sales: { title: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E23\u0E49\u0E32\u0E19\u0E02\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23", subtitle: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E23\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19", accent: "#3B82F6" },
  cash: { title: "\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49", subtitle: "\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21\u0E41\u0E25\u0E30\u0E08\u0E33\u0E19\u0E27\u0E19\u0E18\u0E19\u0E1A\u0E31\u0E15\u0E23\u0E15\u0E32\u0E21\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A", accent: "#059669" },
  debt: { title: "\u0E20\u0E32\u0E1E\u0E23\u0E27\u0E21\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E17\u0E35\u0E48\u0E04\u0E49\u0E32\u0E07\u0E0A\u0E33\u0E23\u0E30", subtitle: "\u0E22\u0E2D\u0E14\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21 \u0E44\u0E21\u0E48\u0E23\u0E27\u0E21\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E2B\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E35\u0E22", accent: "#8B5CF6" },
  delivery: { title: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E21\u0E35\u0E2D\u0E30\u0E44\u0E23\u0E15\u0E49\u0E2D\u0E07\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E1A\u0E49\u0E32\u0E07", subtitle: "\u0E40\u0E23\u0E35\u0E22\u0E07\u0E07\u0E32\u0E19\u0E40\u0E23\u0E48\u0E07\u0E14\u0E48\u0E27\u0E19\u0E01\u0E48\u0E2D\u0E19 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E22\u0E2D\u0E14\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E01\u0E47\u0E1A", accent: "#F97316" },
  products: { title: "\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E02\u0E32\u0E22\u0E14\u0E35 30 \u0E27\u0E31\u0E19", subtitle: "\u0E14\u0E39\u0E07\u0E48\u0E32\u0E22\u0E27\u0E48\u0E32\u0E2D\u0E30\u0E44\u0E23\u0E02\u0E32\u0E22\u0E14\u0E35\u0E41\u0E25\u0E30\u0E17\u0E33\u0E22\u0E2D\u0E14\u0E43\u0E2B\u0E49\u0E23\u0E49\u0E32\u0E19", accent: "#D97706" }
};
function cleanPdfText(value) {
  return String(value ?? "-").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/[\uFE0E\uFE0F\u200D]/g, "").replace(/\s+/g, " ").trim() || "-";
}
function collectFlexText(node, output = []) {
  if (!node || typeof node !== "object") return output;
  const value = node;
  if (value.type === "text" && value.text) output.push(cleanPdfText(value.text));
  for (const key of ["header", "hero", "body", "footer"]) collectFlexText(value[key], output);
  if (Array.isArray(value.contents)) value.contents.forEach((item) => collectFlexText(item, output));
  return output;
}
var pdfClock = (value) => {
  if (!value) return "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E27\u0E25\u0E32";
  const text = String(value);
  const clock = text.match(/^(\d{1,2}:\d{2})/);
  if (clock) return `${clock[1]} \u0E19.`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return `${parsed.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit"
  })} \u0E19.`;
};
async function attendanceSnapshot() {
  const today = todayTH();
  const [{ data: employees, error: employeeError }, { data: attendance, error: attendanceError }] = await Promise.all([
    supabase.from("\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19").select("id,name,lastname,status").eq("status", "\u0E17\u0E33\u0E07\u0E32\u0E19").order("name"),
    supabase.from("\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D").select("employee_id,status,time_in,time_out").eq("date", today)
  ]);
  if (employeeError) throw employeeError;
  if (attendanceError) throw attendanceError;
  const byEmployee = new Map((attendance || []).map((row) => [String(row.employee_id), row]));
  const counts = { \u0E21\u0E32: 0, \u0E21\u0E32\u0E2A\u0E32\u0E22: 0, \u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19: 0, \u0E25\u0E32: 0, \u0E02\u0E32\u0E14: 0 };
  const rows = (employees || []).map((employee) => {
    const attendanceRow = byEmployee.get(String(employee.id));
    const status = attendanceRow ? normStatus(String(attendanceRow.status || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38")) : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E25\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30";
    if (counts[status] !== void 0) counts[status]++;
    return {
      employee,
      attendance: attendanceRow,
      name: `${employee.name || "-"} ${employee.lastname || ""}`.trim(),
      status
    };
  });
  const checked = rows.filter((row) => row.attendance).length;
  const total = rows.length;
  return {
    today,
    rows,
    counts,
    checked,
    total,
    complete: total > 0 && checked === total,
    working: counts.\u0E21\u0E32 + counts.\u0E21\u0E32\u0E2A\u0E32\u0E22 + counts.\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19,
    pending: rows.filter((row) => !row.attendance),
    away: rows.filter((row) => row.status === "\u0E25\u0E32" || row.status === "\u0E02\u0E32\u0E14")
  };
}
function attendancePdfSource(snapshot) {
  const { counts, checked, total, complete, working, pending, away } = snapshot;
  const summary = !total ? "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E17\u0E33\u0E07\u0E32\u0E19 \u0E08\u0E36\u0E07\u0E22\u0E31\u0E07\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49" : complete && away.length === 0 && counts.\u0E21\u0E32\u0E2A\u0E32\u0E22 === 0 ? `\u0E40\u0E0A\u0E49\u0E32\u0E19\u0E35\u0E49\u0E17\u0E35\u0E21\u0E21\u0E32\u0E04\u0E23\u0E1A ${total} \u0E04\u0E19 \u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E23\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22` : complete ? `\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27 ${total} \u0E04\u0E19 \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E21\u0E32\u0E17\u0E33\u0E07\u0E32\u0E19 ${working} \u0E04\u0E19 \u0E41\u0E25\u0E30\u0E21\u0E35 ${away.length} \u0E04\u0E19\u0E17\u0E35\u0E48\u0E25\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E02\u0E32\u0E14` : `\u0E25\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E41\u0E25\u0E49\u0E27 ${checked} \u0E08\u0E32\u0E01 ${total} \u0E04\u0E19 \u0E22\u0E31\u0E07\u0E23\u0E2D\u0E2D\u0E35\u0E01 ${pending.length} \u0E04\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E1B\u0E34\u0E14\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E0A\u0E49\u0E32\u0E19\u0E35\u0E49`;
  const tone = {
    \u0E21\u0E32: "good",
    \u0E21\u0E32\u0E2A\u0E32\u0E22: "warn",
    \u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19: "warn",
    \u0E25\u0E32: "neutral",
    \u0E02\u0E32\u0E14: "danger",
    "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E25\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30": "warn"
  };
  return {
    ...PDF_META.attendance,
    summary,
    metrics: [
      { label: "\u0E25\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E41\u0E25\u0E49\u0E27", value: `${checked}/${total} \u0E04\u0E19`, tone: complete ? "good" : "warn" },
      { label: "\u0E21\u0E32\u0E17\u0E33\u0E07\u0E32\u0E19", value: `${working} \u0E04\u0E19`, tone: "good" },
      { label: "\u0E21\u0E32\u0E2A\u0E32\u0E22 / \u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19", value: `${counts.\u0E21\u0E32\u0E2A\u0E32\u0E22 + counts.\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19} \u0E04\u0E19`, tone: counts.\u0E21\u0E32\u0E2A\u0E32\u0E22 + counts.\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19 ? "warn" : "neutral" },
      { label: "\u0E25\u0E32 / \u0E02\u0E32\u0E14", value: `${counts.\u0E25\u0E32 + counts.\u0E02\u0E32\u0E14} \u0E04\u0E19`, tone: counts.\u0E02\u0E32\u0E14 ? "danger" : "neutral" }
    ],
    sections: [{
      title: "\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E21\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49",
      description: "\u0E21\u0E2D\u0E07\u0E41\u0E16\u0E27\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E47\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E43\u0E04\u0E23\u0E21\u0E32\u0E41\u0E1A\u0E1A\u0E44\u0E2B\u0E19 \u0E41\u0E25\u0E30\u0E25\u0E07\u0E40\u0E27\u0E25\u0E32\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E44\u0E23",
      rows: snapshot.rows.map((row, index) => ({
        title: `${index + 1}. ${row.name}`,
        detail: row.attendance ? `\u0E40\u0E02\u0E49\u0E32\u0E07\u0E32\u0E19 ${pdfClock(row.attendance.time_in)}  \u2022  \u0E2D\u0E2D\u0E01\u0E07\u0E32\u0E19 ${pdfClock(row.attendance.time_out)}` : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E02\u0E2D\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49",
        value: row.status,
        tone: tone[row.status] || "neutral"
      }))
    }],
    note: complete ? "\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19\u0E41\u0E25\u0E49\u0E27 \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30\u0E2A\u0E48\u0E07\u0E2A\u0E23\u0E38\u0E1B\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E02\u0E49\u0E32\u0E01\u0E25\u0E38\u0E48\u0E21\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07\u0E15\u0E48\u0E2D\u0E27\u0E31\u0E19" : `\u0E04\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25: ${pending.map((row) => row.name).join(", ") || "\u0E44\u0E21\u0E48\u0E21\u0E35"}`
  };
}
async function debtPdfSource() {
  const { data, error } = await supabase.from("customer").select("id,name,phone,debt_amount,credit_limit").gt("debt_amount", 0).order("debt_amount", { ascending: false }).limit(500);
  if (error) throw error;
  const customers = (data || []).filter((customer) => Number(customer.debt_amount || 0) > 9e-3);
  const total = customers.reduce((sum, customer) => sum + Number(customer.debt_amount || 0), 0);
  const highest = customers[0];
  const average = customers.length ? total / customers.length : 0;
  return {
    ...PDF_META.debt,
    summary: customers.length ? `\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E21\u0E35\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E04\u0E49\u0E32\u0E07\u0E0A\u0E33\u0E23\u0E30 ${customers.length} \u0E23\u0E32\u0E22 \u0E23\u0E27\u0E21 ${baht2(total)} \u0E42\u0E14\u0E22\u0E40\u0E23\u0E35\u0E22\u0E07\u0E23\u0E32\u0E22\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E22\u0E2D\u0E14\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14` : "\u0E22\u0E2D\u0E14\u0E40\u0E22\u0E35\u0E48\u0E22\u0E21 \u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E04\u0E49\u0E32\u0E07\u0E0A\u0E33\u0E23\u0E30\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A",
    metrics: [
      { label: "\u0E22\u0E2D\u0E14\u0E04\u0E49\u0E32\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", value: baht2(total), tone: total ? "danger" : "good" },
      { label: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49", value: `${customers.length} \u0E23\u0E32\u0E22`, tone: customers.length ? "warn" : "good" },
      { label: "\u0E22\u0E2D\u0E14\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14", value: highest ? baht2(highest.debt_amount) : "\u0E3F0", tone: highest ? "danger" : "good" },
      { label: "\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22\u0E15\u0E48\u0E2D\u0E23\u0E32\u0E22", value: baht2(average), tone: "neutral" }
    ],
    sections: [{
      title: "\u0E40\u0E23\u0E35\u0E22\u0E07\u0E15\u0E32\u0E21\u0E22\u0E2D\u0E14\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21",
      rows: customers.map((customer, index) => ({
        title: `${index + 1}. ${customer.name || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32"}`,
        detail: customer.phone ? `\u0E42\u0E17\u0E23 ${customer.phone}` : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E42\u0E17\u0E23\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A",
        value: baht2(customer.debt_amount),
        tone: index < 3 ? "danger" : "neutral"
      }))
    }],
    note: "\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E43\u0E0A\u0E49\u0E22\u0E2D\u0E14\u0E25\u0E39\u0E01\u0E2B\u0E19\u0E35\u0E49\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19 \u0E41\u0E25\u0E30\u0E44\u0E21\u0E48\u0E23\u0E27\u0E21\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E22\u0E49\u0E32\u0E22\u0E44\u0E1B\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E2B\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E41\u0E25\u0E49\u0E27"
  };
}
async function deliveryPdfSource() {
  const data = await fetchPaged(() => supabase.from("\u0E1A\u0E34\u0E25\u0E02\u0E32\u0E22").select("id,bill_no,total,method,status,customer_name,delivery_mode,delivery_status,delivery_date,delivery_phone,delivery_address,deposit_amount,received,change,return_info").order("delivery_date", { ascending: true }), 2e4);
  const pending = data.map((bill) => ({ bill, state: deliveryState(bill) })).filter((row) => !["cancel", "done", "self"].includes(row.state));
  const priority = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3 };
  pending.sort((a, b) => priority[a.state] - priority[b.state]);
  const labels = {
    overdue: "\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14",
    today: "\u0E2A\u0E48\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49",
    upcoming: "\u0E07\u0E32\u0E19\u0E16\u0E31\u0E14\u0E44\u0E1B",
    unscheduled: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E27\u0E31\u0E19"
  };
  const collect = pending.reduce((sum, row) => sum + billRemaining(row.bill), 0);
  const count = (state) => pending.filter((row) => row.state === state).length;
  const tone = { overdue: "danger", today: "warn", unscheduled: "warn", upcoming: "neutral" };
  return {
    ...PDF_META.delivery,
    summary: pending.length ? `\u0E21\u0E35\u0E07\u0E32\u0E19\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E04\u0E49\u0E32\u0E07 ${pending.length} \u0E07\u0E32\u0E19 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E07\u0E07\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E44\u0E27\u0E49\u0E1A\u0E19\u0E2A\u0E38\u0E14 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E17\u0E35\u0E21\u0E40\u0E23\u0E34\u0E48\u0E21\u0E08\u0E32\u0E01\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E23\u0E48\u0E07\u0E14\u0E48\u0E27\u0E19\u0E01\u0E48\u0E2D\u0E19` : "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E07\u0E32\u0E19\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E04\u0E49\u0E32\u0E07 \u0E17\u0E35\u0E21\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E40\u0E04\u0E25\u0E35\u0E22\u0E23\u0E4C\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27",
    metrics: [
      { label: "\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14", value: `${count("overdue")} \u0E07\u0E32\u0E19`, tone: count("overdue") ? "danger" : "good" },
      { label: "\u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E48\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49", value: `${count("today")} \u0E07\u0E32\u0E19`, tone: count("today") ? "warn" : "neutral" },
      { label: "\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E23\u0E2D\u0E2D\u0E22\u0E39\u0E48", value: `${pending.length} \u0E07\u0E32\u0E19`, tone: pending.length ? "warn" : "good" },
      { label: "\u0E22\u0E2D\u0E14\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E01\u0E47\u0E1A", value: baht2(collect), tone: collect ? "good" : "neutral" }
    ],
    sections: ["overdue", "today", "unscheduled", "upcoming"].map((state) => ({
      title: labels[state],
      rows: pending.filter((row) => row.state === state).map(({ bill }, index) => ({
        title: `${index + 1}. #${bill.bill_no || String(bill.id).slice(0, 8)}  ${bill.customer_name || "\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B"}`,
        detail: [
          bill.delivery_date ? `\u0E19\u0E31\u0E14 ${thDate2(bill.delivery_date)}` : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E19\u0E31\u0E14\u0E27\u0E31\u0E19",
          bill.delivery_phone ? `\u0E42\u0E17\u0E23 ${bill.delivery_phone}` : "",
          bill.delivery_address || ""
        ].filter(Boolean).join("  \u2022  "),
        value: billRemaining(bill) > 0 ? `\u0E40\u0E01\u0E47\u0E1A ${baht2(billRemaining(bill))}` : "\u0E0A\u0E33\u0E23\u0E30\u0E41\u0E25\u0E49\u0E27",
        tone: tone[state] || "neutral"
      }))
    })),
    note: "\u0E44\u0E21\u0E48\u0E23\u0E27\u0E21\u0E1A\u0E34\u0E25\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 \u0E04\u0E37\u0E19\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 \u0E07\u0E32\u0E19\u0E23\u0E31\u0E1A\u0E40\u0E2D\u0E07 \u0E41\u0E25\u0E30\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E41\u0E25\u0E49\u0E27"
  };
}
async function cashPdfSource(key) {
  const response = await cashAssistantReports([key]);
  const report = response.reports?.[key];
  if (!report) {
    const bubble = response.bubbles?.[0];
    if (!bubble) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19");
    const rows = collectFlexText(bubble).filter((value, index, all) => value && value !== all[index - 1]);
    return {
      ...PDF_META[key],
      summary: "\u0E2A\u0E23\u0E38\u0E1B\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01",
      metrics: [],
      sections: [{ title: "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14", rows: rows.map((title) => ({ title })) }]
    };
  }
  if (key === "sales") {
    if (!report.open) return {
      ...PDF_META.sales,
      summary: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01 \u0E08\u0E36\u0E07\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E23\u0E2D\u0E1A\u0E43\u0E2B\u0E49\u0E2A\u0E23\u0E38\u0E1B",
      metrics: [
        { label: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22", value: "\u0E3F0", tone: "neutral" },
        { label: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E1A\u0E34\u0E25", value: "0 \u0E1A\u0E34\u0E25", tone: "neutral" }
      ],
      sections: [{ title: "\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33", rows: [{ title: "\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E43\u0E19\u0E42\u0E1B\u0E23\u0E41\u0E01\u0E23\u0E21\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E02\u0E32\u0E22" }] }]
    };
    const methods = Array.isArray(report.methods) ? report.methods : [];
    const recent = Array.isArray(report.recent) ? report.recent : [];
    const cash = methods.find((item) => item.method === "\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14")?.amount || 0;
    const transfer = methods.find((item) => item.method === "\u0E42\u0E2D\u0E19\u0E40\u0E07\u0E34\u0E19")?.amount || 0;
    return {
      ...PDF_META.sales,
      summary: report.billCount ? `\u0E15\u0E31\u0E49\u0E07\u0E41\u0E15\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A \u0E23\u0E49\u0E32\u0E19\u0E02\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27 ${report.billCount} \u0E1A\u0E34\u0E25 \u0E23\u0E27\u0E21 ${baht2(report.total)} \u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E01\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E04\u0E37\u0E2D ${methods[0]?.method || "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"}` : "\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27 \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1A\u0E34\u0E25\u0E02\u0E32\u0E22\u0E43\u0E19\u0E23\u0E2D\u0E1A\u0E19\u0E35\u0E49",
      metrics: [
        { label: "\u0E22\u0E2D\u0E14\u0E02\u0E32\u0E22\u0E23\u0E27\u0E21", value: baht2(report.total), tone: "good" },
        { label: "\u0E08\u0E33\u0E19\u0E27\u0E19\u0E1A\u0E34\u0E25", value: `${report.billCount} \u0E1A\u0E34\u0E25`, tone: "neutral" },
        { label: "\u0E23\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14", value: baht2(cash), tone: "good" },
        { label: "\u0E23\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E42\u0E2D\u0E19", value: baht2(transfer), tone: "neutral" }
      ],
      sections: [
        {
          title: "\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E32\u0E17\u0E32\u0E07\u0E44\u0E2B\u0E19\u0E1A\u0E49\u0E32\u0E07",
          rows: methods.map((item) => ({
            title: item.method || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07",
            detail: `${item.count || 0} \u0E1A\u0E34\u0E25`,
            value: baht2(item.amount),
            tone: item.method === "\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E14" ? "good" : "neutral"
          }))
        },
        {
          title: "\u0E1A\u0E34\u0E25\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
          rows: recent.map((item) => ({
            title: `#${item.billNo || "-"}`,
            detail: `\u0E02\u0E32\u0E22\u0E40\u0E21\u0E37\u0E48\u0E2D ${item.time || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E27\u0E25\u0E32"}`,
            value: baht2(item.amount)
          }))
        }
      ],
      note: `\u0E23\u0E2D\u0E1A\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E14\u0E22 ${report.openedBy || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"} \u0E40\u0E21\u0E37\u0E48\u0E2D ${report.openedLabel || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E27\u0E25\u0E32"}`
    };
  }
  if (!report.open) return {
    ...PDF_META.cash,
    summary: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01 \u0E08\u0E36\u0E07\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E08\u0E33\u0E19\u0E27\u0E19\u0E18\u0E19\u0E1A\u0E31\u0E15\u0E23\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A",
    metrics: [{ label: "\u0E22\u0E2D\u0E14\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01", value: "\u0E3F0", tone: "neutral" }],
    sections: [{ title: "\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33", rows: [{ title: "\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E41\u0E25\u0E30\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E07\u0E34\u0E19\u0E15\u0E31\u0E49\u0E07\u0E15\u0E49\u0E19" }] }]
  };
  const denominations = Array.isArray(report.denominations) ? report.denominations : [];
  return {
    ...PDF_META.cash,
    summary: report.hasNegative ? `\u0E23\u0E30\u0E1A\u0E1A\u0E04\u0E33\u0E19\u0E27\u0E13\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E44\u0E14\u0E49 ${baht2(report.total)} \u0E41\u0E15\u0E48\u0E1E\u0E1A\u0E08\u0E33\u0E19\u0E27\u0E19\u0E15\u0E34\u0E14\u0E25\u0E1A\u0E1A\u0E32\u0E07\u0E0A\u0E19\u0E34\u0E14 \u0E04\u0E27\u0E23\u0E19\u0E31\u0E1A\u0E40\u0E07\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A` : `\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01\u0E15\u0E32\u0E21\u0E23\u0E30\u0E1A\u0E1A\u0E23\u0E27\u0E21 ${baht2(report.total)} \u0E41\u0E22\u0E01\u0E08\u0E33\u0E19\u0E27\u0E19\u0E18\u0E19\u0E1A\u0E31\u0E15\u0E23\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D\u0E44\u0E27\u0E49\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E27\u0E08\u0E19\u0E31\u0E1A\u0E07\u0E48\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27`,
    metrics: [
      { label: "\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21\u0E15\u0E32\u0E21\u0E23\u0E30\u0E1A\u0E1A", value: baht2(report.total), tone: report.hasNegative ? "danger" : "good" },
      { label: "\u0E0A\u0E19\u0E34\u0E14\u0E40\u0E07\u0E34\u0E19\u0E17\u0E35\u0E48\u0E21\u0E35", value: `${denominations.length} \u0E0A\u0E19\u0E34\u0E14`, tone: "neutral" },
      { label: "\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E15\u0E23\u0E27\u0E08\u0E19\u0E31\u0E1A", value: report.hasNegative ? "\u0E04\u0E27\u0E23\u0E15\u0E23\u0E27\u0E08" : "\u0E1B\u0E01\u0E15\u0E34", tone: report.hasNegative ? "danger" : "good" },
      { label: "\u0E1C\u0E39\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E2D\u0E1A", value: report.openedBy || "-", tone: "neutral" }
    ],
    sections: [{
      title: "\u0E19\u0E31\u0E1A\u0E41\u0E1A\u0E07\u0E04\u0E4C\u0E41\u0E25\u0E30\u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D",
      rows: denominations.map((item) => ({
        title: item.label,
        detail: `${item.count} \u0E43\u0E1A / \u0E40\u0E2B\u0E23\u0E35\u0E22\u0E0D`,
        value: baht2(item.amount),
        tone: item.count < 0 ? "danger" : "neutral"
      }))
    }],
    note: report.note
  };
}
async function signedPdfUrl(path, downloadName) {
  const signed = await supabase.storage.from(ASSISTANT_BUCKET).createSignedUrl(path, 86400, { download: downloadName });
  if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error("\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E25\u0E34\u0E07\u0E01\u0E4C PDF \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
  return signed.data.signedUrl;
}
async function cachedPdfUrl(key) {
  await ensureAssistantBucket();
  const fileName = `${key}-${todayTH()}.pdf`;
  const path = `reports/${fileName}`;
  const listed = await supabase.storage.from(ASSISTANT_BUCKET).list("reports", {
    limit: 10,
    search: fileName
  });
  const item = (listed.data || []).find((entry) => entry.name === fileName);
  const updatedAt = item?.updated_at || item?.created_at;
  if (!updatedAt || Date.now() - new Date(updatedAt).getTime() > 5 * 60 * 1e3) return null;
  return { url: await signedPdfUrl(path, fileName), path, fileName };
}
function pdfDownloadBubble(key, url, cached) {
  const meta = PDF_META[key];
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: meta.accent,
      paddingAll: "20px",
      spacing: "xs",
      contents: [
        { type: "text", text: meta.title, color: "#FFFFFF", weight: "bold", size: "xl", wrap: true },
        { type: "text", text: "\u0E08\u0E31\u0E14\u0E17\u0E33\u0E40\u0E1B\u0E47\u0E19 PDF \u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14", color: "#FFFFFFCC", size: "sm", wrap: true }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      spacing: "md",
      contents: [
        { type: "text", text: cached ? "\u0E43\u0E0A\u0E49\u0E44\u0E1F\u0E25\u0E4C\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E27\u0E49\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19 5 \u0E19\u0E32\u0E17\u0E35 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E25\u0E14\u0E01\u0E32\u0E23\u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E0B\u0E49\u0E33" : "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C\u0E43\u0E2B\u0E21\u0E48\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27", color: "#64748B", size: "sm", wrap: true },
        {
          type: "button",
          height: "sm",
          style: "primary",
          color: meta.accent,
          action: { type: "uri", label: "\u0E40\u0E1B\u0E34\u0E14 / \u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 PDF", uri: url }
        }
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      backgroundColor: "#F8FAFC",
      contents: [{ type: "text", text: "\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E21\u0E35\u0E2D\u0E32\u0E22\u0E38 24 \u0E0A\u0E31\u0E48\u0E27\u0E42\u0E21\u0E07 \u2022 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E04\u0E31\u0E48\u0E19", size: "xxs", color: "#94A3B8", align: "center" }]
    }
  };
}
async function createReportPdfBubble(key) {
  if (!VALID_KEYS.has(key)) throw new Error("\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E25\u0E37\u0E2D\u0E01");
  const cached = await cachedPdfUrl(key);
  if (cached) return pdfDownloadBubble(key, cached.url, true);
  let bytes;
  if (key === "products") {
    bytes = await createProductsRankingPdf(await loadProductsRanking(100), await getThaiFontBytes());
  } else {
    const source = key === "attendance" ? attendancePdfSource(await attendanceSnapshot()) : key === "debt" ? await debtPdfSource() : key === "delivery" ? await deliveryPdfSource() : await cashPdfSource(key);
    bytes = await createMinimalReportPdf(source, await getThaiFontBytes());
  }
  await ensureAssistantBucket();
  const fileName = `${key}-${todayTH()}.pdf`;
  const path = `reports/${fileName}`;
  const uploaded = await supabase.storage.from(ASSISTANT_BUCKET).upload(
    path,
    new Blob([bytes], { type: "application/pdf" }),
    {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "300"
    }
  );
  if (uploaded.error) throw uploaded.error;
  return pdfDownloadBubble(key, await signedPdfUrl(path, fileName), false);
}
async function cashAssistantReports(selected) {
  const wanted = selected.filter((key) => key === "sales" || key === "cash");
  if (!wanted.length) return { bubbles: [], reports: {} };
  const response = await fetch(`${SUPABASE_URL}/functions/v1/line-cashdrawer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ action: "assistant-report", selected: wanted })
  });
  if (!response.ok) throw new Error(`line-cashdrawer ${response.status}: ${await response.text()}`);
  const body = await response.json();
  return {
    bubbles: Array.isArray(body.bubbles) ? body.bubbles : [],
    reports: body.reports && typeof body.reports === "object" ? body.reports : {}
  };
}
function attendanceNotificationBubble(snapshot) {
  const { counts, total, working } = snapshot;
  const dateLabel = (/* @__PURE__ */ new Date(`${snapshot.today}T05:00:00+07:00`)).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const lateNames = snapshot.rows.filter((row) => row.status === "\u0E21\u0E32\u0E2A\u0E32\u0E22" || row.status === "\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19");
  const awayNames = snapshot.rows.filter((row) => row.status === "\u0E25\u0E32" || row.status === "\u0E02\u0E32\u0E14");
  const allReady = working === total && !lateNames.length;
  const message = allReady ? "\u0E40\u0E0A\u0E49\u0E32\u0E19\u0E35\u0E49\u0E17\u0E35\u0E21\u0E21\u0E32\u0E04\u0E23\u0E1A \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E23\u0E34\u0E48\u0E21\u0E07\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A" : `\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27 \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E21\u0E32\u0E17\u0E33\u0E07\u0E32\u0E19 ${working} \u0E08\u0E32\u0E01 ${total} \u0E04\u0E19`;
  const statusRow = (label, value, color) => ({
    type: "box",
    layout: "horizontal",
    margin: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#64748B", flex: 1 },
      { type: "text", text: `${value} \u0E04\u0E19`, size: "sm", color, weight: "bold", align: "end", flex: 0 }
    ]
  });
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#ECFDF5",
      paddingAll: "20px",
      spacing: "xs",
      contents: [
        { type: "text", text: "\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E0A\u0E49\u0E32\u0E19\u0E35\u0E49\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27", color: "#047857", weight: "bold", size: "xl" },
        { type: "text", text: dateLabel, color: "#65A30D", size: "sm" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      spacing: "none",
      contents: [
        { type: "text", text: message, size: "md", color: "#172033", weight: "bold", wrap: true },
        { type: "text", text: `\u0E21\u0E32\u0E17\u0E33\u0E07\u0E32\u0E19 ${working}/${total} \u0E04\u0E19`, size: "xxl", color: "#16A34A", weight: "bold", margin: "md" },
        { type: "separator", margin: "lg" },
        statusRow("\u0E21\u0E32\u0E15\u0E32\u0E21\u0E40\u0E27\u0E25\u0E32", counts.\u0E21\u0E32, "#16A34A"),
        statusRow("\u0E21\u0E32\u0E2A\u0E32\u0E22", counts.\u0E21\u0E32\u0E2A\u0E32\u0E22, "#D97706"),
        statusRow("\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19", counts.\u0E04\u0E23\u0E36\u0E48\u0E07\u0E27\u0E31\u0E19, "#0891B2"),
        statusRow("\u0E25\u0E32", counts.\u0E25\u0E32, "#7C3AED"),
        statusRow("\u0E02\u0E32\u0E14", counts.\u0E02\u0E32\u0E14, "#DC2626"),
        ...lateNames.length ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "\u0E04\u0E19\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E23\u0E39\u0E49\u0E44\u0E27\u0E49", size: "xs", color: "#B45309", weight: "bold", margin: "md" },
          { type: "text", text: lateNames.map((row) => `${row.name} (${row.status})`).join(", "), size: "sm", color: "#92400E", wrap: true, margin: "xs" }
        ] : [],
        ...awayNames.length ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E21\u0E32\u0E17\u0E33\u0E07\u0E32\u0E19", size: "xs", color: "#B91C1C", weight: "bold", margin: "md" },
          { type: "text", text: awayNames.map((row) => `${row.name} (${row.status})`).join(", "), size: "sm", color: "#DC2626", wrap: true, margin: "xs" }
        ] : []
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      backgroundColor: "#F8FAFC",
      contents: [{ type: "text", text: `\u0E2A\u0E23\u0E38\u0E1B\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E1A \u2022 ${(/* @__PURE__ */ new Date()).toLocaleTimeString("th-TH", {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit"
      })} \u0E19.`, size: "xxs", color: "#94A3B8", align: "center" }]
    }
  };
}
async function claimAttendanceNotification(date) {
  await ensureAssistantBucket();
  const path = `notifications/attendance-${date}.json`;
  const storage = supabase.storage.from(ASSISTANT_BUCKET);
  const existing = await storage.download(path);
  if (!existing.error && existing.data) {
    try {
      const marker = JSON.parse(await existing.data.text());
      const age = Date.now() - new Date(marker.createdAt || 0).getTime();
      if (marker.status === "sent" || age < 10 * 60 * 1e3) return { claimed: false, path };
      await storage.remove([path]);
    } catch (_) {
      await storage.remove([path]);
    }
  }
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const claimed = await storage.upload(
    path,
    new Blob([JSON.stringify({ status: "pending", createdAt })], { type: "application/json" }),
    {
      contentType: "application/json",
      upsert: false,
      cacheControl: "0"
    }
  );
  if (claimed.error) {
    if (/already|duplicate|exist/i.test(claimed.error.message || "")) return { claimed: false, path };
    throw claimed.error;
  }
  return { claimed: true, path };
}
async function finishAttendanceNotification(path, sent) {
  const storage = supabase.storage.from(ASSISTANT_BUCKET);
  if (!sent) {
    await storage.remove([path]);
    return;
  }
  await storage.upload(
    path,
    new Blob([JSON.stringify({ status: "sent", createdAt: (/* @__PURE__ */ new Date()).toISOString() })], { type: "application/json" }),
    {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0"
    }
  );
}
async function handleLineWebhook(raw, req) {
  const signature = req.headers.get("x-line-signature") || "";
  if (!await validSignature(raw, signature)) {
    console.error("[assistant] rejected: invalid LINE signature or LINE_CHANNEL_SECRET");
    return new Response("invalid signature", { status: 401 });
  }
  const body = JSON.parse(raw);
  console.log(`[assistant] webhook accepted: ${(body.events || []).length} event(s)`);
  for (const event of body.events || []) {
    if (event.type !== "join" && event.type !== "message" && event.type !== "postback") continue;
    const sourceId = event.source?.groupId || event.source?.roomId || event.source?.userId || "";
    const eventText = event.type === "message" && event.message?.type === "text" ? String(event.message.text || "").replace(/\s+/g, "").toLowerCase() : "";
    const isWakeWord = WAKE_WORDS.has(eventText);
    console.log(`[assistant] event=${event.type} sourceType=${event.source?.type || "-"} source=${sourceId || "-"} text=${eventText || "-"}`);
    if (LINE_GROUP_ID && sourceId !== LINE_GROUP_ID) {
      console.warn(`[assistant] LINE_GROUP_ID mismatch: received=${sourceId || "-"} configured=${LINE_GROUP_ID}`);
      if ((isWakeWord || event.type === "join") && event.replyToken) {
        await reply(event.replyToken, [{
          type: "text",
          text: `\u0E01\u0E25\u0E38\u0E48\u0E21\u0E19\u0E35\u0E49\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E04\u0E23\u0E31\u0E1A

\u0E19\u0E33 Group ID \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E44\u0E1B\u0E43\u0E2A\u0E48\u0E43\u0E19 Supabase Secret \u0E0A\u0E37\u0E48\u0E2D LINE_GROUP_ID \u0E41\u0E25\u0E49\u0E27\u0E01\u0E14 Save

${sourceId}`
        }]);
      }
      continue;
    }
    if (!event.replyToken) continue;
    if (event.type === "join") {
      console.log(`[assistant] joined source=${sourceId}; sending native Flex menu`);
      await reply(event.replyToken, [{
        type: "flex",
        altText: "\u0E40\u0E21\u0E19\u0E39\u0E25\u0E31\u0E14\u0E23\u0E49\u0E32\u0E19 SK - \u0E41\u0E15\u0E30\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19 PDF",
        contents: menuBubble()
      }]);
      continue;
    }
    if (event.type === "message" && event.message?.type === "text") {
      if (isWakeWord) {
        console.log("[assistant] menu requested; replying with native Flex menu");
        await reply(event.replyToken, [{
          type: "flex",
          altText: "\u0E40\u0E21\u0E19\u0E39\u0E25\u0E31\u0E14\u0E23\u0E49\u0E32\u0E19 SK - \u0E41\u0E15\u0E30\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E1A\u0E23\u0E32\u0E22\u0E07\u0E32\u0E19 PDF",
          contents: menuBubble()
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
            type: "flex",
            altText: `${PDF_META[item].title} - \u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 PDF`,
            contents: bubble
          }]);
        } catch (error) {
          console.error(`[assistant] PDF ${item} failed`, error);
          await reply(event.replyToken, [{
            type: "text",
            text: `\u0E2A\u0E23\u0E49\u0E32\u0E07 PDF ${PDF_META[item]?.title || item} \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E04\u0E23\u0E31\u0E1A
${error instanceof Error ? error.message : String(error)}`
          }]);
        }
      }
    }
  }
  return new Response("ok", { status: 200 });
}
async function attendanceDatabaseNotification(body) {
  if (body.table && String(body.table) !== "\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D") {
    return new Response("ignored non-attendance webhook", { status: 200 });
  }
  const snapshot = await attendanceSnapshot();
  if (!snapshot.total) return new Response("no active employees", { status: 200 });
  if (!snapshot.complete) {
    return new Response(`attendance ${snapshot.checked}/${snapshot.total}; waiting`, { status: 200 });
  }
  const marker = await claimAttendanceNotification(snapshot.today);
  if (!marker.claimed) return new Response("attendance summary already sent today", { status: 200 });
  try {
    await push([{
      type: "flex",
      altText: `\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27: \u0E21\u0E32\u0E17\u0E33\u0E07\u0E32\u0E19 ${snapshot.working}/${snapshot.total} \u0E04\u0E19`,
      contents: attendanceNotificationBubble(snapshot)
    }]);
    await finishAttendanceNotification(marker.path, true);
    return new Response("attendance summary sent", { status: 200 });
  } catch (error) {
    await finishAttendanceNotification(marker.path, false);
    throw error;
  }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "sk-line-pdf-menu" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }
    const raw = await req.text();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch (_) {
    }
    if (Array.isArray(body.events)) return await handleLineWebhook(raw, req);
    return await attendanceDatabaseNotification(body);
  } catch (error) {
    console.error(error);
    return new Response(`error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
});
