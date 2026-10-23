function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function filterArticles(articles, query = '', category = 'All') {
  const q = String(query).trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  return articles.filter((a) => {
    if (category !== 'All' && a.category !== category) return false;
    if (terms.length === 0) return true;

    const searchable = (a.name + ' ' + a.category + ' ' + (a.body || '')).toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function highlightMatches(text, query = '') {
  if (!text) return [];
  const q = String(query).trim();
  if (!q) return [{ text, match: false }];

  const terms = q.split(/\s+/).filter(Boolean).map(escapeRegex);
  if (terms.length === 0) return [{ text, match: false }];

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  const segments = [];
  for (const part of parts) {
    if (!part) continue;
    const isMatch = terms.some((term) => new RegExp(`^${term}$`, 'i').test(part));
    segments.push({ text: part, match: isMatch });
  }

  return segments;
}

export function snippetWithMatch(text, query = '', maxLength = 160) {
  if (!text) return '';
  const q = String(query).trim().toLowerCase();
  if (!q || text.length <= maxLength) {
    return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
  }

  const terms = q.split(/\s+/).filter(Boolean);
  let firstIdx = -1;
  const lower = text.toLowerCase();
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) {
    return text.slice(0, maxLength) + '…';
  }

  const start = Math.max(0, firstIdx - Math.floor(maxLength / 3));
  const end = Math.min(text.length, start + maxLength);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}
