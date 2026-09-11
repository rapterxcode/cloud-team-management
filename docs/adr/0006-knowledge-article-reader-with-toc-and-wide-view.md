# Wide dialog reader with dynamic Table of Contents for Knowledge articles

The Knowledge Hub previously rendered articles inside a narrow, cramped modal dialog (max-width 720px) without structural navigation or reading aids. For technical cloud engineering runbooks, disaster recovery procedures, and standard operating procedures (SOPs), team members had to scroll through extensive documents without situational awareness.

We redesign the Knowledge Article Reader into a wide, dual-column reading dialog (92vw / 1280px with a full-screen maximize toggle) featuring:
1. **Dynamic Table of Contents (TOC)**: A sidebar parser generating hierarchical navigation from Markdown headings (`h1`–`h3`) with smooth scrolling and scrollspy active-heading detection.
2. **Dedicated Operations Sidebar**: Grouping the TOC, article metadata (author, category, reading time), file attachments, and operational actions (Convert to Tasks via Copilot, Edit, Delete).
3. **Compliance & Role Alignment**: Enforcing read-only auditor restrictions by concealing mutation buttons for the `auditor` role under ISO 27001 / BOT segregation of duties.
