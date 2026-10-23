# เอกสารความต้องการด้านผลิตภัณฑ์ฉบับสมบูรณ์ (Product Requirements Document - PRD)

**ชื่อผลิตภัณฑ์:** Cloud Team Management (CTM)  
**รหัสเอกสาร:** CTM-PRD-FINAL-v1.0  
**สถานะเอกสาร:** 🟢 อนุมัติใช้งาน (Approved & Verified — Gate B/C)  
**วันที่อนุมัติ:** 11 กันยายน 2026 (อัปเดตล่าสุด: 23 ตุลาคม 2026)  
**อ้างอิงเอกสารที่เกี่ยวข้อง:** [`BRD.md`](./BRD.md), [`DRAFT_PRD.md`](./DRAFT_PRD.md), [`CONTEXT.md`](../CONTEXT.md)  

---

## 1. ภาพรวมผลิตภัณฑ์และพจนานุกรมคำศัพท์กลาง (Product Overview & Ubiquitous Language)

**Cloud Team Management (CTM)** คือเว็บแอปพลิเคชันแบบ Single-Page Application (SPA) สำหรับทีมวิศวกรคลาวด์และผู้ตรวจสอบภายใน เพื่อใช้บริหารโครงการ ตารางเวลาแกนต์ งานประจำวัน คลังความรู้ หลักฐานการตรวจสอบตามมาตรฐาน **ISO/IEC 27001** และ **ธนาคารแห่งประเทศไทย (BOT)** รวมถึงระบบผู้ช่วยอัจฉริยะ **AI Copilot (Gemini 3.8 Flash)**

### พจนานุกรมคำศัพท์กลางของระบบ (Ubiquitous Language)
เพื่อให้การสื่อสารระหว่างทีมธุรกิจ ทีมออกแบบ และโค้ดในระบบตรงกันทั้งหมด จึงกำหนดนิยามคำศัพท์มาตรฐานตาม [`CONTEXT.md`](../CONTEXT.md) ดังนี้:

| คำศัพท์มาตรฐาน (Term) | ความหมายในระบบ (Definition) | คำที่หลีกเลี่ยง (Avoid) |
|---|---|---|
| **Workspace** | หน่วยองค์กรย่อยที่แยกข้อมูลโครงการ งาน และบทความออกจากกัน (เช่น Engineering, Security, Governance) | Organization, Tenant, Room |
| **User / Team** | บุคลากรที่มีบัญชีเข้าใช้งานในระบบ โดยหน้า **Team** คือมุมมองแสดงรายชื่อ `User` ทั้งหมด | Member (ในฐานะชื่อตารางผู้ใช้), Assignee |
| **Deactivated User** | ผู้ใช้ที่ถูกปิดสถานะ (`isActive = false`) ล็อกอินไม่ได้และไม่ปรากฏในตัวเลือกมอบหมายงานใหม่ แต่ข้อมูลและงานเดิมยังอยู่ครบ | Deleted User |
| **Project Department** | ชื่อแผนกหรือทีมย่อยที่ดูแลโครงการ (เก็บในฟิลด์ `Project.department`) | `Project.team` |
| **Task Owner** | ผู้รับผิดชอบหลักของงาน 1 คน (อ้างอิง Foreign Key ไปยัง `users.id`) | Assignee |
| **Task SOP** | บทความใน Knowledge Hub ที่ผูกเข้ากับงานเพื่อเป็นคู่มือขั้นตอนปฏิบัติงาน | Task Guide |
| **Change Authorization** | การผูกงานเข้ากับเอกสารอนุมัติการเปลี่ยนแปลง (`CR` หรือ `CC`) ของโครงการเพื่อรองรับการตรวจ Audit | Approval Note |
| **Project Document** | ไฟล์หลักฐานการตรวจสอบที่แนบกับโครงการโดยตรง แยกตามเกณฑ์ ISO 27001 / ธปท. | Project Attachment |
| **Attachment** | ไฟล์แนบประกอบบทความในคลังความรู้ (Knowledge Article) | — |
| **Workload** | เปอร์เซ็นต์ภาระงานของผู้ใช้ คำนวณสดจากจำนวนงานที่ยังไม่เสร็จ (`status !== 'Done'`) | Bandwidth, Story Points |

---

## 2. บทบาทผู้ใช้งานและตารางสิทธิ์ (User Personas & RBAC Matrix)

### 2.1 สิทธิ์ระดับแพลตฟอร์ม (Global Platform Roles)
- **`admin`:** บริหารจัดการระบบทั้งหมด สร้าง/ระงับผู้ใช้ รีเซ็ตรหัสผ่าน เข้าถึงทุก Workspace และดูบันทึก Audit/Access Logs
- **`member`:** ผู้ใช้งานมาตรฐาน เข้าถึงและทำงานใน Workspace ที่ตนเป็นสมาชิก
- **`auditor`:** ผู้ตรวจสอบความสอดคล้องระดับแพลตฟอร์ม เข้าดูข้อมูล เอกสารหลักฐาน Compliance Matrix และ Logs ได้ทุกส่วนแบบ **Read-Only** (ห้ามแก้ไขข้อมูลทุกชนิด)

### 2.2 สิทธิ์ระดับพื้นที่ทำงาน (Per-Workspace Roles)

| สิทธิ์การดำเนินการใน Workspace | `admin` | `lead` | `member` | `auditor` | `viewer` |
|---|:---:|:---:|:---:|:---:|:---:|
| ดูข้อมูลโครงการ งาน แผนผัง Gantt และบทความ | ✅ | ✅ | ✅ | ✅ | ✅ |
| สร้าง / แก้ไข โครงการ งาน และบทความความรู้ | ✅ | ✅ | ✅ | ❌ | ❌ |
| อัปโหลดเอกสารหลักฐานโครงการ (`ProjectDocument`) | ✅ | ✅ | ✅ | ❌ | ❌ |
| ลบเอกสารหลักฐานโครงการ | ✅ | เฉพาะไฟล์ที่ตนอัปโหลด | เฉพาะไฟล์ที่ตนอัปโหลด | ❌ | ❌ |
| จัดการตั้งค่า Workspace และเพิ่ม/ลดสมาชิกใน Workspace | ✅ | ❌ | ❌ | ❌ | ❌ |
| ดูตาราง Compliance Matrix | ✅ | ✅ | ✅ | ✅ | ✅ |
| ใช้งาน AI Copilot เพื่อร่างบทความหรือสร้าง Task เข้าโครงการ | ✅ | ✅ | ✅ | ❌ (บล็อกการสร้าง) | ❌ |

---

## 3. ข้อกำหนดฟังก์ชันการทำงานและเกณฑ์การตรวจรับ (Functional Requirements & Acceptance Criteria)

### FR-01: ระบบสลับพื้นที่ทำงานและจัดการสิทธิ์ (Multi-Workspace Switcher & RBAC)
- **รายละเอียดฟังก์ชัน:**
  - แถบด้านซ้ายบนมี **Workspace Switcher** แสดงชื่อ Workspace ปัจจุบัน ป้ายกำกับประเภททีม (`engineering`, `infrastructure`, `security`, `governance`, `qa`, `operations`, `custom`) และสีประจำทีม
  - เมื่อสลับ Workspace ระบบจะกรองรายการโครงการ งาน และบทความเฉพาะของ Workspace นั้นทันที (รวมถึงบทความที่เป็น Global)
  - ผู้ดูแลสามารถสร้าง Workspace ใหม่ เพิ่มสมาชิก และกำหนดบทบาท 5 ระดับได้
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-01.1:** เมื่อผู้ใช้สลับ Workspace ข้อมูล `projects`, `tasks`, และ `knowledge` ต้องโหลดใหม่ตาม `workspaceId` ที่เลือก
  - **AC-01.2:** ระบบต้องป้องกันการลบพื้นที่ทำงานเริ่มต้น (`default-workspace-engineering`) และป้องกันการถอดถอน Admin คนสุดท้ายของ Workspace

---

### FR-02: การบริหารพอร์ตโฟลิโอโครงการและแผนผังแกนต์แบบโต้ตอบ (Projects & Interactive Gantt)
- **รายละเอียดฟังก์ชัน:**
  - หน้า **Projects** แสดงการ์ดโครงการพร้อมสถานะ (`New`, `On track`, `At risk`, `Completed`), ปีงบประมาณ (`FY2025`–`FY2027`), แถบความคืบหน้า (`0–100%`), แผนกเจ้าของ (`department`), และกำหนดส่ง (`due`)
  - รองรับการค้นหาชื่อโครงการ กรองตามปีงบประมาณ และกรองตามสถานะ
  - หน้า **Project Workspace** แสดงตาราง **Interactive Gantt Chart** ที่จัดกลุ่มงานตามเฟส (`Planning`, `Development`, `Testing`, `Launch`, `Audit` หรือเฟสที่กำหนดเอง)
  - ผู้ใช้สามารถลากแถบงาน (Drag Bar) เพื่อเลื่อนช่วงวัน ลากขอบซ้าย/ขวาเพื่อยืด/หดระยะเวลา เลื่อนทั้งเฟสพร้อมกัน สลับลำดับงาน/เฟส และปรับระดับการซูมปฏิทินได้
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-02.1:** ระบบต้องคำนวณระยะเวลาแบบนับรวมวันเริ่มต้นและวันสิ้นสุด (Inclusive Duration) ข้ามเดือนและปีได้อย่างถูกต้อง
  - **AC-02.2:** ระบบต้องปฏิเสธวันที่สิ้นสุดที่มาก่อนวันที่เริ่มต้น (Reversed Dates) และปฏิเสธวันที่ไม่มีอยู่จริงในปฏิทิน (เช่น `2026-02-30`) พร้อมแสดงข้อความแจ้งเตือนที่ชัดเจน
  - **AC-02.3:** งานที่ยังไม่ระบุวันที่ (Unscheduled Tasks) ต้องยังคงแสดงในรายชื่อตารางด้านซ้ายโดยไม่มีแถบสีบนปฏิทิน และไม่ทำให้ตารางพัง
  - **AC-02.4:** เมื่อเข้าใช้งานด้วยบทบาท `auditor` ตาราง Gantt ต้องเข้าสู่โหมด `readOnly` ทันที (ไม่สามารถลากแถบ แก้ไข หรือลบงานได้)

---

### FR-03: การจัดการงานเชิงลึก คู่มือ SOP และการเชื่อมโยงใบขอเปลี่ยนแปลง (Task Operational Depth)
- **รายละเอียดฟังก์ชัน:**
  - หน้า **Tasks** แสดงกระดาน Kanban แบ่งตามสถานะ `To do`, `In progress`, และ `Done`
  - การคลิกที่งานจากหน้าใดก็ตาม (Overview, Kanban, หรือ Gantt) จะเปิดหน้าต่างสไลด์ด้านข้าง (**`TaskDrawer`**)
  - ภายใน `TaskDrawer` รองรับการแก้ไขชื่องาน, สถานะ, ความสำคัญ (`Low`, `Medium`, `High`), เฟส, ผู้รับผิดชอบ (`ownerId`), วันที่เริ่มต้น/สิ้นสุด, และบันทึกขั้นตอนการทำงานละเอียด (`description` สูงสุด 10,000 ตัวอักษร)
  - รองรับการผูก **Task SOP** (`sopArticleId`) เข้ากับบทความใน Knowledge Hub และผูก **Change Authorization** (`changeDocumentId`) เข้ากับเอกสารหมวด `CR` หรือ `CC` ของโครงการนั้น
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-03.1:** ตัวเลือกผู้รับผิดชอบงาน (`Owner`) สำหรับงานใหม่ต้องแสดงเฉพาะผู้ใช้ที่ยังเปิดใช้งานอยู่ (`isActive = true`) เท่านั้น
  - **AC-03.2:** เมื่อผูก `sopArticleId` แล้ว ผู้ใช้สามารถคลิกปุ่มเปิดอ่านคู่มือ SOP จากใน `TaskDrawer` ได้ทันที

---

### FR-04: ตารางตรวจสอบความสอดคล้องและธรรมาภิบาลเอกสาร (ISO 27001 / BOT Compliance Matrix)
- **รายละเอียดฟังก์ชัน:**
  - แท็บ **Audit Documents (ISO/BOT)** ในแต่ละโครงการ รองรับการอัปโหลดเอกสารหลักฐานขนาดไม่เกิน 25 MB ต่อไฟล์ พร้อมระบุหมวดหมู่ (`CRA`, `Diagram`, `RBAC`, `CR`, `CC`, `TestEvidence`, `General`) และเลขที่อ้างอิง (เช่น `CR-2026-001`)
  - รองรับการดูตัวอย่างไฟล์ (Preview) สำหรับ PDF, รูปภาพ, ตาราง Excel/CSV และข้อความ รวมถึงการดาวน์โหลดไฟล์
  - หน้า **Compliance and Governance** แสดงตาราง **Compliance Matrix** เปรียบเทียบทุกโครงการกับ 5 เกณฑ์มาตรฐาน:
    1. **Cloud Risk Assessment (`CRA`)**
    2. **Architecture Diagram (`Diagram`)**
    3. **RBAC Matrix (`RBAC`)**
    4. **Change Control (`CR` หรือ `CC`)**
    5. **Test Evidence (`TestEvidence`)**
  - คำนวณคะแนนความพร้อมของโครงการ (Readiness Score %) และตรวจสอบว่างานในเฟส `Launch`/`Deployment` มีการผูกเอกสาร `CR`/`CC` ครบถ้วนหรือไม่ (Deployment Traceability)
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-04.1:** เกณฑ์ข้อ Change Control จะถือว่าผ่านเมื่อโครงการมีเอกสารหมวด `CR` หรือ `CC` อย่างน้อย 1 ฉบับ
  - **AC-04.2:** ปุ่มลบเอกสารจะทำงานได้เฉพาะกรณีที่ผู้กดเป็นผู้อัปโหลดไฟล์นั้นเอง หรือเป็น `admin` เท่านั้น (หากผู้อื่นพยายามเรียก API ลบ ระบบต้องตอบกลับ `403 Forbidden`)

---

### FR-05: คลังความรู้ สารบัญอัตโนมัติ และแอปพลิเคชัน HTML แบบ Sandbox (Knowledge Hub)
- **รายละเอียดฟังก์ชัน:**
  - รองรับบทความ 2 รูปแบบ (`format`):
    1. **`markdown`:** แสดงผล GitHub-Flavored Markdown พร้อมกล่องโค้ดที่มีป้ายระบุภาษาและปุ่มคัดลอกในคลิกเดียว
    2. **`html`:** แสดงผลหน้าเว็บโต้ตอบ (Interactive HTML/CSS/JS) ภายใน `<iframe sandbox="allow-scripts">` พร้อมเทมเพลต CDN สำเร็จรูป (Tailwind CSS, Chart.js, Mermaid, Lucide)
  - หน้าต่างอ่านบทความ (**`ArticleReaderDialog`**) มีสารบัญอัตโนมัติ (**Table of Contents - TOC**) ที่สกัดจากหัวข้อ `H1`–`H3` พร้อมระบบ Scrollspy ไฮไลต์หัวข้อที่กำลังอ่าน, การคำนวณเวลาอ่านโดยประมาณ (Reading Time), และปุ่มสลับโหมดหน้าจอกว้าง (Wide View)
  - หน้าต่างจัดการหมวดหมู่ (**`CategoryManagerDialog`**) ให้ผู้ใช้สร้าง แก้ไขสี/ไอคอน และลบหมวดหมู่ความรู้ได้เอง
  - รองรับการนำเข้าไฟล์ (`.md`, `.html`, `.txt`) จากเครื่องคอมพิวเตอร์เพื่อสร้างบทความพร้อมดึงชื่อเรื่องอัตโนมัติ
  - รองรับการค้นหาบทความแบบทันที พร้อมไฮไลต์คำค้นหา (`<mark>`) ทั้งในชื่อเรื่องและเนื้อหาย่อ
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-05.1:** การสกัดสารบัญ TOC ต้องข้ามเครื่องหมาย `#` ที่อยู่ภายในบล็อกโค้ด (Fenced Code Blocks) เพื่อไม่ให้เกิดหัวข้อปลอม
  - **AC-05.2:** บทความรูปแบบ `html` ต้องรันใน `iframe` ที่ไม่มีสิทธิ์เข้าถึง Cookie หรือ Session ของหน้าเว็บหลัก (ไม่มี `allow-same-origin`)

---

### FR-06: ผู้ช่วยอัจฉริยะ Agentic AI Copilot (Gemini 3.8 Flash)
- **รายละเอียดฟังก์ชัน:**
  - **Full Workspace Context Grounding:** ส่งข้อมูลสดของ Workspace (โครงการ, งาน, สมาชิกและภาระงาน, ทรัพยากรคลาวด์, บทความ, เอกสารโครงการ) ขนาดสูงสุด 1,000,000 ตัวอักษรให้โมเดล `gemini-3.8-flash`
  - **Multimodal Document Intake:** อัปโหลดไฟล์แนบในแชตได้ทั้งรูปภาพ (`.png`, `.jpg`, `.webp`, `.gif`), เอกสาร `.pdf`, ไฟล์ Microsoft Office (`.docx`, `.xlsx`, `.pptx`), อีเมล Outlook (`.msg`, `.eml`), และไฟล์โค้ด/Log
  - **Actionable Proposals (Human-in-the-Loop):**
    - ร่างโครงการใหม่ (`draftProject`)
    - ร่างงานเดี่ยวหรือชุดงานหลายชิ้นพร้อมกัน (`draftTask` / `draftTasks` — Batch Task Proposals) พร้อมจับคู่ชื่อโครงการและชื่อผู้รับผิดชอบเข้ากับ ID จริงในฐานข้อมูลอัตโนมัติ
    - ร่างชุดโครงสร้างพื้นที่ทำงานครบวงจร (`scaffoldWorkspace`)
  - **Executive Workspace Reports:** สร้างรายงานสรุปสำหรับผู้บริหารและกดบันทึกเป็นบทความใน Knowledge Hub ได้ในคลิกเดียว
  - **In-Editor Knowledge Co-Author:** หน้าต่างเขียนบทความมีผู้ช่วย AI วางคู่กันแบบ Side-by-Side พร้อมปุ่มคำสั่งลัด (Draft from title, Expand & detail, Add action checklist, Convert to interactive HTML)
  - **Persistent Conversation Threads:** บันทึกประวัติการสนทนาแยกตามผู้ใช้ลงฐานข้อมูล เรียงกลุ่มตามเวลา (`Today`, `Yesterday`, `Earlier`) เปลี่ยนชื่อหรือลบห้องสนทนาได้
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-06.1:** ข้อมูล Snapshot ที่ส่งให้ AI ต้องไม่มีรหัสผ่าน (`passwordHash`) หรืออีเมลของผู้ใช้ปะปนเด็ดขาด
  - **AC-06.2:** หากไม่ได้ตั้งค่า `GEMINI_API_KEY` ระบบต้องแจ้งสถานะ `enabled: false` (HTTP 503 เมื่อเรียกใช้) และแสดงข้อความแนะนำใน UI อย่างเหมาะสมโดยไม่ทำให้ระบบล่ม

---

### FR-07: ทำเนียบสมาชิก การคำนวณภาระงานอัตโนมัติ และโปรไฟล์ส่วนตัว (Team & User Profile)
- **รายละเอียดฟังก์ชัน:**
  - หน้า **Team** แสดงการ์ดสมาชิก ตำแหน่งงาน และแถบเปอร์เซ็นต์ภาระงานรายสัปดาห์ (**Workload %**)
  - สูตรคำนวณ Workload: นับเฉพาะงานที่ผู้ใช้เป็นเจ้าของและสถานะไม่เท่ากับ `Done` คิดเป็นงานละ **20%** สูงสุดไม่เกิน **100%** (หากเกิน 85% แถบจะเปลี่ยนเป็นสีเตือนภาระงานสูง)
  - หน้า **Admin** (เฉพาะ `admin`) ใช้สร้างผู้ใช้ใหม่ เปลี่ยนชื่อ/ตำแหน่ง รีเซ็ตรหัสผ่าน และระงับสิทธิ์ (`Deactivate` / `Reactivate`)
  - หน้าต่าง **User Profile** ให้ผู้ใช้ทุกคนแก้ไขชื่อและตำแหน่งของตนเอง เปลี่ยนรหัสผ่านใหม่ (โดยต้องยืนยันรหัสผ่านเดิม) และดูประวัติการเข้าสู่ระบบ 5 ครั้งล่าสุดของตนเอง
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-07.1:** ทันทีที่มีการสร้างงานใหม่ มอบหมายงานใหม่ หรือกดเปลี่ยนสถานะงานเป็น `Done` ค่าเปอร์เซ็นต์ Workload ของสมาชิกในหน้า Overview และ Team ต้องอัปเดตตามทันที
  - **AC-07.2:** รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 10 ตัวอักษร

---

### FR-08: ระบบตรวจสอบบันทึกประวัติความปลอดภัยและการเปลี่ยนแปลง (Logs & Audit Viewer)
- **รายละเอียดฟังก์ชัน:**
  - หน้า **Logs & Audit** (เข้าถึงได้เฉพาะ `admin` และ `auditor`) แบ่งออกเป็น 2 แท็บ:
    1. **Audit Trail (Entity Mutations):** แสดงประวัติ `CREATE`, `UPDATE`, `DELETE`, `ROLE_CHANGE`, `UPLOAD` พร้อมผู้กระทำ บทบาท ประเภทข้อมูล และรายละเอียด JSON Diff
    2. **Access Logs (Authentication Events):** แสดงประวัติ `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `PASSWORD_CHANGE` พร้อม IP Address, อุปกรณ์/เบราว์เซอร์ (User-Agent), และสาเหตุที่ล็อกอินไม่สำเร็จ
  - รองรับการค้นหา กรองตามประเภทเหตุการณ์ และปุ่ม **Export CSV** เพื่อนำส่งผู้ตรวจสอบภายนอก
- **เกณฑ์การตรวจรับ (Acceptance Criteria):**
  - **AC-08.1:** ทุกการล็อกอินสำเร็จ ล็อกอินผิดรหัสผ่าน ล็อกเอาต์ หรือเปลี่ยนรหัสผ่าน ต้องถูกบันทึกลง `access_logs` เสมอ
  - **AC-08.2:** ห้ามมีปุ่มหรือ API ใดๆ ที่สามารถลบหรือแก้ไขข้อมูลใน `access_logs` และ `audit_logs` ได้

---

## 4. ข้อกำหนดที่ไม่ใช่ฟังก์ชันการทำงานและการตั้งค่าผ่าน `.env` (NFRs & Environment Configuration)

| หมวดหมู่ | ข้อกำหนด (Requirement Specification & `.env` Mapping) |
|---|---|
| **Security & Auth** | เข้ารหัสรหัสผ่านด้วย `crypto.scrypt` พร้อม Salt สุ่ม 16 ไบต์และตรวจสอบด้วย `timingSafeEqual`; ใช้คุกกี้ Session (`SESSION_SECRET` จาก `.env`) แบบ `HttpOnly`, `SameSite=Lax`, และ `Secure`; ป้องกัน CSRF ด้วยการตรวจ `Origin` / `Sec-Fetch-Site`; จำกัดการยิง Login ตามค่า `LOGIN_RATE_LIMIT_MAX` (`10` ครั้ง) ภายในหน้าต่างเวลา `LOGIN_RATE_LIMIT_WINDOW_MINUTES` (`15` นาที) ต่อ IP+Email |
| **Performance & Limits** | หน้าเว็บ SPA โหลดและสลับมุมมองได้ภายใน `< 100ms`; ขนาด JSON Payload สูงสุดกำหนดผ่าน `JSON_BODY_LIMIT` (`256kb`); ขนาดไฟล์แนบสูงสุดกำหนดผ่าน `MAX_ATTACHMENT_BYTES` (`26214400` ไบต์ = 25 MB) และสำหรับ Copilot กำหนดผ่าน `MAX_COPILOT_FILE_BYTES` (`15728640` ไบต์ = 15 MB) |
| **AI Copilot Config** | ดึงค่าโมเดลจาก `GEMINI_MODEL` (`gemini-3.8-flash`), คีย์เชื่อมต่อจาก `GEMINI_API_KEY`, และงบประมาณขนาดบริบทจาก `COPILOT_SNAPSHOT_BUDGET` (`1000000` ตัวอักษร) ในไฟล์ [`.env`](../.env) |
| **Bootstrap & Storage** | สร้างบัญชีผู้ดูแลคนแรกอัตโนมัติจาก `ADMIN_EMAIL` (`you@example.com`) และ `ADMIN_PASSWORD` ใน `.env`; จัดเก็บไฟล์แนบลงพาธ `ATTACHMENTS_DIR` (`./attachments-dev` หรือ `/attachments` ในคอนเทนเนอร์) |
| **Reliability & Backup** | คอนเทนเนอร์ทั้งหมดตั้งค่า `restart: unless-stopped` พร้อม Healthcheck บนโดเมน `DOMAIN` (`localhost`) และพอร์ต `PORT` (`3000`); สำรองฐานข้อมูล `POSTGRES_DB` (`ctm`) และไฟล์แนบทุกคืนเวลา `02:00 น.` เก็บย้อนหลัง 14 วัน |
| **Browser & Device Support** | รองรับเบราว์เซอร์สมัยใหม่ (Chrome, Edge, Firefox, Safari) ทั้งบนหน้าจอ Desktop และ Responsive บน Tablet/Mobile |
