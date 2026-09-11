# Copilot Conversation History Persistence and Multi-Thread Management

## Context
Previously, AI interactions in Cloud Team Management had divergent persistence behaviors:
1. Knowledge Article Copilot persisted its chat thread inside `knowledge_articles.chat_history`.
2. Workspace Copilot (`/copilot`) kept conversations purely in client React state (`useState<Msg[]>`), causing conversation loss upon closing the panel, navigating views, or refreshing the page.
3. Engineers could not revisit prior analyses, multi-task extraction plans, or executive reports generated in earlier sessions, reducing productivity and continuity.

## Decisions
1. **Dedicated Database Persistence (`copilot_conversations` Table)**:
   We introduce a PostgreSQL entity `CopilotConversation` tied to the authenticated `User`:
   - `id`: UUID primary key.
   - `userId`: Foreign key to `users.id` with `onDelete: Cascade`.
   - `title`: Auto-derived from the initial user prompt (truncated to 60 characters) or custom-named.
   - `messages`: JSONB array storing full message turns (`role`, `content`, `draftTasks`, `createdTaskMap`, `savedAsArticle`).
   - `createdAt` and `updatedAt`: Timestamps for chronologically ordering threads.
2. **RESTful Conversation Lifecycle Endpoints**:
   - `GET /api/copilot/conversations`: Returns user's conversation threads sorted by `updatedAt DESC` (with title, message count, and dates).
   - `GET /api/copilot/conversations/:id`: Fetches a full thread for resuming.
   - `POST /api/copilot/conversations`: Explicitly creates a new thread.
   - `PATCH /api/copilot/conversations/:id`: Renames or appends messages to an existing thread.
   - `DELETE /api/copilot/conversations/:id`: Deletes a thread with ownership verification.
3. **Automatic Seamless Thread Synchronization**:
   When querying `POST /api/copilot`, the frontend passes an optional `conversationId`. The API automatically updates the corresponding thread in PostgreSQL (or creates a new thread if omitted), ensuring zero manual saving friction.
4. **Conversations History Drawer & New Chat**:
   The Workspace Copilot panel features a toggleable "History" drawer:
   - Lists past threads grouped by recency (Today, Previous 7 Days, Older).
   - Allows switching between conversations with one click.
   - Provides a prominent `+ New Chat` button to clear the active view and start a fresh context.
   - Allows deleting unwanted threads.
5. **Knowledge Article Assistant Continuity**:
   The Article Copilot Assistant provides a `+ New Chat / Clear History` button to easily reset or restart conversation threads while working on a specific article.
