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

## เริ่มใช้งาน

```bash
cp .env.example .env        # แก้ค่า (รวม BETTER_AUTH_SECRET และ INITIAL_ADMIN_*)
npm install
docker compose up -d db     # Postgres (ICU th-TH)
DATABASE_URL=postgres://inventory:change-me@localhost:5432/inventory npm run db:migrate
DATABASE_URL=... npm run db:seed   # สร้าง Super Admin คนแรกจาก INITIAL_ADMIN_* (รันซ้ำได้)
npm test && npm run typecheck
npm run dev
```

> ต้อง publish พอร์ต 5432 ของ db (เพิ่ม `ports: ["5432:5432"]` ชั่วคราว) ถ้าจะรัน migrate/PoC จากเครื่อง host

รัน PoC ซ้ำบนข้อมูลของคุณเอง: `DATABASE_URL=... npm run poc:search` (ปรับจำนวนแถวด้วย `POC_ROWS`)

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
