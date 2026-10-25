export function toCsv(headers, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

export function downloadCsv(filename, text) {
  downloadFile(filename, '﻿' + text, 'text/csv;charset=utf-8');
}

export function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
