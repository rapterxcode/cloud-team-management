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

export const CDN_CSS_PRESETS = [
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    badge: 'Tailwind',
    snippet: '<script src="https://cdn.tailwindcss.com"></script>\n',
    description: 'Modern utility-first styling with Tailwind script CDN',
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap 5',
    badge: 'Bootstrap',
    snippet: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">\n',
    description: 'Component-rich responsive framework from jsDelivr CDN',
  },
  {
    id: 'pico',
    name: 'Pico.css',
    badge: 'Pico',
    snippet: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">\n',
    description: 'Minimal, semantic clean CSS from jsDelivr CDN',
  },
  {
    id: 'fontawesome',
    name: 'Font Awesome 6',
    badge: 'Icons',
    snippet: '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">\n',
    description: 'Scalable vector icons from cdnjs',
  },
  {
    id: 'google-fonts',
    name: 'Inter Font',
    badge: 'Fonts',
    snippet: '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap">\n<style>body { font-family: "Inter", sans-serif; }</style>\n',
    description: 'Inter Google Web Font typography',
  },
];

export function getHtmlTemplateWithCdn(type = 'tailwind') {
  if (type === 'bootstrap') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Health & Operations</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <style>
    body { background-color: #f8fafc; padding: 24px; }
  </style>
</head>
<body>
  <div class="container bg-white p-4 rounded-3 shadow-sm border">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h4 text-primary m-0">Cloud Service Health Monitor</h2>
      <span class="badge bg-success">Healthy</span>
    </div>
    <p class="text-secondary">Interactive status dashboard styled with Bootstrap 5 CDN.</p>
    <div class="alert alert-info" role="alert">
      All automated backup and replication checks passed.
    </div>
    <button class="btn btn-primary" onclick="alert('Verification check executed successfully!')">
      Trigger Health Check
    </button>
  </div>
</body>
</html>`;
  }

  if (type === 'pico') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minimal Operations Guide</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
</head>
<body class="container" style="padding-top: 2rem;">
  <article>
    <header><strong>Cloud Infrastructure Runbook</strong></header>
    <p>Clean semantic documentation styled with Pico.css CDN.</p>
    <button onclick="alert('Audit step verified!')">Confirm Audit Checklist</button>
  </article>
</body>
</html>`;
  }

  // Default: Tailwind CSS
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloud Architecture & Tools</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900 p-6">
  <div class="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-indigo-600">Cloud Operations Tool</h1>
      <span class="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">Active</span>
    </div>
    <p class="text-slate-600 mb-6">Interactive page with live styling powered by Tailwind CSS CDN.</p>
    <div class="p-4 bg-indigo-50 border border-indigo-100 rounded-lg mb-6">
      <h3 class="text-sm font-semibold text-indigo-900 mb-1">Quick Verification</h3>
      <p class="text-xs text-indigo-700">Click below to test interactive scripts in this isolated page.</p>
    </div>
    <button onclick="alert('Verification passed! CDN CSS and scripts are working.')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow transition">
      Run Diagnostics
    </button>
  </div>
</body>
</html>`;
}
