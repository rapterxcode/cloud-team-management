/**
 * Pure CSV parser supporting standard RFC 4180 features:
 * - Commas within quoted fields
 * - Escaped quotes ("")
 * - Multiline rows
 * - CRLF and LF line breaks
 * - Empty line trimming
 */
export function parseCSV(text = '') {
  const rows = [];
  let row = [];
  let inQuotes = false;
  let cell = '';
  
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const nextChar = raw[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      row.push(cell.trim());
      if (row.length > 0 && row.some(c => c !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      rows.push(row);
    }
  }
  
  return rows;
}
