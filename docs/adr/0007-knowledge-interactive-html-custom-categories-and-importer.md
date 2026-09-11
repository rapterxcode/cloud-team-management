# Support interactive HTML pages, dynamic categories, and document importer in Knowledge Hub

## Context
The Knowledge Hub previously supported only plain Markdown articles with four hardcoded category strings (`Guides`, `Runbooks`, `Onboarding`, `Meeting notes`). Team members could not upload existing documentation files, could not create new operational categories, and could not author interactive technical pages (such as live architecture diagrams, FinOps calculators, or runbook web widgets).

## Decisions
1. **Interactive HTML/CSS/JS Page Format with Sandboxed iFrame**:
   Knowledge articles now support a `format` attribute (`markdown` or `html`). For HTML format articles, content is rendered inside an isolated `<iframe>` with strict sandbox attributes (`sandbox="allow-scripts allow-downloads"` without `allow-same-origin`). This allows full client-side JavaScript, CSS styling, and interactivity while preventing scripts from accessing parent DOM, session cookies, or authorization tokens, adhering strictly to ISO 27001 application security standards.
2. **Dynamic Category Management**:
   We transition from static hardcoded category arrays to dynamic `KnowledgeCategory` entities. Users can create, customize, and manage categories. The Knowledge Hub filter toolbar updates dynamically based on active categories.
3. **Knowledge Document Importer**:
   A client-side file importer allows drag-and-drop or file selection of `.md`, `.html`, and `.txt` files. The importer extracts article title, content, and format automatically for review before persisting.
4. **Editor Formatting Toolbar**:
   The article editor introduces an actionable markdown and HTML helper toolbar (headings, bold/italic, code blocks, lists, checklists, tables, callout alerts) alongside real-time live preview for both Markdown and HTML formats.
