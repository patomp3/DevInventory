# Dev Inventory — source

คลังความรู้ภายในทีม dev (โค้ด, snippet, script, เอกสาร, ลิงก์) ออกแบบตาม `design.md` / `ui-design.md` ในโฟลเดอร์แม่

## สถานะ: สัปดาห์ 1 (design.md §17)

| ส่วน | สถานะ |
|---|---|
| โครง Next.js + Tailwind v4 + tokens ตาม ui-design §3 | เสร็จ (หน้า placeholder + `/api/health`) |
| Docker Compose (app, Postgres 17 ICU th-TH, Caddy) | เสร็จ |
| Schema + migration (`drizzle/0000_init.sql`) รวม audit_logs append-only | เสร็จ ทดสอบกับ Postgres 16 จริง |
| Permission engine (`src/lib/permissions`) + test matrix §4.3 | เสร็จ |
| `search_text` / query parser (`src/lib/search`) + tests | เสร็จ |
| Thai search PoC (`npm run poc:search`) | ผ่าน: LIKE '%…%' ภาษาไทยกลางคำใช้ trigram index ได้ (< 2 ms ที่ 60,000 แถว) |
| Better Auth (อีเมล+รหัสผ่าน, ปิดสมัครเอง), login + throttle 5/15 นาที, เปลี่ยนรหัสบังคับ | สัปดาห์ 2 เสร็จ |
| ระบบเชิญด้วยอีเมล (ลิงก์ใช้ครั้งเดียว 7 วัน) + หน้ารับเชิญ | สัปดาห์ 2 เสร็จ |
| Admin › ผู้ใช้ (เชิญ/ยกเลิกเชิญ/เปลี่ยนบทบาท/รีเซ็ตรหัส/ปิด-เปิดบัญชี) + audit log | สัปดาห์ 2 เสร็จ |
| Collection tree (≤3 ชั้น) + สิทธิ์ 4 ระดับ + การสืบทอด (`effective_visibility` คำนวณใหม่ใน transaction เดียว) | สัปดาห์ 3 เสร็จ |
| รายการ Note / Link: สร้าง/แก้/ย้าย/เปลี่ยนสิทธิ์/ลบ (soft), optimistic locking (409), ประวัติเวอร์ชัน (รวมภายใน 5 นาที) | สัปดาห์ 3 เสร็จ |
| UI: sidebar tree + จำนวนที่เห็นได้, หน้าแรก, Inbox, ของฉัน, หน้า Collection, หน้ารายการ, editor, dialog สิทธิ์/ย้าย/ลบ | สัปดาห์ 3 เสร็จ |
| Snippet / Script (CodeMirror, Shiki), tag | สัปดาห์ 4 |
| ไฟล์แนบ, หน้า History, ถังขยะ, ค้นหา, Ctrl+K | สัปดาห์ 5–7 |

## รันบนเครื่อง (พัฒนา)

```bash
npm install
cp .env.example .env
```

แก้ `.env` สำหรับรันบนเครื่อง (ไม่ใช่ใน Docker):

| ตัวแปร | ค่าสำหรับ dev |
|---|---|
| `APP_BASE_URL` | `http://localhost:3000` (ถ้าเป็น https ที่ไม่ตรงกับที่เปิด cookie/Origin จะไม่ทำงาน) |
| `DATABASE_URL` | `postgres://<user>:<password>@localhost:5433/<db>` (host `db` ใช้ได้เฉพาะภายใน Docker) |
| `BETTER_AUTH_SECRET` | สตริงสุ่มยาว ≥ 32 ตัวอักษร เช่น `openssl rand -base64 32` |
| `INITIAL_ADMIN_EMAIL` / `_PASSWORD` | Admin คนแรก (รหัสผ่าน ≥ 10 ตัว) |

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # Postgres + เปิดพอร์ต 5433 (เลี่ยงชนกับ Postgres อื่นในเครื่อง)
npm run db:migrate     # สร้างตาราง (อ่าน .env เอง)
npm run db:seed        # สร้าง Admin คนแรก (รันซ้ำได้)
npm run dev            # http://localhost:3000
```

เข้า `/login` ด้วย `INITIAL_ADMIN_*` → ระบบบังคับตั้งรหัสใหม่ → Admin › ผู้ใช้ › "เชิญด้วยอีเมล" (ไม่มีการส่งอีเมลในเฟส 1 ให้ copy ลิงก์ส่งเอง)

ทดสอบ: `npm test` · `npm run typecheck` · `npm run poc:search` (Thai search PoC)

## รันด้วย Docker ทั้งชุด

ตั้ง `.env` ให้ `DATABASE_URL` ใช้ host `db` และ `APP_BASE_URL` เป็นโดเมนจริง แล้ว `docker compose up -d --build` (service `migrate` จะ migrate + seed ให้)

`scripts/e2e-items.sh` ทดสอบ Collection/รายการ (สิทธิ์ การสืบทอด 409 ความลึก) ส่วน `scripts/e2e-auth.sh` ทดสอบ flow login/เชิญ/รีเซ็ตรหัส/ปิดบัญชี กับเซิร์ฟเวอร์ที่รันอยู่

## โครงสร้าง

- `src/lib/permissions` — จุดเดียวที่ตัดสินสิทธิ์ (`canView/canEdit/canManage/canTransfer`, `visibleItemsWhere`)
- `src/lib/search` — `normalize`, `expandIdentifiers`, `buildSearchText`, `parseQuery`
- `src/lib/db` — schema (ต้องตรงกับ `drizzle/*.sql`) และ connection
- `drizzle/` — SQL migration รันตามลำดับชื่อด้วย `scripts/migrate.ts`

## ใช้งานครั้งแรก

1. `docker compose up -d --build` (service `migrate` จะ migrate + seed ให้) หรือรันเองตามด้านบนแล้ว `npm run dev`
2. เข้า `/login` ด้วย `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` → ระบบบังคับตั้งรหัสใหม่
3. Admin › ผู้ใช้ › "เชิญด้วยอีเมล" → copy ลิงก์ส่งให้เพื่อนร่วมทีม (ไม่มีการส่งอีเมลในเฟส 1)

`scripts/e2e-items.sh` ทดสอบ Collection/รายการ (สิทธิ์ การสืบทอด 409 ความลึก) ส่วน `scripts/e2e-auth.sh` ทดสอบ flow ทั้งหมดกับเซิร์ฟเวอร์ที่รันอยู่ (login lockout, เชิญ, รีเซ็ตรหัส, ปิดบัญชีแล้ว session หลุด)
