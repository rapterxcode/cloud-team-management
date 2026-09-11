# Agentic Workspace Copilot: Batch Task Generation and Executive Reporting

## Context
The Workspace Copilot initially functioned as a single-turn Q&A engine and single-task drafter (`draftTask` tool). However, in real-world cloud engineering operations:
1. Procedures in incident runbooks, project kickoffs, and architecture reviews contain multiple interdependent tasks that need to be scheduled together rather than one by one.
2. Engineering managers and tech leads require concise executive status reports summarizing active projects, blockers, workload distribution, and delivery risks without manually collating data.
3. Copilot responses rendered plain text without markdown hierarchy, formatted tables, or code syntax highlighting, diminishing the readability of complex technical guidance.

## Decisions
1. **Multi-Task & Batch Drafting (`draftTasks` Function Tool)**:
   We extend Gemini function declarations with a `draftTasks` tool returning an array of structured tasks (`tasks: TaskDraft[]`). If the model outputs a single task via legacy `draftTask` or multiple tasks via `draftTasks`, the backend normalizes them into `draftTasks: TaskDraft[]` with project and owner entity resolution.
2. **Batch Task Proposal UI & 1-Click Execution**:
   The frontend Copilot panel presents a unified `BatchTaskDraftCard` that allows editing individual task details (name, project, owner, phase, priority, due date, description) and provides:
   - **"Create All (N) Tasks"**: Executes sequential or parallel creation into PostgreSQL, displaying individual success indicators.
   - **Selective Creation / Dismissal**: Engineers can create specific tasks or dismiss unwanted ones.
3. **Executive Report Quick Actions & Knowledge Hub Export**:
   We add contextual quick action chips (e.g., "📊 สรุปรายงานผู้บริหาร", "⚠️ วิเคราะห์โครงการ At-Risk", "👥 เช็ค Workload ทีม", "📋 สกัด Tasks จาก Runbook"). When Copilot generates a comprehensive report, users can:
   - **"📋 Copy Report"**: Copies formatted markdown to clipboard.
   - **"📄 Save as Knowledge Article"**: Automatically creates a new Knowledge article in the "Guides" or "Architecture" category with the report title and content, linking AI analysis into durable team documentation.
4. **Rich Markdown & Syntax Rendering**:
   We upgrade `copilot.tsx` message rendering to utilize standard Markdown parsing (headings, lists, tables, bold text, code fences with copy buttons) rather than raw text.
5. **Auditor Role Compliance (ISO 27001 / BOT SoD)**:
   Auditors can query Copilot and view reports, but all task creation buttons ("Create All Tasks", "Create Task") and "Save as Knowledge Article" actions are strictly disabled or hidden when `role === 'auditor'`, upholding segregation of duties.
