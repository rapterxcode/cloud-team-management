export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractTableOfContents(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const slug = slugify(text) || 'heading';
      headings.push({
        id: `${slug}-${headings.length}`,
        text,
        level,
      });
    }
  }

  return headings;
}

export function estimateReadingTime(content) {
  if (!content) return '1 min read';
  const clean = content.replace(/<[^>]*>/g, ' ').trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function parseImportedFile(filename, content) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const isHtml = ext === 'html' || ext === 'htm';
  const format = isHtml ? 'html' : 'markdown';

  let name = '';
  if (isHtml) {
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(content);
    if (titleMatch) {
      name = titleMatch[1].trim();
    } else {
      const h1Match = /<h1[^>]*>([^<]+)<\/h1>/i.exec(content);
      if (h1Match) {
        name = h1Match[1].trim();
      }
    }
  } else {
    const h1Match = /^#\s+(.+)$/m.exec(content);
    if (h1Match) {
      name = h1Match[1].trim();
    }
  }

  if (!name) {
    name = filename.replace(/\.[^/.]+$/, '');
  }

  return {
    name,
    body: content,
    format,
  };
}
