import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTableOfContents, estimateReadingTime, parseImportedFile } from './toc.mjs';

test('extractTableOfContents extracts H1-H3 headings with correct levels and unique slugs', () => {
  const md = `
# Getting Started
Intro text here.

## Prerequisites
Need node and postgres.

### Installing Dependencies
Run npm install.

## Architecture & Design
Overview of system.

### Database Schema
Prisma models.
`;

  const toc = extractTableOfContents(md);
  assert.equal(toc.length, 5);
  assert.deepEqual(toc[0], { id: 'getting-started-0', text: 'Getting Started', level: 1 });
  assert.deepEqual(toc[1], { id: 'prerequisites-1', text: 'Prerequisites', level: 2 });
  assert.deepEqual(toc[2], { id: 'installing-dependencies-2', text: 'Installing Dependencies', level: 3 });
  assert.deepEqual(toc[3], { id: 'architecture-design-3', text: 'Architecture & Design', level: 2 });
  assert.deepEqual(toc[4], { id: 'database-schema-4', text: 'Database Schema', level: 3 });
});

test('extractTableOfContents ignores headings inside fenced code blocks', () => {
  const md = `
# Real Heading 1

\`\`\`bash
# This is a bash comment, NOT a heading
echo "hello"
## Another comment
\`\`\`

## Real Heading 2
`;

  const toc = extractTableOfContents(md);
  assert.equal(toc.length, 2);
  assert.equal(toc[0].text, 'Real Heading 1');
  assert.equal(toc[1].text, 'Real Heading 2');
});

test('extractTableOfContents handles empty text and markdown without headings', () => {
  assert.deepEqual(extractTableOfContents(''), []);
  assert.deepEqual(extractTableOfContents('Just some paragraphs with **bold** and *italics*.'), []);
});

test('estimateReadingTime calculates minutes based on word count', () => {
  // Short content (< 200 words) -> 1 min read
  assert.equal(estimateReadingTime('Short runbook note with five words.'), '1 min read');

  // ~450 words -> 3 min read
  const longText = Array(450).fill('word').join(' ');
  assert.equal(estimateReadingTime(longText), '3 min read');

  // HTML content strips tags before calculating
  const htmlText = '<div>' + Array(200).fill('<span>word</span>').join(' ') + '</div>';
  assert.equal(estimateReadingTime(htmlText), '1 min read');
});

test('parseImportedFile extracts title, format, and content for markdown and html', () => {
  // Markdown file
  const mdContent = '# Deployment Runbook\n\nStep 1: Check health';
  const mdParsed = parseImportedFile('deploy-guide.md', mdContent);
  assert.equal(mdParsed.name, 'Deployment Runbook');
  assert.equal(mdParsed.format, 'markdown');
  assert.equal(mdParsed.body, mdContent);

  // HTML file with <title>
  const htmlContent = '<!DOCTYPE html><html><head><title>CIDR Calculator</title></head><body><h1>Widget</h1></body></html>';
  const htmlParsed = parseImportedFile('calc.html', htmlContent);
  assert.equal(htmlParsed.name, 'CIDR Calculator');
  assert.equal(htmlParsed.format, 'html');
  assert.equal(htmlParsed.body, htmlContent);

  // Fallback to filename when no heading or title is present
  const txtContent = 'Some raw notes without headers';
  const txtParsed = parseImportedFile('incident-notes.txt', txtContent);
  assert.equal(txtParsed.name, 'incident-notes');
  assert.equal(txtParsed.format, 'markdown');
});
