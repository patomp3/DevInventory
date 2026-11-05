# Dev Inventory — คู่มือสำหรับ Claude Code

คลังความรู้ภายในทีม dev (ไม่เกิน 10 คน): เก็บโค้ด, snippet, script, เอกสาร, โน้ต, ลิงก์ ค้นหาได้ พร้อมควบคุมสิทธิ์
ผู้ใช้พูดภาษาไทย (Asia/Bangkok) — **ตอบและเขียนข้อความ UI/เอกสารเป็นภาษาไทย** โค้ดและชื่อ identifier เป็นอังกฤษ

## เอกสารที่ต้องอ่านก่อนทำงาน

- `docs/design.md` — ออกแบบระบบทั้งหมด (v1.2) **เป็นแหล่งความจริงหลัก**: ข้อกำหนด §3, สิทธิ์ §4, stack §5, ข้อมูล §6, permission engine §7, ค้นหา §8, API §12, ความปลอดภัย §14, แผน §17, Google login เฟส 2 §19, การตัดสินใจ D1–D21
- `docs/ui-design.md` — UI spec (v1.3): tokens §3, โครงหน้า §4, รายละเอียดแต่ละหน้า §7, ลำดับสร้าง UI §10, ขอบเขตที่สร้างได้เลยเมื่อไม่มี mockup §1.1
- ถ้าโค้ดขัดกับเอกสาร ให้ถามผู้ใช้ก่อนเปลี่ยนเอกสาร อย่าแก้เอกสารเงียบ ๆ

## Stack

Next.js 15 App Router (TypeScript, webpack) · Drizzle ORM + `pg` · PostgreSQL 17 (`pg_trgm`, `citext`, `unaccent`, ICU `th-TH`) · Better Auth 1.7 (อีเมล+รหัสผ่าน) · Tailwind v4 (tokens ใน `src/app/globals.css`) · ฟอนต์ self-host ผ่าน `@fontsource` · react-markdown + rehype-sanitize · Vitest · Docker Compose + Caddy

โค้ดทั้งหมดอยู่ใน `source/` (รันคำสั่ง npm จากโฟลเดอร์นั้น)

## สถานะ (ตามแผน design.md §17)

| สัปดาห์ | งาน | สถานะ |
|---|---|---|
| 1 | โครงโปรเจกต์, Docker, schema + migration, Thai search PoC | เสร็จ (PoC ผ่าน: `LIKE '%…%'` ภาษาไทยใช้ trigram index < 2 ms ที่ 60,000 แถว) |
| 2 | Better Auth, เชิญด้วยอีเมล, Admin › ผู้ใช้, audit log | เสร็จ |
| 3 | Collection tree + สืบทอดสิทธิ์, Note/Link CRUD, versions, 409, UI หลัก | เสร็จ |
| 4 | Snippet/Script (CodeMirror 6, Shiki, หลาย code block), tag | **ถัดไป** |
| 5 | ไฟล์แนบ, หน้า History + diff, dialog 409 | |
| 6 | ค้นหาเต็มรูปแบบ, Ctrl+K, highlight, facet | |
| 7 | ถังขยะ, Admin › รายการส่วนตัว/audit log/ตั้งค่า, backup | |
| 8 | ทดสอบตาม DoD, แก้บั๊ก, เอกสาร, deploy | |

เลื่อนไปเฟส 2 (อย่าทำตอนนี้): Google login, share รายบุคคล/กลุ่ม, access requests, pin, notifications, หน้า "บัญชีของฉัน", mobile, light mode

## โครงสร้าง `source/`

```
src/lib/permissions/   จุดเดียวที่ตัดสินสิทธิ์: canView/canEdit/canManage/canTransfer, resolveEffective, visibleItemsWhere
src/lib/search/        normalize, expandIdentifiers, buildSearchText, parseQuery, likePattern
src/lib/collections.ts tree + CRUD + recomputeSubtree (สืบทอด effective_visibility)
src/lib/items.ts       รายการ: create/update(409)/move/visibility/delete, listItems, getItemDetail
src/lib/auth/          Better Auth config (lazy), session helper, password policy
src/lib/api.ts         userRoute()/requireAdmin() — ตรวจ Origin(CSRF) + session + แปลง AppError → HTTP
src/lib/audit.ts       เขียน audit_logs   ·  src/lib/errors.ts  AppError, notFound
src/lib/db/schema.ts   Drizzle schema (ต้องตรงกับ drizzle/*.sql)
src/app/api/v1/…       REST: auth, admin/{users,invites}, collections, items
src/app/(app)/…        หน้าหลังล็อกอิน (layout ตรวจ session + sidebar tree)
drizzle/*.sql          migration แบบ SQL ล้วน รันด้วย scripts/migrate.ts ตามชื่อไฟล์
scripts/               migrate, seed, doctor, poc-thai-search, e2e-auth.sh, e2e-items.sh
tests/                 Vitest unit tests (ไม่ต้องใช้ DB)
```

## กฎที่ห้ามละเมิด

1. **สิทธิ์ตัดสินที่ `src/lib/permissions` เท่านั้น** ทุก query ที่คืนรายการต้องใช้ `visibleItemsWhere(ctx)` (กรองตั้งแต่ใน SQL รวม count/autocomplete/tag cloud/export) ห้ามกรองทีหลังใน JS
2. **ไม่มีสิทธิ์ดู = 404** (ไม่ใช่ 403) ไม่เปิดเผยว่ามีอยู่ 403 ใช้เมื่อมองเห็นแต่ทำไม่ได้ Admin **ไม่เห็นเนื้อหา private ของคนอื่น** (เห็นแค่ metadata ในหน้า Admin) และโอนรายการ private ให้ตัวเองไม่ได้ (D6)
3. `workspace_id` มาจาก session เสมอ ห้ามรับจาก client ทุก query มี `workspace_id`
4. `effective_visibility` เป็นค่า materialized — เปลี่ยนสิทธิ์/ย้ายต้องคำนวณใหม่ **ใน transaction เดียวกัน** (`recomputeSubtree`) Collection ระดับบนสุดห้าม `inherit`; รายการใน Inbox ห้าม `inherit` (แปลงเป็นค่า default ของ workspace)
5. **ไม่มีการสมัครเอง (D21):** สร้างบัญชีได้ทางเดียวคือรับคำเชิญ (อีเมลมาจากคำเชิญ แก้ไม่ได้) หรือ seed Admin คนแรกจาก env ห้ามเพิ่ม endpoint สร้างผู้ใช้ตรง ๆ
6. ทุกการกระทำสำคัญเขียน `audit_logs` (append-only: มี trigger กัน UPDATE/DELETE/TRUNCATE) ใช้ `audit()` ใน transaction เดียวกับการเปลี่ยนข้อมูล
7. request ที่แก้ข้อมูลต้องผ่านการตรวจ `Origin` (`userRoute`/`requireAdmin` ทำให้แล้ว)
8. Markdown render ผ่าน `rehype-sanitize` เท่านั้น URL ของ Link รับเฉพาะ `http(s)`; ลิงก์ภายนอกใช้ `rel="noopener noreferrer nofollow"`
9. ข้อความ error ของ login เป็นข้อความเดียวทุกกรณี (ไม่บอกว่าอีเมลมีในระบบหรือไม่)
10. migration ที่ merge แล้ว **ห้ามแก้ไฟล์เดิม** ให้เพิ่มไฟล์ `drizzle/000N_*.sql` ใหม่ แล้วปรับ `schema.ts` ให้ตรง (Drizzle ใช้เป็น query builder เท่านั้น ไม่ได้ใช้ drizzle-kit generate)

## Better Auth — ข้อที่ต้องรู้

- ตั้งค่าใน `src/lib/auth/index.ts` (สร้างแบบ lazy กันพังตอน build); `user` map ไปตาราง `users` (`name` → `displayName`) ตาราง `session`/`account`/`verification` ตามชื่อ model; id เป็น uuid v7
- `emailAndPassword.disableSignUp: true` และ route `/api/auth/[...all]` **เปิดเฉพาะ** `GET get-session` กับ `POST sign-out` ส่วน login/accept-invite/change-password ใช้ `/api/v1/auth/*` ของเราเอง (มี throttle 5 ครั้ง/15 นาทีต่ออีเมล+IP ในตาราง `login_attempts`, audit, เช็กสถานะผู้ใช้)
- สร้างบัญชีด้วยการ insert `users` + `account` (`provider_id='credential'`) เองโดยใช้ `hashPassword` จาก `better-auth/crypto`
- ปิดบัญชี = ลบ session ทั้งหมดของผู้ใช้ + `getSessionUser()` เช็ก `status` จาก DB ทุกครั้ง
- เฟส 2 (Google): ดู design.md §19 ใช้ตาราง `account` เดิม ยืนยันชื่อ option กับเวอร์ชันที่ติดตั้งก่อนเขียน

## รันบนเครื่อง (Windows + Docker Desktop)

```bash
cd source
npm install                      # มี .npmrc legacy-peer-deps (better-auth ขัด peer ของ vite) — ต้องรันใหม่ทุกครั้งที่ package.json เปลี่ยน
cp .env.example .env             # แล้วแก้ตาม README (APP_BASE_URL=http://localhost:3000, DATABASE_URL ใช้ localhost:5433, BETTER_AUTH_SECRET ≥32 ตัว)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # Postgres เปิดพอร์ต 127.0.0.1:5433
npm run doctor                   # ตรวจ .env/DB/บัญชี Admin พร้อมวิธีแก้ — รันก่อนเสมอเมื่อมีอะไรผิดปกติ
npm run db:migrate && npm run db:seed
npm run dev                      # http://localhost:3000
```

- พอร์ต **5433** (ไม่ใช่ 5432) เพราะเครื่องผู้ใช้มี Postgres อื่นจับ 5432 อยู่ ถ้า `password authentication failed` ให้สงสัยว่าต่อผิดตัว หรือ volume เก่าจำรหัสเดิม → `docker compose … down -v` (ข้อมูล dev ล้างได้)
- ฐานข้อมูลต้องสร้างด้วย `--locale-provider=icu --icu-locale=th-TH --encoding=UTF8` (compose ตั้งให้แล้ว) ไม่งั้นการค้นหาไทยด้วย pg_trgm ไม่ทำงาน
- scripts ใช้ `tsx --env-file-if-exists=.env` จึงอ่าน `.env` เอง
- `next dev` อ่าน `.env` เอง; ต้อง restart ถ้าแก้ `.env`

## ทดสอบ

- `npm test` (Vitest, 38 เคส: permission matrix, search, password policy) · `npm run typecheck` · `npm run build`
- e2e (ต้องมีเซิร์ฟเวอร์รันอยู่ + DB ที่ seed แล้ว + `psql`; เขียนเป็น bash — บน Windows ใช้ Git Bash/WSL): `scripts/e2e-auth.sh` (login lockout, เชิญ, รีเซ็ตรหัส, ปิดบัญชี) และ `scripts/e2e-items.sh` (สิทธิ์/สืบทอด/409/ความลึก 35 เช็ก) ปรับตัวแปร `B`, `PSQL`, `ADMIN_PW` ท้าย/ต้นไฟล์ให้ตรงกับเครื่อง
- เพิ่มเทสต์ทุกครั้งที่แตะ permission engine; ทุก endpoint ใหม่ต้องมีเคส "ไม่มีสิทธิ์ → 404" และ "ข้าม workspace"
- ยังไม่มีเทส UI/Playwright (อยู่ในแผนสัปดาห์ 8) — หน้าจอที่ทำไปแล้ว **ยังไม่เคยตรวจด้วยตาในเบราว์เซอร์** ควรเปิดดูและแก้รายละเอียดเทียบ ui-design

## งานสัปดาห์ 4 (ถัดไป) — แนวทาง

- เปิดชนิด `snippet`, `script` ใน `AVAILABLE_TYPES` (`src/lib/items.ts`); ใช้ตาราง `item_code_blocks` (มีแล้ว), `script_meta` jsonb `{shell, os[], params[], run_example}`
- Editor: CodeMirror 6 (หลาย code block ต่อรายการ ตั้งชื่อไฟล์/ภาษาได้), แสดงผลด้วย Shiki (theme เองตามสี ui-design §3.1), CSP ต้องไม่ใช้ inline script
- tag: ตาราง `tags` (slug lowercase)/`item_tags`; autocomplete ต้องแสดงเฉพาะ tag ที่ผูกกับรายการที่ผู้ใช้ "มีสิทธิ์เห็น" (design §8.7 กัน tag จากรายการ private รั่ว)
- ต้องอัปเดตให้ครบ: `buildSearchText` (ใส่ code/ชื่อไฟล์/tag, จำกัด 200 KB), snapshot ใน `item_versions` (codeBlocks, tags), `updateItem` (optimistic lock เดิม), หน้า detail และ editor ของแต่ละชนิดตาม ui-design §1.1(ก)
- ทำทีละชิ้นเล็ก ๆ: schema/service → API → UI → test

## ช่องว่างที่รู้อยู่แล้ว (ทำตอนถึงสัปดาห์ที่เกี่ยวข้อง)

- dialog ย้ายรายการเตือนแบบรวม ๆ ยังไม่แยกกรณี "สิทธิ์เปิดกว้างขึ้น" (design §4.4.4)
- ลบรายการ = soft delete เท่านั้น ยังไม่มีหน้าถังขยะ/กู้คืน (สัปดาห์ 7); ยังไม่มีหน้า History และ dialog 409 แบบเต็ม (สัปดาห์ 5 — ตอนนี้เป็น dialog ง่าย ๆ ใน `ItemEditor`)
- ยังไม่มี endpoint `/me`, `/auth/methods`, `/tags`, `/trash`, `/search`, admin `private-items`/`audit-logs`/`settings`/transfer
- ตรรกะ `canTransfer` มีและทดสอบแล้ว แต่ยังไม่มี endpoint/หน้าจอ (TransferDialog ออกแบบไว้แล้วในแคนวาส)
- แอปตั้ง `X-Frame-Options` ฯลฯ เบื้องต้นใน `next.config.ts`; CSP แบบ strict ยังไม่ได้ใส่
- Dockerfile/compose ผ่านการเขียนแล้วแต่ **ยังไม่เคย build จริง** (service `migrate` ใช้ stage `build`); backup (restic) อยู่สัปดาห์ 7

## ธรรมเนียมการทำงาน

- ทำเป็นขั้นเล็ก ๆ และรัน `npm run typecheck && npm test` ก่อน commit; ฟีเจอร์ที่แตะ API ให้รัน e2e ที่เกี่ยวข้องด้วย
- commit message ภาษาอังกฤษ สั้น บอกว่าทำอะไรและทำไม; branch หลักคือ `main`
- แก้ `schema.ts` ต้องแก้ SQL migration ให้ตรงกันเสมอ
- ไม่ใส่ข้อมูลลับใน repo (`.env` ถูก ignore); อย่า log รหัสผ่าน/token; รหัสชั่วคราวและลิงก์เชิญแสดงครั้งเดียว
- ผู้ใช้ไม่ใช่นักพัฒนาประจำของโปรเจกต์นี้ทุกขั้นตอน — อธิบายสั้น ๆ ว่าต้องรันอะไรและคาดหวังผลอย่างไร และเมื่อเจอ error ให้ขอข้อความ error จริงจาก terminal ก่อนเดา
