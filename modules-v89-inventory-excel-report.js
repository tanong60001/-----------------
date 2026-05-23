(function () {
  'use strict';

  const PRODUCT_TABLE = '\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32';
  const FILE_TAG = 'SK-POS-Stock-Report';
  const UI = {
    export: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19 Excel',
    busy: '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e15\u0e47\u0e2d\u0e01...',
    ready: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e15\u0e47\u0e2d\u0e01 Excel \u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22',
    fail: '\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08',
    missing: '\u0e42\u0e21\u0e14\u0e39\u0e25 Excel \u0e22\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e21\u0e48\u0e1e\u0e23\u0e49\u0e2d\u0e21 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a\u0e2b\u0e19\u0e49\u0e32\u0e41\u0e25\u0e49\u0e27\u0e25\u0e2d\u0e07\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07',
    noCategory: '\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38\u0e2b\u0e21\u0e27\u0e14',
    reportTitle: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32',
    summaryTitle: '\u0e2a\u0e23\u0e38\u0e1b\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e15\u0e47\u0e2d\u0e01',
    stockTitle: '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e41\u0e22\u0e01\u0e15\u0e32\u0e21\u0e2b\u0e21\u0e27\u0e14',
    lowTitle: '\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e43\u0e01\u0e25\u0e49\u0e2b\u0e21\u0e14',
    snapshot: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e2a\u0e23\u0e38\u0e1b\u0e2a\u0e15\u0e47\u0e2d\u0e01',
    printedAt: '\u0e40\u0e27\u0e25\u0e32\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19',
    inStock: '\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e1b\u0e01\u0e15\u0e34',
    lowStock: '\u0e43\u0e01\u0e25\u0e49\u0e2b\u0e21\u0e14',
    outStock: '\u0e2b\u0e21\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01',
    category: '\u0e2b\u0e21\u0e27\u0e14\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32',
  };

  function notify(message, type) {
    if (typeof toast === 'function') toast(message, type || 'info');
    else console.log(message);
  }

  function n(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function cell(value) {
    if (value == null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? value : '';
    return String(value);
  }

  function stockStatus(product) {
    if (n(product.stock) <= 0) return UI.outStock;
    if (n(product.min_stock) > 0 && n(product.stock) <= n(product.min_stock)) return UI.lowStock;
    return UI.inStock;
  }

  function categoryOf(product) {
    return String(product?.category || '').trim() || UI.noCategory;
  }

  async function fetchProducts() {
    if (typeof fetchAllRows === 'function') {
      return fetchAllRows(PRODUCT_TABLE, '*', query => query.order('category').order('name'));
    }
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const result = await db.from(PRODUCT_TABLE).select('*').order('category').order('name').range(from, from + 999);
      if (result.error) throw result.error;
      rows.push(...(result.data || []));
      if (!result.data || result.data.length < 1000) break;
    }
    return rows;
  }

  function baseSheet(sheet, columns, title, subtitle) {
    const last = Math.max(1, columns.length);
    sheet.mergeCells(1, 1, 1, last);
    sheet.getCell(1, 1).value = title;
    sheet.getCell(1, 1).font = { name: 'Arial', bold: true, size: 16, color: { argb: 'FF0F172A' } };
    sheet.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 26;
    sheet.mergeCells(2, 1, 2, last);
    sheet.getCell(2, 1).value = subtitle;
    sheet.getCell(2, 1).font = { name: 'Arial', size: 10, color: { argb: 'FF475569' } };
    sheet.mergeCells(3, 1, 3, last);
    sheet.getCell(3, 1).value = `${UI.printedAt}: ${new Date().toLocaleString('th-TH')}`;
    sheet.getCell(3, 1).font = { name: 'Arial', size: 10, color: { argb: 'FF475569' } };
    sheet.pageSetup = {
      paperSize: 9,
      orientation: columns.length > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: false,
    };
    sheet.pageSetup.printTitlesRow = '1:5';
    sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.25 };
    sheet.headerFooter.oddHeader = `&C&B${UI.reportTitle}`;
    sheet.headerFooter.oddFooter = '&LSK POS&Cหน้า &P จาก &N&R&A';
    sheet.views = [{ state: 'frozen', ySplit: 5 }];
  }

  function header(row) {
    row.height = 22;
    row.eachCell(cellRef => {
      cellRef.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cellRef.alignment = { vertical: 'middle', wrapText: true };
      cellRef.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  }

  function styleRows(sheet, headerRow, lastRow, lastColumn) {
    for (let rowNumber = headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, cellRef => {
        cellRef.font = { name: 'Arial', size: 10 };
        cellRef.alignment = { vertical: 'top', wrapText: true };
        cellRef.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        if (typeof cellRef.value === 'number') {
          cellRef.alignment = { horizontal: 'right', vertical: 'top' };
          cellRef.numFmt = '#,##0.00';
        }
      });
    }
    sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: Math.max(headerRow, lastRow), column: lastColumn } };
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(lastColumn).letter}${Math.max(headerRow, lastRow)}`;
  }

  function inventoryRows(products) {
    const rows = [];
    const groups = new Map();
    products.forEach(product => {
      const category = categoryOf(product);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(product);
    });
    [...groups.keys()].sort((a, b) => a.localeCompare(b, 'th')).forEach(category => {
      const list = groups.get(category).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
      const costValue = list.reduce((sum, product) => sum + n(product.cost) * n(product.stock), 0);
      rows.push({ kind: 'category', values: [`${UI.category}: ${category}`, '', '', '', '', '', '', '', costValue, ''] });
      list.forEach((product, index) => rows.push({
        kind: 'product',
        values: [
          '',
          cell(product.name),
          cell(product.barcode || '-'),
          cell(product.unit || '-'),
          n(product.stock),
          n(product.min_stock),
          stockStatus(product),
          n(product.cost),
          n(product.cost) * n(product.stock),
          n(product.price),
        ],
      }));
    });
    return rows;
  }

  function addSummary(workbook, products) {
    const columns = ['หัวข้อ', 'จำนวน / มูลค่า'];
    const sheet = workbook.addWorksheet('สรุปสต็อก');
    baseSheet(sheet, columns, UI.summaryTitle, `${UI.snapshot}: ${todayKey()}`);
    sheet.addRow([]);
    header(sheet.addRow(columns));
    const rows = [
      ['จำนวนสินค้าทั้งหมด', products.length],
      ['มูลค่าต้นทุนสต็อกรวม', products.reduce((sum, product) => sum + n(product.cost) * n(product.stock), 0)],
      ['สินค้าสต็อกปกติ', products.filter(product => stockStatus(product) === UI.inStock).length],
      ['สินค้าใกล้หมด', products.filter(product => stockStatus(product) === UI.lowStock).length],
      ['สินค้าหมดสต็อก', products.filter(product => stockStatus(product) === UI.outStock).length],
      ['จำนวนหมวดสินค้า', new Set(products.map(categoryOf)).size],
    ];
    rows.forEach(row => sheet.addRow(row));
    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 20;
    styleRows(sheet, 5, sheet.rowCount, 2);
  }

  function addInventory(workbook, products) {
    const columns = ['ลำดับ', 'ชื่อสินค้า', 'บาร์โค้ด', 'หน่วย', 'สต็อก', 'ขั้นต่ำ', 'สถานะ', 'ต้นทุน', 'มูลค่าสต็อก', 'ราคาขาย'];
    const sheet = workbook.addWorksheet('สต็อกตามหมวด');
    baseSheet(sheet, columns, UI.stockTitle, `${UI.snapshot}: ${todayKey()} | ${UI.category}`);
    sheet.addRow([]);
    header(sheet.addRow(columns));
    inventoryRows(products).forEach(row => {
      const added = sheet.addRow(row.values);
      if (row.kind === 'category') {
        sheet.mergeCells(added.number, 1, added.number, 8);
        added.getCell(1).font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF0F172A' } };
        added.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        added.getCell(9).font = { name: 'Arial', bold: true, size: 10 };
        added.eachCell(cellRef => { cellRef.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } } }; });
      }
    });
    let sequence = 0;
    for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const current = sheet.getRow(rowNumber);
      if (current.getCell(2).value) current.getCell(1).value = ++sequence;
    }
    [7, 28, 18, 12, 12, 12, 14, 12, 14, 12].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    styleRows(sheet, 5, sheet.rowCount, columns.length);
  }

  function addLowStock(workbook, products) {
    const rows = products
      .filter(product => stockStatus(product) !== UI.inStock)
      .sort((a, b) => categoryOf(a).localeCompare(categoryOf(b), 'th') || String(a.name || '').localeCompare(String(b.name || ''), 'th'))
      .map(product => [categoryOf(product), cell(product.name), cell(product.barcode || '-'), n(product.stock), n(product.min_stock), cell(product.unit || '-'), stockStatus(product)]);
    const columns = ['หมวดสินค้า', 'ชื่อสินค้า', 'บาร์โค้ด', 'สต็อก', 'ขั้นต่ำ', 'หน่วย', 'สถานะ'];
    const sheet = workbook.addWorksheet('สินค้าใกล้หมด');
    baseSheet(sheet, columns, UI.lowTitle, `${UI.snapshot}: ${todayKey()}`);
    sheet.addRow([]);
    header(sheet.addRow(columns));
    if (rows.length) rows.forEach(row => sheet.addRow(row));
    else sheet.addRow(['ไม่มีสินค้าใกล้หมด']);
    [20, 30, 18, 12, 12, 12, 16].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    styleRows(sheet, 5, sheet.rowCount, columns.length);
  }

  async function buildWorkbook() {
    const products = await fetchProducts();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = FILE_TAG;
    workbook.created = new Date();
    addSummary(workbook, products);
    addInventory(workbook, products);
    addLowStock(workbook, products);
    return workbook;
  }

  async function exportStockExcel() {
    if (!window.ExcelJS) return notify(UI.missing, 'error');
    const buttons = document.querySelectorAll('#page-inv button[onclick*="exportInventory"], #page-actions button[onclick*="exportInventory"]');
    buttons.forEach(button => { button.disabled = true; });
    notify(UI.busy, 'info');
    try {
      const buffer = await (await buildWorkbook()).xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${FILE_TAG}_${todayKey()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify(UI.ready, 'success');
    } catch (error) {
      console.error('[v89] inventory excel report:', error);
      notify(`${UI.fail}: ${error?.message || error}`, 'error');
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function renameButtons() {
    document.querySelectorAll('#page-inv button[onclick*="exportInventory"], #page-actions button[onclick*="exportInventory"]').forEach(button => {
      if (button.dataset.v89StockExcel) return;
      button.dataset.v89StockExcel = '1';
      button.innerHTML = `<i class="material-icons-round">description</i>${UI.export}`;
      button.title = UI.export;
    });
  }

  function boot() {
    window.exportInventory = exportStockExcel;
    try { exportInventory = exportStockExcel; } catch (_) {}
    renameButtons();
    new MutationObserver(renameButtons).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
