# Cloud Team Management (CTM)

[![Docker](https://img.shields.io/badge/Docker-Compose_v2-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22.13+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Caddy](https://img.shields.io/badge/Caddy-2.0-22B573?logo=caddy&logoColor=white)](https://caddyserver.com/)
[![Gemini](https://img.shields.io/badge/AI_Copilot-Gemini_3.8_Flash-8E75B2?logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Compliance](https://img.shields.io/badge/Compliance-ISO_27001_%7C_BOT_Governance-success)](#regulatory--compliance-alignment)

**Cloud Team Management (CTM)** เป็นระบบศูนย์กลางการบริหารจัดการงานสำหรับทีม Cloud & Platform Engineering ครอบคลุมการติดตามโครงการ (Projects), การจัดการงานพร้อมแผนผังแกนต์แบบโต้ตอบ (Tasks & Interactive Gantt), การกำกับดูแลความสอดคล้องตามมาตรฐาน (Compliance Matrix & Audit Evidence for ISO 27001 / BOT IT Governance), คลังความรู้และคู่มือปฏิบัติงาน (Knowledge Hub with Sandboxed Interactive HTML), การบริหารสมาชิกทีมและบทบาท (Multi-Workspace RBAC), ทรัพยากรคลาวด์ (Cloud Resource Inventory) และผู้ช่วยปัญญาประดิษฐ์อัจฉริยะ (Agentic AI Copilot) ที่ขับเคลื่อนด้วย **Gemini 3.8 Flash**

---

## สารบัญ (Table of Contents)

1. [ภาพรวมระบบ (Overview)](#ภาพรวมระบบ-overview)
2. [ฟีเจอร์หลัก (Key Features)](#ฟีเจอร์หลัก-key-features)
3. [สถาปัตยกรรมระบบ (Architecture & Tech Stack)](#สถาปัตยกรรมระบบ-architecture--tech-stack)
4. [เริ่มต้นใช้งานอย่างรวดเร็ว (Quick Start with Docker)](#เริ่มต้นใช้งานอย่างรวดเร็ว-quick-start-with-docker)
5. [การกำหนดค่า Environment Variables](#การกำหนดค่า-environment-variables)
6. [การรันเพื่อการพัฒนา (Local Development)](#การรันเพื่อการพัฒนา-local-development)
7. [การทดสอบระบบและการตรวจสอบคุณภาพ (Testing & Verification)](#การทดสอบระบบและการตรวจสอบคุณภาพ-testing--verification)
8. [การสำรองและกู้คืนข้อมูล (Backup & Disaster Recovery)](#การสำรองและกู้คืนข้อมูล-backup--disaster-recovery)
9. [การปฏิบัติตามมาตรฐานและกฎหมาย (Regulatory & Compliance Alignment)](#การปฏิบัติตามมาตรฐานและกฎหมาย-regulatory--compliance-alignment)
10. [โครงสร้างไดเรกทอรี (Directory Structure)](#โครงสร้างไดเรกทอรี-directory-structure)
11. [เอกสารอ้างอิงเพิ่มเติม (References & ADRs)](#เอกสารอ้างอิงเพิ่มเติม-references--adrs)

---

## ภาพรวมระบบ (Overview)

CTM ถูกออกแบบมาเพื่อตอบโจทย์องค์กรระดับ Enterprise และสถาบันการเงินที่ต้องการระบบติดตามงานที่ไม่เพียงแค่บริหารโครงการได้คล่องตัว แต่ยังสามารถรองรับการตรวจสอบ (Audit-Ready) ตามมาตรฐานความมั่นคงปลอดภัยสารสนเทศ **ISO/IEC 27001 (A.9, A.12, A.12.1.2)** และเกณฑ์การกำกับดูแลเทคโนโลยีสารสนเทศของ **ธนาคารแห่งประเทศไทย (Bank of Thailand - BOT IT Governance)**

### จุดเด่นที่สำคัญ (Core Highlights)
- **Multi-Workspace & Tenancy:** แบ่งแยกสภาพแวดล้อมและข้อมูลตามสายงาน (เช่น Core Engineering, Infrastructure, Security, Governance, QA, Operations) อย่างเป็นอิสระ
- **Role-Based Access Control (RBAC) & Segregation of Duties (SoD):** กำหนดสิทธิ์ 5 ระดับต่อ Workspace (`admin`, `lead`, `member`, `auditor`, `viewer`) โดย `auditor` และ `viewer` ถูกล็อกสิทธิ์แบบ Read-only ในระดับ API Middleware ป้องกันการแก้ไขข้อมูล
- **End-to-End Change Traceability:** งาน (Task) ทุกงานสามารถเชื่อมโยงกับคู่มือปฏิบัติงาน (Task SOP) และเอกสารอนุมัติการเปลี่ยนแปลง (Change Request / Change Control) เพื่อความโปร่งใสในกระบวนการตรวจสอบ
- **Self-Hosted Data Sovereignty:** ข้อมูลทุกอย่างจัดเก็บอยู่ในเครื่องหรือคลัสเตอร์ขององค์กรเอง (PostgreSQL 17, Local Attachments Volume) ไม่ส่งข้อมูลออกภายนอก เว้นแต่การเรียกใช้ AI Copilot ผ่าน secure snapshot
- **Agentic AI Copilot (Gemini 3.8 Flash):** ผู้ช่วย AI ที่สามารถวิเคราะห์ Context สดของทั้ง Workspace ได้ถึง 1,000,000 ตัวอักษร, รองรับไฟล์แนบหลากหลายรูปแบบ (PDF, Office, Outlook, รูปภาพ), แปลงข้อมูลเป็นชุดงาน (Batch Task Proposal) และสร้างรายงานสำหรับผู้บริหาร (Executive Report) ได้ในคลิกเดียว

---

## ฟีเจอร์หลัก (Key Features)

### 1. การบริหารโครงการและแผนผังแกนต์ (Project & Interactive Gantt)
- **Project Dashboard:** ติดตามสถานะ (On track, At risk, Delayed, Completed), ความคืบหน้า (Progress %), แผนกเจ้าของ (Department) และกำหนดเวลา
- **Interactive Gantt Chart:** ปรับแต่งช่วงเวลาของ Task ด้วยการลากวางหรือแก้ไขวันที่แบบ Real-time พร้อมแสดงแถบสีตามสถานะและความสำคัญ
- **Dynamic Workload Derivation:** คำนวณปริมาณภาระงาน (Workload Capacity %) ของสมาชิกแต่ละคนโดยอัตโนมัติจากจำนวน Task ที่ยังทำไม่เสร็จ
- **Task SOP & Change Authorization:** เชื่อม Task เข้ากับ Knowledge Runbook สำหรับขั้นตอนการทำงาน และเชื่อมกับเอกสาร Change Request (CR/CC) เพื่อรองรับการตรวจ Audit

### 2. ศูนย์เอกสารและการตรวจสอบ (Compliance Matrix & Project Documents)
- **Compliance Matrix:** ตารางประเมินความพร้อมของโครงการเทียบกับ 5 เกณฑ์มาตรฐานกำกับดูแล:
  1. Cloud Risk Assessment (CRA)
  2. Architecture Diagram
  3. RBAC Matrix
  4. Change Control (CR/CC)
  5. Test Evidence
- **Document Governance:** อัปโหลดและจัดหมวดหมู่เอกสารหลักฐาน ลบได้เฉพาะเจ้าของไฟล์หรือ Admin เท่านั้น ผู้ตรวจประเมิน (`auditor`) มีสิทธิ์อ่านอย่างเดียว

### 3. บันทึกประวัติและตรวจสอบความปลอดภัย (Audit Trail & Access Logs)
- **Access Logs:** บันทึกทุกเหตุการณ์การเข้าสู่ระบบ (`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `PASSWORD_CHANGE`) พร้อม IP Address, User-Agent และสาเหตุความล้มเหลว
- **Audit Logs:** บันทึกการเปลี่ยนแปลงข้อมูลทุกรายการ (`CREATE`, `UPDATE`, `DELETE`, `ROLE_CHANGE`) พร้อม Diff ก่อน-หลัง (beforeJson / afterJson) ในรูปแบบ Immutable Append-Only (ไม่มี API แก้ไขหรือลบ log)

### 4. คลังความรู้และคู่มือปฏิบัติการ (Knowledge Base & Interactive Tools)
- **Markdown & Interactive HTML:** รองรับทั้งเอกสารบทความ Markdown ทั่วไป และ HTML/CSS/JS แบบโต้ตอบที่ทำงานใน Sandboxed iframe สำหรับเครื่องมือคำนวณหรือ Dashboard ภายในทีม
- **Table of Contents (TOC):** สร้างสารบัญหัวข้อ (H1–H3) พร้อม Scrollspy อัตโนมัติและโหมดอ่านมุมกว้าง (Wide View)
- **Knowledge Categories & Importer:** จัดหมวดหมู่เอกสารแบบไดนามิก และสามารถนำเข้าไฟล์เอกสาร (`.md`, `.html`, `.txt`) ได้ทันที
- **Persistent Attachments:** จัดเก็บไฟล์แนบประกอบคู่มือลงใน Host Directory อย่างคงทน

### 5. ผู้ช่วยอัจฉริยะ AI Copilot (Gemini 3.8 Flash)
- **Full Workspace Context Snapshot:** ส่งบริบทสดของ Workspace (โครงการ, งาน, สมาชิก, ทรัพยากร, บทความ) ให้ AI ช่วยวิเคราะห์อย่างแม่นยำ (ไม่ส่งรหัสผ่านหรือความลับ)
- **Multimodal Document Intake:** รองรับการอัปโหลดไฟล์ให้ AI อ่านทั้ง Images, PDF, MS Office (`.xlsx`, `.docx`, `.pptx`), Outlook (`.msg`, `.eml`), โค้ด และ Log
- **Batch Task Proposals:** สกัดงานจากบันทึกการประชุมหรือ Runbook ออกมาเป็นรายการงานพร้อมตรวจทานและกดสร้างเข้าสู่ Workspace ได้ในคลิกเดียว
- **Executive Workspace Reports:** สังเคราะห์ภาพรวมความก้าวหน้า ความเสี่ยง และสถานะ Compliance เพื่อ Export เป็น Knowledge Article หรือ Markdown
- **In-Editor Knowledge Co-Author:** ผู้ช่วยเขียนเอกสารแบบ Side-by-Side ปรับแต่งเนื้อหา จัดตาราง Checklist และแปลง Markdown เป็น Interactive HTML

### 6. การจัดการสมาชิกและสิทธิ์ (Team Directory & Profile)
- **Deactivate-Never-Delete Policy:** ผู้ใช้ที่ลาออกจะถูก Deactivate เพื่อไม่ให้สามารถล็อกอินได้ แต่ยังคงรักษา Foreign Key และประวัติการเป็นเจ้าของงานไว้ครบถ้วน
- **Self-Service User Profile:** จัดการข้อมูลส่วนตัว เปลี่ยนรหัสผ่านด้วยการเข้ารหัส `scrypt` พร้อมตรวจสอบประวัติการ Login ล่าสุด 5 ครั้ง
- **Last Active Admin Guard:** มีระบบป้องกันไม่ให้สามารถลดสิทธิ์หรือ Deactivate ผู้ดูแลระบบคนสุดท้ายได้

---

## สถาปัตยกรรมระบบ (Architecture & Tech Stack)

ระบบถูกออกแบบให้ทำงานร่วมกันเป็นคอนเทนเนอร์แบบ Micro-Services ผ่าน Docker Compose:

```mermaid
flowchart TD
    Client["Browser Client\n(React 19 SPA)"] -->|HTTPS :443| Caddy["Caddy 2 Reverse Proxy\n(Auto-TLS & Static File Server)"]
    Caddy -->|"/api/* (Proxy)"| API["Express API Server (Node.js 22)\n(TypeScript + Prisma ORM)"]
    Caddy -->|"/* (Static Files)"| SPA["Web App Build\n(/srv /web/dist)"]
    
    API -->|Session & Queries| PG[("PostgreSQL 17 DB\n(Database: ctm)")]
    API -->|Read / Write| AttVol["Attachments Volume\n(./attachments -> /attachments)"]
    API -->|Context Snapshot & Prompts| Gemini["Google Gemini 3.8 Flash API\n(@google/genai)"]

    Backup["Backup Runner\n(postgres:17)"] -->|"Nightly 02:00 pg_dump"| PG
    Backup -->|"Nightly Tarball"| AttVol
    Backup -->|Persist Dumps| BackupVol[("Backups Volume\n(./backups 14-day retention)")]
```

### รายละเอียดเทคโนโลยี (Tech Stack)

| ส่วนของระบบ (Component) | เทคโนโลยีที่เลือกใช้ (Technology) | รายละเอียดและเวอร์ชัน |
|---|---|---|
| **Frontend UI** | React 19, Vite 8, TypeScript | React 19.2, Tailwind CSS 4, Lucide Icons, Shadcn/Base-UI, Recharts |
| **Backend API** | Node.js 22, Express 5, TypeScript | Node.js 22-slim (ESM), Express 5.1, Prisma ORM 6.16 |
| **Database** | PostgreSQL 17 | Session storage (`connect-pg-simple`), Relations & Foreign Keys |
| **Reverse Proxy** | Caddy 2 | จัดการ Let's Encrypt / ZeroSSL TLS Certificate อัตโนมัติ, Gzip compression |
| **Security & Auth** | Node.js `crypto.scrypt` | Hash รหัสผ่านด้วย Salt สุ่ม 16 bytes พร้อม `timingSafeEqual`, Session Cookie (Secure, HttpOnly, SameSite=Lax) |
| **AI Integration** | Google GenAI SDK (`@google/genai`) | Model: `gemini-3.8-flash` พร้อม Context Snapshot และ Multimodal Parser |
| **File Parser** | `officeparser`, `@kenjiuno/msgreader` | สกัดข้อความจาก Office Docs (.docx, .xlsx, .pptx) และ Outlook (.msg, .eml) |
| **Backup Engine** | Bash + PostgreSQL Client | สำรองข้อมูล Database (`pg_dump -Fc`) + Attachments ทุกคืน เวลา 02:00 น. หมุนเวียน 14 วัน |

---

## เริ่มต้นใช้งานอย่างรวดเร็ว (Quick Start with Docker)

### ความต้องการของระบบ (Prerequisites)
- Linux Server, macOS หรือ Windows พร้อมติดตั้ง **Docker** และ **Docker Compose v2**
- เปิด Port `80` และ `443`
- โดเมนที่ตั้งค่า DNS ชี้มายัง IP เครื่อง Server (หรือใช้ `localhost` สำหรับการทดสอบบนเครื่อง Local)

### ขั้นตอนการรัน Production (Production Deployment)

1. **โคลนคลังโค้ด:**
   ```bash
   git clone <repository-url>
   cd cloud-team-management
   ```

2. **สร้างไฟล์ตั้งค่า Environment:**
   ```bash
   cp .env.example .env
   ```
   แก้ไขค่าในไฟล์ `.env` (ดูรายละเอียดในหัวข้อถัดไป):
   - กำหนดรหัสผ่าน `POSTGRES_PASSWORD` และ `SESSION_SECRET`
   - กำหนดบัญชีผู้ดูแลระบบคนแรก `ADMIN_EMAIL` และ `ADMIN_PASSWORD`
   - กำหนดโดเมน `DOMAIN` ของคุณ

3. **สั่ง Start ระบบผ่าน Docker Compose:**
   ```bash
   docker compose up -d --build
   ```
   > **หมายเหตุ:** ระบบจะทำการ Compile ทั้ง Web SPA, ทำ Prisma Migrate และ Seed ข้อมูลเริ่มต้นโดยอัตโนมัติ พร้อมตั้งค่า Caddy ออกใบรับรอง HTTPS ทันที

4. **เข้าใช้งานระบบ:**
   - เปิดเบราว์เซอร์ไปที่ `https://<YOUR_DOMAIN>`
   - เข้าสู่ระบบด้วย `ADMIN_EMAIL` และ `ADMIN_PASSWORD` ที่คุณกำหนดไว้ใน `.env`

---

## การกำหนดค่า Environment Variables

สร้างไฟล์ `.env` ที่ Root ไดเรกทอรี โดยอ้างอิงจาก [.env.example](file:///Users/pasitc/PH/cloud-team-management/.env.example):

```ini
# โดเมนสาธารณะของระบบ (Caddy จะออกใบรับรอง HTTPS อัตโนมัติ)
# หากทดสอบบนเครื่อง Local ให้ใช้ DOMAIN=localhost
DOMAIN=team.example.com

# รหัสผ่านสำหรับฐานข้อมูล PostgreSQL
POSTGRES_PASSWORD=your-super-strong-postgres-password

# รหัสลับสำหรับลงนาม Session Cookie (แนะนำให้ใช้สตริงสุ่มขนาดยาว)
SESSION_SECRET=your-super-secret-session-key

# บัญชี Admin แรกของระบบ (จะถูกสร้างอัตโนมัติในครั้งแรกที่เปิดระบบ)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-super-secure-admin-password

# การตั้งค่า AI Copilot (เว้นว่างไว้หากยังไม่ต้องการเปิดใช้งาน Copilot)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.8-flash
```

> **ข้อสำคัญเรื่อง Session Cookie:** ระบบตั้งค่า Cookie เป็น `Secure: true` ตามมาตรฐานความปลอดภัย ทำให้เบราว์เซอร์จะส่งคุกกี้ผ่าน **HTTPS** เท่านั้น หากทดสอบบนเครื่อง Local ให้ตั้ง `DOMAIN=localhost` ซึ่ง Caddy จะสร้าง Internal Certificate ที่น่าเชื่อถือให้โดยอัตโนมัติ

---

## การรันเพื่อการพัฒนา (Local Development)

หากต้องการรันเพื่อการพัฒนาและดีบักโดยไม่ผ่าน Caddy:

### 1. รันฐานข้อมูลทดสอบ (PostgreSQL 17)
```bash
docker run -d --name ctm-dev-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ctm \
  -p 5432:5432 \
  postgres:17
```

### 2. รัน Backend API
```bash
cd api
npm install

# กำหนดตัวแปรและรัน Migration
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ctm"
export SESSION_SECRET="dev-session-secret-key"
export ADMIN_EMAIL="admin@demo.local"
export ADMIN_PASSWORD="adminpassword"
export ATTACHMENTS_DIR="../attachments-dev"

npx prisma migrate dev
npm run dev
# API จะเปิดให้บริการที่ http://localhost:3000
```

### 3. รัน Frontend Web (Vite Dev Server)
```bash
cd web
npm install
npm run dev
# Web Dev Server จะเปิดให้บริการที่ http://localhost:5173 พร้อม Proxy ไปยัง http://localhost:3000
```

---

## การทดสอบระบบและการตรวจสอบคุณภาพ (Testing & Verification)

โครงการยึดหลัก **"Evidence over Assertion"** โดยมีชุดการทดสอบครอบคลุมทั้ง API Integration และ Web Logic:

### 1. การรัน API Integration Tests (23/23 Tests Passing)
API Tests จำเป็นต้องใช้ PostgreSQL Instance ทดสอบ:
```bash
# รัน Container Postgres สำหรับทดสอบ
docker run -d --name ctm-test-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=ctm_test -p 5433:5432 postgres:17

# รันชุดทดสอบ API
DATABASE_URL="postgresql://postgres:test@localhost:5433/ctm_test" npm --prefix api test
```

### 2. การรัน Web Unit Tests (9/9 Tests Passing)
ทดสอบ Pure Functions, Workload Calculations และ Date Scheduling:
```bash
npm --prefix web test
```

### 3. ตรวจสอบ Production Build (Typecheck & Compilation)
```bash
npm --prefix api run build
npm --prefix web run build
```

---

## การสำรองและกู้คืนข้อมูล (Backup & Disaster Recovery)

### กลไกการสำรองข้อมูลอัตโนมัติ (Automated Nightly Backup)
Container `backup` จะรันคำสั่งสำรองข้อมูลทุกคืน ณ เวลา 02:00 น. โดย:
1. ดัมป์ฐานข้อมูล PostgreSQL แบบ Custom Binary Format (`pg_dump -Fc`) ไว้ที่ `/backups/YYYY-MM-DD/ctm.dump`
2. บีบอัดไฟล์แนบทั้งหมดจาก `/attachments` เก็บไว้ที่ `/backups/YYYY-MM-DD/attachments.tar.gz`
3. ลบชุดข้อมูลสำรองที่มีอายุเกิน 14 วันโดยอัตโนมัติ

คุณสามารถคัดลอกไฟล์ Backup ออกไปเก็บยัง Storage ภายนอกได้ด้วยคำสั่ง:
```bash
docker compose cp backup:/backups ./offsite-backups
```

### ขั้นตอนการกู้คืนระบบ (Disaster Recovery Runbook)
สมมติว่าต้องการกู้คืนข้อมูลจากวันที่ `2026-09-09`:

1. **หยุดบริการที่เขียนข้อมูล:**
   ```bash
   docker compose stop api caddy
   ```

2. **กู้คืนฐานข้อมูลไปยัง Database ชั่วคราว และสลับฐานข้อมูล:**
   ```bash
   # สร้างฐานข้อมูลสำหรับตรวจสอบความถูกต้อง
   docker compose exec postgres dropdb -U postgres --if-exists ctm_restore
   docker compose exec postgres createdb -U postgres ctm_restore

   # ทำการ Restore จากไฟล์ dump
   docker compose exec backup sh -c 'pg_restore -h postgres -U postgres -d ctm_restore /backups/2026-09-09/ctm.dump'

   # ตรวจสอบจำนวนข้อมูล และทำการสลับชื่อฐานข้อมูล
   docker compose exec postgres psql -U postgres -c "SELECT count(*) FROM projects;" ctm_restore
   docker compose exec postgres psql -U postgres -c "ALTER DATABASE ctm RENAME TO ctm_old; ALTER DATABASE ctm_restore RENAME TO ctm;"
   ```

3. **กู้คืนไฟล์แนบ (Attachments):**
   ```bash
   docker compose run --rm --no-deps -v ctm_backups:/backups:ro api \
     sh -c 'tar -xzf /backups/2026-09-09/attachments.tar.gz -C /attachments'
   ```

4. **เริ่มการทำงานของระบบและตรวจสอบ:**
   ```bash
   docker compose start api caddy
   ```

5. **ลบฐานข้อมูลสำรองเดิมเมื่อมั่นใจว่าระบบทำงานปกติ:**
   ```bash
   docker compose exec postgres dropdb -U postgres ctm_old
   ```

---

## การปฏิบัติตามมาตรฐานและกฎหมาย (Regulatory & Compliance Alignment)

ระบบถูกออกแบบมาให้ตอบสนองเกณฑ์กำกับดูแลด้านเทคโนโลยีสารสนเทศโดยตรง:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Compliance & Governance Control Matrix                │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ มาตรฐานกำกับดูแล    │ การควบคุมภายในระบบ CTM (Platform Controls)            │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ ISO/IEC 27001       │ • แยกสิทธิ์ 5 ระดับต่อ Workspace (`admin`, `lead`,     │
│ Control A.9         │   `member`, `auditor`, `viewer`)                      │
│ (Access Control)    │ • สิทธิ์ `auditor` เป็น Read-only บล็อกระดับ API Guard │
│                     │ • บันทึก AccessLog ทุกการเข้าออก พร้อม IP & User-Agent  │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ ISO/IEC 27001       │ • บันทึก AuditLog ทุก Mutation แบบ Append-only        │
│ Control A.12        │ • ห้ามมี API แก้ไขหรือลบตาราง Log โดยเด็ดขาด           │
│ (Operations Security)• สำรองข้อมูลอัตโนมัติทุกวัน พร้อมทดสอบ DR กู้คืนได้จริง │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ ISO/IEC 27001       │ • งาน (Task) เชื่อมโยงกับเอกสาร Change Request (CR/CC) │
│ Control A.12.1.2    │ • ห้ามลบเอกสารหลักฐานเว้นแต่เจ้าของไฟล์หรือ Admin       │
│ (Change Management) │ • มี Compliance Matrix ตรวจสอบ 5 เสาหลักก่อน Go-Live  │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ BOT IT Governance   │ • Segregation of Duties (SoD) ระหว่างผู้พัฒนาและผู้ตรวจ │
│ (ธนาคารแห่งประเทศไทย)│ • Data Sovereignty: ข้อมูลอยู่ใน On-Prem/Private Cloud │
│                     │ • ตรวจสอบประวัติการเปลี่ยนรหัสผ่านและการเข้าใช้งานได้   │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

---

## โครงสร้างไดเรกทอรี (Directory Structure)

```
cloud-team-management/
├── api/                             # Node.js Express & Prisma Backend
│   ├── prisma/                      # Prisma Schema & Database Seeder
│   │   ├── schema.prisma            # Data models, relations, indices
│   │   └── seed.ts                  # Idempotent seed data
│   ├── src/                         # API Source Code
│   │   ├── copilot/                 # AI Copilot logic (Gemini, context snapshot, parsers)
│   │   ├── routes/                  # Express endpoints (auth, projects, tasks, logs, etc.)
│   │   ├── audit.ts                 # AuditLog mutation logger
│   │   ├── middleware.ts            # RBAC, Workspace & Auditor guards
│   │   ├── passwords.ts             # Crypto scrypt hashing
│   │   └── index.ts                 # API Server entrypoint
│   ├── test/                        # Integration test suite
│   └── Dockerfile                   # Multi-stage API image
├── web/                             # React 19 Frontend SPA
│   ├── src/
│   │   ├── components/              # Reusable UI components (Tailwind + Shadcn)
│   │   ├── lib/                     # Pure business logic, helpers, and tests
│   │   ├── App.tsx                  # Main application router and state
│   │   ├── copilot.tsx              # AI Copilot interactive drawer & chat
│   │   ├── project-gantt.tsx        # Interactive Gantt chart & task drawer
│   │   ├── compliance-matrix.tsx    # ISO 27001 / BOT compliance view
│   │   ├── logs-viewer.tsx          # Audit & Access log viewer
│   │   └── workspace-switcher.tsx   # Workspace switcher & member manager
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.ts               # Vite bundler configuration
├── caddy/                           # Reverse Proxy configuration
│   ├── Caddyfile                    # Automatic HTTPS & proxy rules
│   └── Dockerfile                   # Multi-stage build (Web SPA + Caddy)
├── backup/                          # Disaster recovery & automated backup
│   └── backup.sh                    # Nightly backup script
├── attachments/                     # Host persistent storage for uploaded documents
├── docs/                            # Architectural & Operational Documentation
│   ├── adr/                         # Architecture Decision Records (0001 - 0011)
│   ├── DEPLOY.md                    # Deployment guide & restore rehearsal runbook
│   ├── HANDOFF.md                   # Platform migration handoff notes
│   └── superpowers/                 # Engineering specs and plans
├── compose.yml                      # Production Docker Compose orchestration
├── CONTEXT.md                       # Ubiquitous domain language dictionary
├── AGENTS.md                        # AI Multi-Agent SDLC Guidelines & RACI Matrix
└── VALIDATION.md                    # Verification evidence and test logs
```

---

## เอกสารอ้างอิงเพิ่มเติม (References & ADRs)

- [CONTEXT.md](file:///Users/pasitc/PH/cloud-team-management/CONTEXT.md) — พจนานุกรมศัพท์โดเมน (Ubiquitous Language) ประจำระบบ
- [DEPLOY.md](file:///Users/pasitc/PH/cloud-team-management/docs/DEPLOY.md) — คู่มือการติดตั้งระบบและการกู้คืนข้อมูลแบบละเอียด
- [AGENTS.md](file:///Users/pasitc/PH/cloud-team-management/AGENTS.md) — แนวทางการพัฒนาซอฟต์แวร์แบบ Multi-Agent AI SDLC
- [VALIDATION.md](file:///Users/pasitc/PH/cloud-team-management/VALIDATION.md) — บันทึกหลักฐานผลการทดสอบระบบและเกณฑ์ความปลอดภัย
- **Architecture Decision Records (ADRs):**
  - [ADR 0001](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0001-admin-resets-passwords-no-email-service.md) — Admin Password Reset Policy (No Email Service)
  - [ADR 0002](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0002-dynamic-workload-derivation.md) — Dynamic Workload Derivation
  - [ADR 0003](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0003-auditor-role-for-iso27001-bot-compliance.md) — Auditor Role for ISO 27001 / BOT Compliance
  - [ADR 0004](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0004-task-change-traceability-to-project-documents.md) — Task Change Traceability to Project Documents
  - [ADR 0005](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0005-project-document-deletion-governance.md) — Project Document Deletion Governance
  - [ADR 0006](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0006-knowledge-article-reader-with-toc-and-wide-view.md) — Knowledge Article Reader with TOC and Wide View
  - [ADR 0007](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0007-knowledge-interactive-html-custom-categories-and-importer.md) — Knowledge Interactive HTML & Importer
  - [ADR 0008](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0008-knowledge-article-copilot-authoring-and-editing.md) — Knowledge Article Copilot Authoring & Editing
  - [ADR 0009](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0009-agentic-copilot-batch-tasks-and-executive-reporting.md) — Agentic Copilot Batch Tasks and Executive Reporting
  - [ADR 0010](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0010-copilot-conversation-history-persistence.md) — Copilot Conversation History Persistence
  - [ADR 0011](file:///Users/pasitc/PH/cloud-team-management/docs/adr/0011-multi-workspace-rbac-and-audit-access-logs.md) — Multi-Workspace RBAC and Audit/Access Logs

---

*Cloud Team Management is engineered for high-reliability cloud platform teams adhering to ISO 27001 and BOT IT Governance frameworks.*
