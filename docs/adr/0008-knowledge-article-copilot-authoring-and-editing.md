# Knowledge Article AI Copilot Assistant for Authoring and Editing

## Context
Authoring high-quality technical documentation, standard operating procedures (SOPs), incident runbooks, and interactive cloud tools requires significant time and precision. Cloud engineers frequently need to:
1. Draft comprehensive articles from a simple title or brief bullet points.
2. Polish, restructure, and enhance existing drafts with verification checklists, command parameter tables, and formatted code blocks.
3. Convert existing markdown guides into rich interactive HTML pages styled with CDN CSS (Tailwind, Bootstrap).
4. Ground documentation in actual workspace realities (real project names, cloud resource names, and team roles) rather than generic placeholders.

## Decisions
1. **Dedicated AI Authoring Route (`POST /api/copilot/article`)**:
   We expose a dedicated endpoint `POST /api/copilot/article` guarded by authentication. The endpoint accepts `prompt` (the author's instruction), optional `name`, `category`, `format` (`markdown` | `html`), and `currentBody` (the existing draft if modifying).
2. **Dual-Mode Operation (Generation vs Modification)**:
   - **Generation Mode**: When `currentBody` is empty or a new draft is requested, Copilot creates a structured, publication-ready document complete with title recommendation, category, and formatted body.
   - **Modification Mode**: When `currentBody` is provided, Copilot surgically improves, formats, translates, or enhances the existing content per user instructions while preserving the original intent.
3. **Workspace-Grounded Context & Injectable `askLLM`**:
   The backend injects the live workspace snapshot (active projects, cloud resources, and team member directory) into Gemini system instructions, ensuring generated commands and references match the actual team environment. The implementation utilizes the injectable `askLLM` pattern for deterministic unit/integration testing without live API keys.
4. **Human-in-the-Loop Review**:
   AI suggestions do not mutate database records directly. The editor presents the AI-generated proposal with a summary of changes, allowing the engineer to review, apply to the editor with one click, or revert.
5. **Auditor Role Protection (ISO 27001 / BOT SoD)**:
   Users with `role === 'auditor'` are strictly blocked from calling `POST /api/copilot/article` (HTTP 403 Forbidden) and the AI assistant UI is hidden, preserving Segregation of Duties.
