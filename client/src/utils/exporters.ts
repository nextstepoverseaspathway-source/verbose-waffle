/**
 * Client-side export & import helpers.
 *
 * Exports are implemented with zero third-party dependencies:
 *  - CSV   : RFC-4180 style comma-separated values
 *  - Excel : an HTML table with the ms-excel mime type (opens natively in Excel)
 *  - PDF   : a print-optimized window (user chooses "Save as PDF")
 *
 * CSV import parses a header row and maps columns onto transaction fields.
 */

type Row = Record<string, string | number | null | undefined>;

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV(rows: Row[], filename: string): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
  ];
  // Prepend BOM so Excel detects UTF-8.
  triggerDownload(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportExcel(rows: Row[], filename: string, sheetName = 'Sheet1'): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${esc(r[h])}</td>`).join('')}</tr>`)
    .join('');
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" />
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
    <x:Name>${esc(sheetName)}</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    </head><body><table border="1">${thead}${tbody}</table></body></html>`;
  triggerDownload(new Blob([html], { type: 'application/vnd.ms-excel' }), filename);
}

export function exportJSON(data: unknown, filename: string): void {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename,
  );
}

/**
 * Open a print-friendly window for the given HTML fragment so the user can
 * save it as a PDF via the browser's print dialog.
 */
export function exportPDF(title: string, innerHtml: string): void {
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body { font-family: 'Inter', system-ui, sans-serif; color: #1e2233; padding: 32px; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .sub { color: #6b7280; margin-bottom: 20px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e6e8f0; }
      th { text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; color: #6b7280; }
      .brand { color: #4f46e5; font-weight: 700; }
    </style></head><body>
    <div class="brand">Smart Savings Tracker</div>
    ${innerHtml}
    <script>window.onload = () => { window.print(); }</script>
    </body></html>`);
  win.document.close();
}

/** Parse a CSV string into row objects keyed by the header row. */
export function parseCSV(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Row = {};
    headers.forEach((h, idx) => (obj[h] = r[idx]?.trim() ?? ''));
    return obj;
  });
}
