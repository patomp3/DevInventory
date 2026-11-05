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
| Better Auth, invite, Admin › Users | สัปดาห์ 2 |

## เริ่มใช้งาน

```bash
cp .env.example .env        # แก้ค่า
npm install
docker compose up -d db     # Postgres (ICU th-TH)
DATABASE_URL=postgres://inventory:change-me@localhost:5432/inventory npm run db:migrate
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
