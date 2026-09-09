# Cloud Team Management — Source export

Includes the dashboard, project/task management, editable Gantt chart, knowledge management, team directory, cloud resource inventory and reports.

## Requirements

Node.js 22.13.0 or newer and npm. Internet access is required to install dependencies.

## Run locally

Unzip this archive and open a terminal in the cloud-team-management folder:

```sh
npm ci
npm run dev
```

Open the local URL printed by the development server (usually http://localhost:3000).

## Build and preview

```sh
npm run build
npm run start
```

## Checks

```sh
node --test lib/*.test.mjs
npx oxlint app lib
```

The full starter lint command also checks bundled components and has known pre-existing findings. See VALIDATION.md.

## Main files

- app/page.tsx — main workspace and knowledge management
- app/project-gantt.tsx — project Gantt chart and task editor
- app/globals.css — visual styles and responsive layout
- lib/workspace.mjs — task and project state operations
- lib/gantt.mjs — date validation and schedule calculation
- public/ — site assets

## Current behavior

This is a demo application with sample data. Changes live in browser-session React state and reset on reload. There is no shared database, cloud-provider connection or application-managed user account system.

The project uses React, TypeScript, Vinext, Tailwind and Cloudflare tooling. The original Sites hosting configuration is included; its project_id points to the existing Site. Local development does not publish changes to it. Use your own hosting configuration when publishing a separate copy.

Dependencies, generated builds, Git history and local environment files are not included. package-lock.json is included for reproducible installation.

Source commit: 9987b3d29b44fba858181b097676d28e1682a50f
