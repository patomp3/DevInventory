# Dev Inventory — UI Design Spec (สำหรับเริ่มเขียน code)

> สถานะ: Draft v1.4 · 2026-11-05 (v1.4: **รายการเป็น Note ชนิดเดียว + ป้าย (design.md D22)** — Editor เดียว, ไม่มี CreateMenu เลือกประเภท, `TypeChip` → `KindChip`, code fence ใน Markdown แทน `CodeBlock` หลายไฟล์ (§6, §7.1–7.5) · v1.3: สรุปขอบเขตเริ่มพัฒนา — ของที่ยังไม่มี mockup แยกเป็น "สร้างจากสเปกได้เลย" กับ "เลื่อนไปเฟสถัดไป" (§1.1) · v1.2: เพิ่ม dialog เชิญด้วยอีเมล / ลิงก์เชิญที่สร้างแล้ว / โอนความเป็นเจ้าของ, ตาราง Admin แสดงอีเมลแทน username · v1.1: เพิ่ม Login / SetPassword / Admin 4 หน้า, ระบบใช้อีเมลอย่างเดียว เชิญด้วยอีเมลเท่านั้น, เผื่อปุ่ม Google เฟส 2)
> เอกสารคู่กับ `design.md` (ระบบ/ข้อมูล/สิทธิ์/ค้นหา) — ไฟล์นี้สรุปฝั่งหน้าจอ
> Mockup ต้นฉบับ: https://claude.ai/artifact/Ps8YdE6BGQuNejw8nkF1x7 (Design canvas "Dev Inventory — UI mockup")

---

## 1. ขอบเขตและสถานะ

**ออกแบบแล้ว (16 หน้า, เฟส 1, dark mode)**

| artboard | หน้า | ใช้ API (ดู design.md §12) |
|---|---|---|
| `Main` | หน้าแรก | `GET /collections/tree`, `GET /items?sort=updated`, `GET /tags` |
| `Search` | ผลค้นหา | `GET /search?q=&kind=&tag=&lang=&in=` |
| `Quick` | ค้นด่วน Ctrl+K | `GET /search/quick?q=` |
| `Detail` | รายละเอียดรายการ | `GET /items/:id`, `GET /items/:id/versions` |
| `Editor` | สร้าง/แก้ไขรายการ | `POST /items`, `PUT /items/:id` (ส่ง `version`) |
| `Dialog` | สิทธิ์ของรายการ | `PATCH /items/:id/visibility` |
| `Login` | เข้าสู่ระบบ (ปกติ + error) | `POST /api/auth/sign-in/email`, `GET /auth/methods` |
| `SetPassword` | รับคำเชิญ ตั้งรหัสผ่าน | `POST /auth/accept-invite` |
| `AdminUsers` | Admin › ผู้ใช้ | `GET/PATCH /admin/users`, `POST /admin/invites`, `POST /admin/users/:id/reset-password` |
| `AdminPrivate` | Admin › รายการส่วนตัว (metadata) | `GET /admin/private-items`, `POST /admin/items/:id/transfer` |
| `InviteDialog` | Dialog › เชิญด้วยอีเมล | `POST /admin/invites` |
| `InviteResult` | Dialog › ลิงก์เชิญที่สร้างแล้ว | (ผลลัพธ์จาก `POST /admin/invites`) |
| `TransferDialog` | Dialog › โอนความเป็นเจ้าของ | `POST /admin/items/:id/transfer` |
| `AdminAudit` | Admin › Audit log | `GET /admin/audit-logs` (+ export CSV) |
| `AdminSettings` | Admin › ตั้งค่า | `GET/PATCH /admin/settings` |

**ที่ยังไม่มี mockup:** แยกเป็น "สร้างจากสเปกได้เลย" และ "เลื่อนไปเฟสถัดไป" ดู §1.1 ด้านล่าง

### 1.1 ขอบเขตเริ่มพัฒนา (ของที่ไม่มี mockup)

**ก) สร้างจากสเปกได้เลย (อยู่ในเฟส 1 แต่ไม่ต้องรอ mockup)** ใช้ component และ token เดิมทั้งหมด ถ้าติดใจค่อยขอ mockup เพิ่มทีหลัง

| ส่วนที่ต้องมี | สเปก |
|---|---|
| ถังขยะ | `DataTable` คอลัมน์ ชื่อ · ป้าย (`KindChip`) · ลบโดย · ลบเมื่อ · "เหลืออีก N วัน" · ปุ่ม "กู้คืน" / "ลบถาวร" (ยืนยันก่อน) · เจ้าของเห็นของตัวเอง Admin เห็นของทุกคนที่ไม่ใช่ส่วนตัว (design.md §10.3) · ว่าง: "ถังขยะว่างเปล่า" |
| History | หน้าเต็ม: ซ้ายรายการเวอร์ชัน (เวอร์ชัน · ใคร · เมื่อไหร่) ขวา diff แบบ side-by-side ของเวอร์ชันที่เลือกเทียบกับก่อนหน้า (ใช้ diff ของ CodeMirror merge หรือไลบรารี diff) · ปุ่ม "กู้เวอร์ชันนี้" สร้างเป็นเวอร์ชันใหม่ ไม่ลบประวัติ (§10.1) |
| Dialog บันทึกชนกัน (409) | รูปแบบ dialog **720** (กว้างกว่า 560 เดิมเพื่อให้ diff 2 คอลัมน์อ่านได้) ตามข้อความใน design.md §10.2: แจ้ง "มีคนแก้รายการนี้ระหว่างที่คุณแก้" + diff ย่อ + 3 ปุ่ม: ใช้ของล่าสุดแล้วแก้ใหม่ · บันทึกทับ · copy ของฉันเก็บไว้ก่อน |
| Dialog ยืนยัน | ใช้ shell เดียวกับ `PermissionDialog`: ชื่อ + ประโยคบอกผลที่ตามมา + ยกเลิก / ปุ่มยืนยัน (ปุ่มทำลายใช้สีแดง `#fca5a5` ขอบแดงโปร่ง ไม่ใช้ accent) ใช้กับ: ปิดบัญชี (บอกว่า session หลุดทันที) · ยกเลิกคำเชิญ · ลบรายการ · ลบถาวร · เปลี่ยนบทบาท |
| รีเซ็ตรหัสผ่าน | dialog ยืนยัน แล้วแสดงรหัสชั่วคราวครั้งเดียวในช่อง mono + ปุ่ม Copy (รูปแบบเดียวกับ `InviteResult`) และตั้ง `must_change_password` |
| Error ของ dialog เชิญ | ข้อความแดงใต้ช่องอีเมล (`role="alert"`, `aria-describedby`): "รูปแบบอีเมลไม่ถูกต้อง" · "อีเมลนี้มีบัญชีอยู่แล้ว" · "อีเมลนี้มีคำเชิญค้างอยู่ ยกเลิกคำเชิญเดิมก่อน" |
| หน้ารายละเอียด | โครง `Detail` เดียวทุกรายการ (D22): ป้าย + สิทธิ์ → ชื่อ → summary → tag → เนื้อหา Markdown (code fence = `CodeBlock`) → ไฟล์แนบ |
| Editor | Editor เดียวทุกรายการ: ป้ายเป็น checkbox เลือกได้หลายป้าย (อย่างน้อย 1) ไม่มีฟอร์มเฉพาะประเภท · ไฟล์แนบใช้ `Dropzone` ในคอลัมน์ขวา (สัปดาห์ 5) |
| สถานะ empty / loading / error | loading = skeleton แถวสูงเท่าของจริง · empty = ไอคอน + ข้อความ 1 บรรทัด + ปุ่มทำสิ่งถัดไป (เช่น "สร้างรายการแรก") · error = `AlertBanner` + ปุ่ม "ลองใหม่" |
| หน้า 404 / ไม่มีสิทธิ์ | ข้อความเดียว "ไม่พบรายการ หรือคุณไม่มีสิทธิ์เข้าถึง" + ปุ่มกลับหน้าแรก (ห้ามแยกสาเหตุ design.md §7.4) |
| Quick search ก่อนพิมพ์ | แสดงรายการที่เปิดล่าสุด 5 รายการ (เก็บใน `localStorage` ของผู้ใช้ ต้องกรองด้วยสิทธิ์ตอนแสดงอีกชั้น) |

**ข) เลื่อนไปหลังเฟส 1 (ไม่ขวางการเริ่มพัฒนา)**

| หัวข้อ | เหตุผล / เมื่อไหร่ |
|---|---|
| หน้าจอมือถือและเมนู sidebar บนจอแคบ | เฟส 1 ใช้งานหลักบนเดสก์ท็อป ทำแบบอ่านอย่างเดียวได้ตอนสัปดาห์ 8 ถ้ามีเวลา |
| Light mode | dev ส่วนใหญ่ใช้ dark ตัวแปรสีเป็น CSS variables อยู่แล้ว เพิ่มทีหลังได้โดยไม่รื้อ |
| หน้า "บัญชีของฉัน" (เปลี่ยนรหัสผ่านเอง) | เฟส 1 ใช้หน้าบังคับเปลี่ยนรหัสผ่านตอน login ครั้งแรก และ Admin รีเซ็ตให้ · หน้านี้ทำพร้อมเฟส 2 |
| ปุ่ม Google, การ์ดวิธีเข้าสู่ระบบ | เฟส 2 (design.md §19, ดู §7.13) |
| Share dialog รายบุคคล/กลุ่ม, ขอสิทธิ์, Pin, แจ้งเตือน | เฟส 2 |

**ข้อควรรู้เกี่ยวกับ mockup**
- ข้อมูลทุกอย่างเป็นตัวอย่าง (ชื่อรายการ ชื่อคน ตัวเลขใน sidebar) ห้ามนำไปเป็น seed จริง
- ยังไม่ได้ตรวจบนหน้าจอจริงทุกขนาด ให้ถือ mockup เป็นแนวทาง ไม่ใช่ pixel spec
- มี "Artboard 1" ว่างในไฟล์ canvas (ระบบสร้างเอง) ไม่เกี่ยวกับงาน

---

## 2. ทิศทางการออกแบบ

- **Dark mode เป็นค่าเริ่มต้น** ความหนาแน่นปานกลาง (แถว 40–44px) สี accent สีเดียว
- Accent ใช้กับ: โลโก้, ปุ่มหลัก, รายการที่เลือกใน sidebar, ไอคอนสิทธิ์ "แก้ไขได้", ไฮไลต์คำค้น, ลิงก์รอง
- ปรับสี accent ได้ 4 ค่า (Tweak ใน mockup): `#f2b84b` (ค่าเริ่มต้น), `#5eead4`, `#7cb7ff`, `#b9a2ff` — ปุ่มบน accent ใช้ตัวอักษร `#1a1305`
- ไม่ใช้อีโมจิในหน้าจอ ใช้ไอคอน SVG แบบเส้น (stroke 1.8) ใน design.md ที่เขียน 🔒/👥/✏️ ให้อ่านเป็นไอคอนเหล่านี้

---

## 3. Design tokens

### 3.1 สี

| token | ค่า | ใช้กับ |
|---|---|---|
| `--bg` | `#0e1013` | พื้นหลังหน้า |
| `--sidebar` | `#12151a` | sidebar, แผงการ์ด, header ของ editor |
| `--surface` | `#161a20` | ปุ่มรอง, ช่องค้นหา, tile |
| `--surface-hover` | `#1b2027` | hover ของแถว/เมนู, พื้น tag chip |
| `--code-bg` | `#0b0d10` | ช่อง input, พื้น code block, tab ที่เลือก |
| `--border` | `#262b33` | เส้นขอบการ์ด/ปุ่ม/input |
| `--border-nav` | `#232830` | เส้นแบ่ง sidebar/header |
| `--border-row` | `#1e232a` | เส้นแบ่งระหว่างแถวในรายการ |
| `--border-strong` | `#2f3640` | ขอบ chip ประเภท, ขอบ `kbd`, ขอบปุ่มบัญชี |
| `--text` | `#e7eaf0` | ข้อความหลัก |
| `--text-secondary` | `#c3cad6` | ข้อความรอง, เมนู |
| `--text-muted` | `#98a2b3` | คำอธิบาย, metadata, label หัวกลุ่ม |
| `--text-faint` | `#7d8797` | เลขบรรทัด, comment ใน code |
| `--accent` | `#f2b84b` | ดูหัวข้อ 2 |
| `--accent-soft` | accent ที่ alpha 0.14 | พื้นรายการที่เลือก, พื้นคำที่ highlight |
| `--on-accent` | `#1a1305` | ตัวอักษรบนพื้น accent |

**สีไวยากรณ์ใน code block (ถ้าใช้ Shiki ให้ทำ theme เองตามนี้):** key/keyword `#7cb7ff` · string `#a5d6a7` · comment `#7d8797` · ตัวอักษรทั่วไป `#c3cad6`

คอนทราสต์ที่ตั้งใจไว้: ข้อความทุกระดับบนพื้น `--bg`/`--sidebar`/`--surface` ผ่าน 4.5:1 (ต่ำสุดคือ `--text-faint` ซึ่งใช้กับเลขบรรทัดและ comment เท่านั้น) ถ้าเปลี่ยน accent ให้ตรวจ `--on-accent` บน accent ใหม่ด้วย

### 3.2 ตัวอักษร

| ใช้กับ | ฟอนต์ | ขนาด / น้ำหนัก |
|---|---|---|
| ทั้งหน้า | IBM Plex Sans Thai (มี Latin ในตัว) | 14px / 400, line-height 1.5 |
| H1 ของหน้า | เดียวกัน | 24px / 600 |
| หัวข้อรายการ (card/result) | เดียวกัน | 15px / 500 |
| label หัวกลุ่ม (h2) | เดียวกัน | 13px / 600 สี muted |
| คำอธิบาย/metadata | เดียวกัน | 12–13px / 400 สี muted |
| code, ชื่อไฟล์, เลขนับ, kbd, chip ประเภท | JetBrains Mono | code 13px (line-height 1.7), นับ/kbd 12px, chip ประเภท 11px |

โหลดผ่าน `next/font/google` (`IBM_Plex_Sans_Thai` น้ำหนัก 400/500/600, `JetBrains_Mono` 400/500, subsets `thai` และ `latin`)

### 3.3 ระยะและรูปทรง

| รายการ | ค่า |
|---|---|
| ความกว้าง sidebar | 264px (`flex: 0 0 264px`) |
| padding หน้าหลัก | 28px 32px 40px |
| gap ระหว่างส่วน | 12 / 16 / 24 / 32 |
| radius | chip 6 · ปุ่ม/แถว 8 · input/tile 10 · การ์ด/แผง 12 · dialog และ palette 14 |
| เงา | ใช้เฉพาะ dialog/palette: `0 24px 60px rgba(0,0,0,.55)` |
| ขนาดที่กดได้ | ปุ่ม/input หลัก ≥ 44px · แถวใน sidebar 40px · chip ตัวกรอง 36–40px |

### 3.4 ตัวอย่างโค้ด (Tailwind v4 + CSS variables)

```css
/* app/globals.css */
:root {
  --bg: #0e1013;           --sidebar: #12151a;       --surface: #161a20;
  --surface-hover: #1b2027; --code-bg: #0b0d10;
  --border: #262b33;       --border-nav: #232830;    --border-row: #1e232a; --border-strong: #2f3640;
  --text: #e7eaf0;         --text-secondary: #c3cad6; --text-muted: #98a2b3; --text-faint: #7d8797;
  --accent: #f2b84b;       --accent-soft: rgb(242 184 75 / 0.14); --on-accent: #1a1305;
}
@theme inline {
  --color-bg: var(--bg);
  --color-sidebar: var(--sidebar);
  --color-surface: var(--surface);
  --color-surface-hover: var(--surface-hover);
  --color-code: var(--code-bg);
  --color-line: var(--border);
  --color-text: var(--text);
  --color-text-2: var(--text-secondary);
  --color-muted: var(--text-muted);
  --color-faint: var(--text-faint);
  --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft);
  --color-on-accent: var(--on-accent);
  --font-sans: var(--font-plex-thai), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
}
```

shadcn/ui: map `--background`→`--bg`, `--card`→`--sidebar`, `--popover`→`--sidebar`, `--primary`→`--accent`, `--primary-foreground`→`--on-accent`, `--muted-foreground`→`--text-muted`, `--border`→`--border`, `--ring`→`--accent`

---

## 4. โครงหน้าจอ (App shell)

```
┌───────────────┬──────────────────────────────────────────────┐
│ Sidebar 264   │ Header: [ช่องค้นหา (ลิงก์/เปิด palette)]  [+ สร้างใหม่] [บัญชี] │
│  โลโก้+ชื่อ WS │──────────────────────────────────────────────│
│  Nav: หน้าแรก  │ Main (padding 28/32)                          │
│       Inbox   │   H1 + คำอธิบาย                                │
│       ของฉัน   │   เนื้อหาหน้า                                  │
│       ถังขยะ   │                                              │
│  Collections  │                                              │
│  (tree ≤3 ชั้น)│                                              │
└───────────────┴──────────────────────────────────────────────┘
```
- ใช้ flex แบบ wrap: sidebar `flex: 0 0 264px`, คอลัมน์หลัก `flex: 999 1 560px; min-width: 0` เมื่อจอแคบ sidebar จะขึ้นไปอยู่บน (เมนูมือถืออยู่ใน §1.1(ข) เลื่อนไปหลังเฟส 1)
- หน้า Editor ไม่มี sidebar (โหมดโฟกัส) มีแถบบนของตัวเองแทน
- Sidebar: รายการที่เลือกอยู่ใช้พื้น `--accent-soft` + ตัวอักษร accent · ตัวเลขข้างชื่อ = จำนวนที่ผู้ใช้**มีสิทธิ์เห็น** (ใช้ predicate เดียวกับค้นหา ดู design.md §7.2) · เยื้องตามชั้น 10 / 28 / 46px

---

## 5. Component inventory

| component | หน้าที่ / สเปก | ใช้ใน |
|---|---|---|
| `AppShell`, `Sidebar`, `CollectionTree` | ตามหัวข้อ 4, tree ซ้อนไม่เกิน 3 ชั้น | ทุกหน้ายกเว้น Editor, Quick, Dialog |
| `SearchTrigger` | ช่องค้นหาในแถบบน มี `kbd` "Ctrl K" กดแล้วเปิด palette | Main, Detail |
| `SearchInput` | input จริง ขอบ accent เมื่อโฟกัส | Search |
| `CreateButton` | ปุ่ม "+ สร้างใหม่" (accent) เปิด Editor ทันที (ไม่มีเมนูเลือกประเภท — D22) · `/new?kind=` ตั้งป้ายเริ่มต้นได้ | แถบบน, Collection |
| `KindChip` | chip mono 11px ขอบ `--border-strong` ข้อความตัวพิมพ์เล็ก: `note` `snippet` `script` `link` (รายการหนึ่งแสดงได้หลาย chip) | รายการ, ผลค้นหา, Detail |
| `VisibilityBadge` | ไอคอน + ข้อความ ตามตาราง §6 | รายการ, ผลค้นหา, Detail, Editor |
| `TagChip` | พื้น `--surface-hover` ตัวอักษร secondary 12px radius 6 (ในกลุ่มกรองใช้ปุ่มสูง 36px + จำนวน) | ทุกหน้า |
| `ItemRow` | แถวในลิสต์: chip ป้าย · ชื่อ · summary · tag · breadcrumb · สิทธิ์ · เจ้าของ+เวลา (ขวา) | Main |
| `ResultCard` | ชื่อ (ไฮไลต์) · breadcrumb · ตัวอย่างข้อความหรือบรรทัด code พร้อมเลขบรรทัด · tag | Search |
| `Highlight` | `<mark>` พื้น accent-soft ตัวอักษร accent radius 3 **ต้อง escape HTML ก่อน** ตามที่ server ส่ง (design.md §8.5) | Search, Quick |
| `FacetList` | แถวสูง 36px ชื่อ + จำนวน (กรองตามสิทธิ์) | Search |
| `CommandPalette` | ใช้ `cmdk` กว้าง 640 แถวสูง 56 แถวที่เลือกพื้น accent-soft ท้ายแถวมีไอคอน Enter · footer บอกปุ่มลัด (↑↓, Enter, Ctrl+Enter) | Quick |
| `CodeBlock` | code fence ใน Markdown: แถบบน "ภาษา · N บรรทัด" + Copy · เลขบรรทัด · เลื่อนแนวนอนเมื่อยาว (ชื่อไฟล์เขียนเป็นตัวหนาเหนือ block เอง) | Detail |
| `CodeEditor` | CodeMirror 6 โหมด Markdown (highlight code fence ตามภาษา) ธีมเดียวกับ CodeBlock · บรรทัดปัจจุบันพื้นขาวจาง 5% | Editor |
| `PermissionRadioGroup` | `fieldset` + radio จริง 4 ตัวเลือก: ตาม Collection / ส่วนตัว / ทีมดูได้ / ทีมแก้ไขได้ (ตัวเลือกที่เลือกขอบ+พื้น accent) | Editor, Dialog |
| `PermissionDialog` | `role="dialog"` `aria-modal` กว้าง 560 + ข้อความเตือนเมื่อสิทธิ์ต่างจาก Collection | Dialog |
| `TagInput` | ช่องรวม chip (× ลบ) + input autocomplete (กรองตามสิทธิ์) | Editor |
| `Dropzone` | กรอบเส้นประ "ลากไฟล์มาวาง หรือเลือกไฟล์ · ไม่เกิน 50 MB" + รายการไฟล์ที่แนบ | Editor |
| `ConcurrentEditBanner` | แถบพื้น accent-soft + จุด accent "ฟ้า กำลังเปิดแก้ไขรายการนี้อยู่…" | Editor |
| `Breadcrumb` | `nav` + ลิงก์ คั่นด้วย › | Detail |
| `InfoCard` | การ์ด `--sidebar` ขอบ `--border` radius 12 padding 14/16 หัวข้อ 13px muted | Detail |
| `AuthCard` | การ์ดกลางหน้ากว้างสูงสุด ~420 บนพื้น `--bg` ไม่มี sidebar มีโลโก้ + ชื่อระบบ | Login, SetPassword |
| `TextField` | `label` + input สูง ≥ 44px พื้น `--code-bg` ขอบ `--border` · โหมด readonly พื้น `--sidebar` ตัวอักษร muted | Login, SetPassword |
| `PasswordField` | input + ปุ่มแสดง/ซ่อน (`aria-label`, 44×42) | Login, SetPassword |
| `PasswordRules` | รายการกฎรหัสผ่าน ผ่านแล้วเป็นสีเขียวอ่อน + ไอคอนติ๊ก (ไม่พึ่งสีอย่างเดียว) | SetPassword |
| `AlertBanner` | `role="alert"` ขอบ/พื้นสีแดงโปร่ง ไอคอน + หัวข้อ + บรรทัดรอง | Login |
| `AdminShell`, `AdminNav` | sidebar ของ Admin: ผู้ใช้ / รายการส่วนตัว / Audit log / ตั้งค่า + ลิงก์กลับหน้าหลัก | Admin ทุกหน้า |
| `DataTable` | ตารางจริง (`<table>`, `<th scope>`) หัวตาราง muted 12px แถวสูง ≥ 56 เส้นแบ่ง `--border-row` เลื่อนแนวนอนในจอแคบ | Admin |
| `StatusPill` | จุดสี + ข้อความ: ใช้งาน / ปิดบัญชี / รอรับเชิญ | AdminUsers |
| `RoleChip` | Admin / Member | AdminUsers |
| `RowActions` | ปุ่มเมนูแถว (เปลี่ยนบทบาท / รีเซ็ตรหัสผ่าน / ปิดบัญชี) หรือปุ่มเดี่ยว (เปิดบัญชี / ยกเลิกคำเชิญ / โอน) | Admin |
| `InviteLinkCard` | อีเมลที่เชิญ + บทบาท + ลิงก์ (mono, ตัดท้ายด้วย …) + ปุ่ม Copy · แสดงลิงก์เต็มได้ครั้งเดียวตอนสร้าง | AdminUsers |
| `FilterBar` | ตัวกรอง action / ผู้ใช้ / ช่วงวันที่ + Export CSV | AdminAudit |
| `SettingsCard` | กลุ่มการตั้งค่า + ปุ่มบันทึก · ค่าที่แก้ไม่ได้แสดงแบบอ่านอย่างเดียว | AdminSettings |

---

## 6. ระดับสิทธิ์ ↔ UI

| ค่าใน DB (`effective_visibility`) | ข้อความ UI | ไอคอน (lucide) | สี |
|---|---|---|---|
| `private` | ส่วนตัว | `Lock` | muted |
| `workspace_view` | ทีมดูได้ | `Users` | muted |
| `workspace_edit` | ทีมแก้ไขได้ | `Pencil` | accent |

- ตัวเลือก "ตาม Collection" คือ `visibility = inherit` ใน DB ไม่ใช่ค่าที่แสดงเป็น badge (badge แสดงค่า effective เสมอ)
- ใน Detail ต้องบอกที่มาของสิทธิ์ เช่น "สืบทอดจาก Infra & DevOps"
- ปุ่ม แก้ไข / ประวัติ / ย้าย / ลบ / เปลี่ยนสิทธิ์ แสดงตาม `permissions: { canEdit, canManage }` ที่ API ส่งมา (design.md §4.3) ห้ามเดาจากฝั่ง client
- Admin ที่เปิดรายการส่วนตัวของคนอื่นไม่ได้ จะได้หน้า 404 แบบเดียวกับไม่พบรายการ (design.md §7.4)

---

## 7. รายละเอียดแต่ละหน้า

### 7.1 หน้าแรก (`Main`)
- ปุ่ม "+ สร้างใหม่" ที่แถบบน (ไม่มีส่วนเลือกประเภทแล้ว — D22)
- ซ้าย "แก้ไขล่าสุดในทีม": ลิสต์ในกรอบขอบ radius 12 แถวละหนึ่ง `ItemRow` + ลิงก์ "ดูทั้งหมด"
- ขวา (กว้างสูงสุด 340): "ของฉันล่าสุด" (3 แถว ไอคอนสิทธิ์ + ชื่อ + เวลา) และ "Tag ที่ใช้บ่อย" (chip + จำนวน)
- ข้อความใต้ H1: "แสดงเฉพาะรายการที่คุณมีสิทธิ์เห็น"

### 7.2 ผลค้นหา (`Search`)
- H1 "พบ N รายการ" + ข้อความอธิบายคำค้น (AND) · ปุ่มเรียง "ความตรงกัน"
- แถบกรองป้ายพร้อมจำนวน (ทั้งหมด / Snippet / Script / Note / Link — รายการที่มีหลายป้ายนับในทุกป้ายของมัน) ปุ่มที่เลือกใช้ขอบ+พื้น accent
- ผลลัพธ์: ไฮไลต์ในชื่อ, ในข้อความตัวอย่าง และในบรรทัด code (แสดงเลขบรรทัดจริงของไฟล์) · breadcrumb ซ่อนเมื่อผู้ชมไม่มีสิทธิ์เห็น Collection (design.md §4.4-6)
- คอลัมน์ขวา: Tag, ภาษา, กล่อง "ไวยากรณ์ค้นหา" (`tag:` `kind:` `lang:` `"วลี"` `-คำ`)
- จำนวนทั้งหมด facet และตัวเลขต้องมาจาก query เดียวกับผล (design.md §8.4)

### 7.3 ค้นด่วน (`Quick`)
- ตัวอย่างที่ใช้: พิมพ์ "user by id" แล้วเจอ `getUserById` (ต้องทำ `expand_identifiers` ตาม design.md §8.2)
- Debounce 150ms · แสดง 8 รายการ · ก่อนพิมพ์แสดงรายการที่เปิดล่าสุด 5 รายการ (สเปก §1.1(ก))

### 7.4 รายละเอียดรายการ (`Detail`)
- ซ้าย: ป้าย + สิทธิ์ → ชื่อ/summary/tag → เนื้อหา Markdown (code fence แสดงเป็น `CodeBlock`) → ไฟล์แนบ
- ขวา (กว้างสูงสุด 320): รายละเอียด (เจ้าของ วันที่ Collection), สิทธิ์ + ปุ่มเปลี่ยน, ประวัติล่าสุด (3 เวอร์ชัน)
- ไม่มีส่วนเฉพาะประเภท: วิธีรัน/parameter/ลิงก์ ผู้ใช้เขียนใน Markdown เอง (D22)

### 7.5 Editor (`Editor`)
- แถบบน: ปุ่มกลับ · ชื่อโหมด · สถานะ "เวอร์ชัน N · ยังไม่ได้บันทึก" · ยกเลิก · บันทึก (`Ctrl S`)
- ซ้าย: ชื่อเรื่อง, คำอธิบายสั้น, เนื้อหา (Markdown ใน `CodeEditor` พร้อมตัวอย่าง code fence เป็น placeholder)
- ขวา (300–360): ป้าย (checkbox 2×2), Collection picker, Tag, สิทธิ์ (ค่าเริ่มต้น "ตาม Collection"), ไฟล์แนบ
- เมื่อบันทึกชนกัน (HTTP 409) ต้องมี dialog เลือก 3 ทาง ตาม design.md §10.2 (สเปก §1.1(ก))

### 7.6 Dialog สิทธิ์ (`Dialog`)
- เปิดจากปุ่มสิทธิ์ในหน้า Detail · ข้อความเตือนเมื่อเลือกสิทธิ์ต่างจาก Collection · ปุ่ม ยกเลิก / บันทึกสิทธิ์
- เฟส 2 จะเพิ่มส่วน "แชร์รายบุคคล/กลุ่ม" ในกล่องเดียวกัน (ตอนนี้ยังไม่ใส่)

### 7.7 เข้าสู่ระบบ (`Login`)
- ฟิลด์ **อีเมล** (`type="email"`, `autocomplete="email"`) + **รหัสผ่าน** (ปุ่มแสดง/ซ่อน) + ปุ่ม "เข้าสู่ระบบ" (accent เต็มความกว้าง)
- ไม่มี username ไม่มีลิงก์สมัครสมาชิก ใต้ฟอร์ม: "ลืมรหัสผ่าน? ให้ผู้ดูแลระบบของทีมรีเซ็ตให้" และ "ยังไม่มีบัญชี? ขอลิงก์เชิญจากผู้ดูแลระบบ" (เฟส 1 ไม่มี SMTP)
- สถานะ error (tweak `showError`): AlertBanner "อีเมลหรือรหัสผ่านไม่ถูกต้อง / ลองผิดได้อีก 3 ครั้ง ก่อนถูกล็อก 15 นาที" ข้อความเดียวทุกกรณี ไม่บอกว่าผิดช่องไหนหรือมีอีเมลนี้ในระบบหรือไม่
- ถ้า `must_change_password` ให้ไปหน้าเปลี่ยนรหัสผ่านทันทีหลัง login

### 7.8 รับคำเชิญ ตั้งรหัสผ่าน (`SetPassword`)
- แบนเนอร์บอก Workspace + บทบาท + "ลิงก์นี้ใช้ได้ครั้งเดียว"
- ฟิลด์: ชื่อที่แสดง · **อีเมล (readonly มาจากคำเชิญ)** · รหัสผ่านใหม่ + `PasswordRules` (≥ 10 ตัวอักษร, ไม่ใช่รหัสผ่านทั่วไป) · ยืนยันรหัสผ่าน · ปุ่ม "สร้างบัญชี"
- ลิงก์หมดอายุ/ถูกใช้แล้ว/ถูกยกเลิก: แสดงหน้าข้อความเดียว "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ ติดต่อผู้ดูแลระบบ" (ไม่แยกสาเหตุ)
- หน้านี้เป็นทางเดียวที่สร้างบัญชีได้ (D21)

### 7.9 Admin › ผู้ใช้ (`AdminUsers`)
- หัวเรื่อง "ผู้ใช้" + สรุปจำนวน (ใช้งาน / ปิดบัญชี / รอรับเชิญ) + ปุ่ม **"เชิญด้วยอีเมล"** (accent) — **ไม่มีปุ่มสร้างบัญชีโดยตรง**
- `InviteLinkCard` แสดงคำเชิญล่าสุด
- `DataTable`: ผู้ใช้ (avatar ตัวอักษร + ชื่อ + อีเมล) · บทบาท · สถานะ · เข้าใช้ล่าสุด · การกระทำ · ผู้ถูกเชิญที่ยังไม่รับ = จุด accent "รอรับเชิญ" + ปุ่ม "ยกเลิกคำเชิญ" · ผู้ที่ปิดบัญชี = ปุ่ม "เปิดบัญชี"
- เมนูแถว: เปลี่ยนบทบาท / รีเซ็ตรหัสผ่าน (สร้างรหัสชั่วคราว) / ปิดบัญชี (ยืนยันก่อน)

#### 7.9.1 Dialog › เชิญด้วยอีเมล (`InviteDialog` → `InviteResult`)
- `role="dialog"` `aria-modal` กว้าง 560 รูปแบบเดียวกับ `PermissionDialog` ปิดด้วย ✕ หรือ "ยกเลิก"
- ฟอร์ม: ช่องอีเมล (`type="email"`, `inputmode="email"`, บังคับ) + `fieldset` บทบาท Member (ค่าเริ่มต้น) / Admin + กล่องข้อความ "ไม่มีการส่งอีเมลในเฟส 1 ระบบจะสร้างลิงก์ให้ copy ส่งเอง" · ปุ่ม "สร้างลิงก์เชิญ"
- ข้อความ error ที่ต้องมี (สเปก §1.1(ก)): อีเมลรูปแบบผิด · อีเมลนี้มีบัญชีอยู่แล้ว (รวมบัญชีที่ปิดอยู่ ให้ไป "เปิดบัญชี" แทน) · อีเมลนี้มีคำเชิญค้างอยู่ (ให้ยกเลิกคำเชิญเดิมก่อน) ตรงกับ unique index `invites_pending_email`
- หลังสร้างสำเร็จแสดง `InviteResult`: แถบยืนยัน (อีเมล + บทบาท) · ช่องลิงก์เต็ม (mono) + ปุ่ม Copy · กล่องเตือน "แสดงเต็มได้ครั้งเดียว ถ้าลืม copy ให้ยกเลิกแล้วสร้างใหม่" · ใช้ได้ครั้งเดียว หมดอายุใน 7 วัน ใช้ได้กับอีเมลนั้นเท่านั้น · ปุ่ม "เสร็จสิ้น" กลับตารางและมีแถว "รอรับเชิญ" เพิ่ม

### 7.10 Admin › รายการส่วนตัว (`AdminPrivate`)
- ข้อความอธิบายตรงหัวตาราง: เห็นเฉพาะ metadata เปิดเนื้อหาไม่ได้ (D6)
- คอลัมน์: ชื่อเรื่อง · เจ้าของ · สร้างเมื่อ · ขนาด · การกระทำ · ปุ่ม "โอน" แสดงเฉพาะแถวที่เจ้าของถูกปิดบัญชี และโอนให้ตัวเองไม่ได้

#### 7.10.1 Dialog › โอนความเป็นเจ้าของ (`TransferDialog`)
- เปิดจากปุ่ม "โอนความเป็นเจ้าของ" ในแถวของเจ้าของที่ปิดบัญชี หัว dialog บอกชื่อรายการ
- สรุปเจ้าของเดิม (ชื่อ + อีเมล + สถานะปิดบัญชี) และระดับการเข้าถึง (คงเป็นส่วนตัวหลังโอน)
- `fieldset` radio เลือกผู้รับโอนจากผู้ใช้ที่ใช้งานอยู่ (แสดงชื่อ + อีเมล) · **ไม่มี Admin ที่กำลังโอนอยู่ในรายการ** เพื่อกันการเปิดอ่านรายการส่วนตัวของผู้อื่น (D6)
- กล่องข้อความ: เจ้าของใหม่เท่านั้นที่เห็นเนื้อหา · บันทึก `item.owner_transferred` ใน audit log
- ปุ่ม "โอนความเป็นเจ้าของ" (accent) / "ยกเลิก"

### 7.11 Admin › Audit log (`AdminAudit`)
- `FilterBar` + ตาราง (เวลา · ผู้กระทำ · action · เป้าหมาย · รายละเอียด · IP) + Export CSV · ตัวอย่างมี `user.invited` ที่ระบุอีเมลผู้ถูกเชิญ

### 7.12 Admin › ตั้งค่า (`AdminSettings`)
- ชื่อ Workspace · ภาษา · ค่าเริ่มต้นสิทธิ์ของ Collection ใหม่ (D15) · ข้อจำกัดระบบแบบอ่านอย่างเดียว (ขนาดไฟล์ 50 MB, อายุคำเชิญ 7 วัน, ถังขยะ 30 วัน)

### 7.13 เตรียมไว้สำหรับ Google login (เฟส 2 — ยังไม่มี mockup)
รายละเอียดกฎและโมเดลข้อมูลอยู่ใน design.md §19 ฝั่ง UI ต้องเว้นที่ไว้ดังนี้

| หน้า | สิ่งที่เพิ่มในเฟส 2 | จุดที่เว้นไว้ตั้งแต่เฟส 1 |
|---|---|---|
| `Login` | ตัวคั่น "หรือ" + ปุ่ม outline เต็มความกว้าง "เข้าสู่ระบบด้วย Google" (สูง ≥ 44px, โลโก้ตามแนวทางแบรนด์ Google) ใต้ฟอร์ม · ถ้าปิดรหัสผ่านทั้ง Workspace ซ่อนฟอร์ม เหลือแต่ปุ่ม Google | ฟอร์มและปุ่มแสดงตามค่าจาก `GET /auth/methods` (เฟส 1 ได้ `google:false`) · alert error ใช้ `AlertBanner` เดิม |
| `SetPassword` | ปุ่ม "ดำเนินการต่อด้วย Google" เหนือฟอร์ม + ข้อความ "ต้องใช้อีเมล <อีเมลในคำเชิญ>" | ฟิลด์อีเมลเป็น readonly อยู่แล้ว |
| `AdminUsers` | คอลัมน์ "วิธีเข้าสู่ระบบ" (chip รหัสผ่าน / Google) | ตารางเพิ่มคอลัมน์ได้โดยไม่ต้องจัดใหม่ |
| `AdminSettings` | การ์ด "วิธีเข้าสู่ระบบ": สวิตช์รหัสผ่าน, สวิตช์ Google, โดเมนอีเมลที่อนุญาต, เตือนเมื่อปิดวิธีสุดท้าย | ใช้ `SettingsCard` เดิม |
| บัญชีของฉัน (หน้าใหม่) | เปลี่ยนรหัสผ่าน + วิธีที่ผูกไว้ + ผูก/เลิกผูก Google (ปิดปุ่มเลิกผูกถ้าเป็นวิธีสุดท้าย) | เมนูโปรไฟล์ที่มุมล่างซ้ายของ sidebar เปิดหน้านี้ |

ข้อกำหนด UI: ข้อความเมื่อ Google login ไม่สำเร็จใช้ข้อความกลางข้อความเดียว "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ตรวจสอบว่าใช้อีเมลที่ผู้ดูแลระบบเชิญไว้ หรือติดต่อผู้ดูแลระบบ" ไม่บอกสาเหตุจริง

---

## 8. การเข้าถึง (Accessibility) ที่ถือเป็นข้อกำหนด

- ใช้ `<button>`, `<a href>`, `<input>` + `<label>` จริงเสมอ ห้ามทำ div กดได้
- ปุ่มที่เป็นไอคอนล้วนต้องมี `aria-label` · ไอคอนประดับใช้ `aria-hidden="true"`
- ตัวเลือกสิทธิ์เป็น `fieldset` + radio · dialog เป็น `role="dialog"` `aria-modal="true"` `aria-labelledby` และดักโฟกัส
- สถานะเน้นสีต้องมีข้อความหรือไอคอนกำกับด้วย (สิทธิ์แสดงทั้งไอคอนและคำ)
- โฟกัสต้องเห็นชัด: วง 2px สี accent ห่าง 2px
- เนื้อหาไทย: ตั้ง `lang="th"` ที่ `<html>`

---

## 9. ข้อความหน้าจอ (i18n)

ทุกข้อความผ่าน `next-intl` (หัวข้อ 13 ของ design.md) ข้อความที่ใช้ใน mockup (ใช้เป็นชุดเริ่มต้นของ `th.json`):
หน้าแรก · Inbox · ของฉัน · ถังขยะ · Collections · สร้างใหม่ · ค้นหา snippet, script, note… · แก้ไขล่าสุดในทีม · ดูทั้งหมด · ของฉันล่าสุด · Tag ที่ใช้บ่อย · แสดงเฉพาะรายการที่คุณมีสิทธิ์เห็น · พบ N รายการ · เรียงตาม: ความตรงกัน · ไวยากรณ์ค้นหา · ภาษา · วิธีใช้ · ไฟล์แนบ · รายละเอียด · สิทธิ์ · ประวัติล่าสุด · เปลี่ยนสิทธิ์ · แก้ไข · ประวัติ · ยกเลิก · บันทึก · บันทึกสิทธิ์ · ส่วนตัว · ทีมดูได้ · ทีมแก้ไขได้ · ตาม Collection · ลากไฟล์มาวางที่นี่ หรือเลือกไฟล์ · ไม่เกิน 50 MB ต่อไฟล์

---

## 10. ลำดับการสร้าง UI (เทียบกับแผนใน design.md §17)

| สัปดาห์ | งาน UI |
|---|---|
| 1 | ติดตั้ง Next.js + Tailwind + shadcn, ตั้ง tokens §3.4, โหลดฟอนต์, ทำ `AppShell` + `Sidebar` (ข้อมูลตัวอย่างก่อน) |
| 2 | `AuthCard`, `TextField`, `PasswordField`, Login, SetPassword (§7.7–7.8) + `AdminShell`, `DataTable`, `StatusPill`, `InviteLinkCard`, Admin › ผู้ใช้ (§7.9) + `InviteDialog`/`InviteResult` (§7.9.1) |
| 3 | `CollectionTree`, `ItemRow`, หน้าแรก, Dialog/ตัวเลือกสิทธิ์ |
| 4 | `CodeBlock` (code fence), `CodeEditor`, `TagInput`, `KindChip`, Editor เดียว, Detail |
| 5 | `Dropzone`, ไฟล์แนบ, History + dialog กรณี 409 (สเปก §1.1) |
| 6 | Search, `CommandPalette`, `Highlight`, `FacetList` |
| 7 | ถังขยะ (สเปก §1.1), Admin › รายการส่วนตัว / Audit log / ตั้งค่า + `TransferDialog` (§7.10–7.12 ออกแบบแล้ว) |
| เฟส 2 | ปุ่ม Google, การ์ดวิธีเข้าสู่ระบบ, หน้าบัญชีของฉัน (§7.13) |
| 8 | ตรวจ accessibility, ขัดเกลา, หน้าจอมือถือแบบอ่านอย่างเดียว (ถ้ามีเวลา) |

**ไม่ต้องรอ mockup เพิ่ม:** ส่วนที่ยังไม่มีภาพทั้งหมดในเฟส 1 สร้างตามสเปก §1.1(ก) ได้เลย ส่วนมือถือ/light mode/บัญชีของฉัน/Google อยู่ใน §1.1(ข)

---

## 11. การตัดสินใจที่ทำไปใน mockup (ถ้าไม่เห็นด้วยให้แก้ได้)

1. ใช้ dark mode เป็นหลัก ยังไม่มี light mode
2. ใช้ IBM Plex Sans Thai + JetBrains Mono
3. accent สีเหลืองอำพัน (เปลี่ยนได้)
4. หน้าแรกเน้นรายการล่าสุดและปุ่มสร้าง ไม่มี dashboard ตัวเลข
5. Sidebar แสดง Collection เป็น tree ตลอด ไม่ซ่อน
6. หน้า Editor เป็นหน้าเต็ม ไม่ใช่ modal
7. ผลค้นหาแสดงบรรทัด code ที่เจอพร้อมเลขบรรทัด ไม่แสดงทั้งไฟล์
8. ระบุตัวตนด้วยอีเมลอย่างเดียว ไม่มี username และไม่มีหน้าสมัครสมาชิก (D21)
9. หน้า Admin ใช้ shell แยกจากหน้าหลัก (sidebar ของ Admin เอง) เพื่อไม่ให้ปนกับ Collection tree
10. ข้อความ error ของ Login/Google ใช้ข้อความกลางเสมอ เพื่อไม่ให้ใครตรวจได้ว่าอีเมลใดมีบัญชี
