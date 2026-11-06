# Dev Inventory — คู่มือสำหรับ Claude Code

คลังความรู้ภายในทีม dev (ไม่เกิน 10 คน): เก็บโค้ด, snippet, script, เอกสาร, โน้ต, ลิงก์ ค้นหาได้ พร้อมควบคุมสิทธิ์
ผู้ใช้พูดภาษาไทย (Asia/Bangkok) — **ตอบและเขียนข้อความ UI/เอกสารเป็นภาษาไทย** โค้ดและชื่อ identifier เป็นอังกฤษ

## เอกสารที่ต้องอ่านก่อนทำงาน

- `docs/design.md` — ออกแบบระบบทั้งหมด (v1.3) **เป็นแหล่งความจริงหลัก**: ข้อกำหนด §3, สิทธิ์ §4, stack §5, ข้อมูล §6, permission engine §7, ค้นหา §8, API §12, ความปลอดภัย §14, แผน §17, Google login เฟส 2 §19, การตัดสินใจ D1–D22 (**D22: รายการเป็น Note ชนิดเดียว + ป้าย kinds**)
- `docs/ui-design.md` — UI spec (v1.4): tokens §3, โครงหน้า §4, รายละเอียดแต่ละหน้า §7, ลำดับสร้าง UI §10, ขอบเขตที่สร้างได้เลยเมื่อไม่มี mockup §1.1
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
| 4 | Editor Markdown + code fence (Shiki, Copy), ป้าย kinds (D22), tag | เสร็จ (ตรวจในเบราว์เซอร์แล้ว: สร้าง/แก้ Note หลายป้าย, code fence highlight + Copy, รายการที่แปลงจากข้อมูลเก่า) |
| 5 | ไฟล์แนบใต้ Note, หน้า History + diff + กู้เวอร์ชัน, dialog 409 แบบ 3 ทาง | เสร็จ (e2e 113/113 + ตรวจในเบราว์เซอร์: อัปโหลดรูปชื่อไทย, dialog 409, History ของ snapshot เก่า) |
| 6 | ค้นหาเต็มรูปแบบ, Ctrl+K, highlight, facet | เสร็จ (e2e 163/163, วัดที่ 50,000 รายการ: ค้นทั่วไป 3–55 ms / กรณีสุดโต่ง 279 ms, ตรวจในเบราว์เซอร์) |
| 7 | ถังขยะ, Admin › รายการส่วนตัว/audit log/ตั้งค่า, backup | **ถัดไป** |
| 8 | ทดสอบตาม DoD, แก้บั๊ก, เอกสาร, deploy | |

เลื่อนไปเฟส 2 (อย่าทำตอนนี้): Google login, share รายบุคคล/กลุ่ม, access requests, pin, notifications, หน้า "บัญชีของฉัน", mobile, light mode

## โครงสร้าง `source/`

```
src/lib/permissions/   จุดเดียวที่ตัดสินสิทธิ์: canView/canEdit/canManage/canTransfer, resolveEffective, visibleItemsWhere
src/lib/search/        normalize, expandIdentifiers, buildSearchText, parseQuery, likePattern
src/lib/collections.ts tree + CRUD + recomputeSubtree (สืบทอด effective_visibility)
src/lib/items.ts       รายการ: create/update(409)/move/visibility/delete, listItems(type/tag), getItemDetail(codeBlocks, tags)
src/lib/item-content.ts pure: KINDS/KIND_LABEL, normalizeKinds, prepareContent, normalizeTag(s), LIMITS (body ≤ 500,000 ตัวอักษร, tag ≤ 20)
src/lib/item-schema.ts zod body ของ POST/PUT items  ·  src/lib/tags.ts  replaceItemTags, tagsForItems, listTags (ผ่าน visibleItemsWhere)
src/lib/attachments.ts ไฟล์แนบ: upload/list/download/delete (สิทธิ์ผ่านรายการแม่ + soft delete) · src/lib/attachment-meta.ts pure: sniffMime (magic bytes), cleanFilename, contentDisposition, ขีดจำกัด
src/lib/versions.ts    listVersions / getVersionWithPrev / restoreVersion (กู้ = เวอร์ชันใหม่ ไม่ merge) · src/lib/item-history.ts pure: snapshotToView (รองรับ snapshot เก่า+ใหม่), sideBySide (diff), changedFields
src/lib/search/query.ts  searchItems (ผล+total+facet+คำแนะนำ) / quickSearch — ทุก query ผ่าน visibleItemsWhere ใน SQL · src/lib/search/snippet.ts pure: highlight, bodyExcerpt, buildResultSnippet
src/lib/highlight.ts   Shiki highlighter ตัวเดียว (JS regex engine, ธีมเองตาม ui-design §3.1) ใช้ผ่าน @shikijs/rehype ใน MarkdownView
src/lib/auth/          Better Auth config (lazy), session helper, password policy
src/lib/api.ts         userRoute()/requireAdmin() — ตรวจ Origin(CSRF) + session + แปลง AppError → HTTP
src/lib/audit.ts       เขียน audit_logs   ·  src/lib/errors.ts  AppError, notFound
src/lib/db/schema.ts   Drizzle schema (ต้องตรงกับ drizzle/*.sql)
src/app/api/v1/…       REST: auth, admin/{users,invites}, collections, search (+ /quick), items (+ /attachments, /versions, /versions/:v/restore), attachments/:id (+ /download), tags
src/components/        MarkdownView (server, MarkdownAsync: sanitize → Shiki) + CodePre (Copy), CodeEditor (CodeMirror 6 โหมด Markdown), TagInput, KindChips, ItemEditor (Editor เดียว), AttachmentPanel/AttachmentList, DiffView, ConflictDialog (409 แบบ 3 ทาง), CommandPalette (Ctrl+K, cmdk) + RecentTracker, Marked (ไฮไลต์)
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

- `npm test` (Vitest, 105 เคส: permission matrix, search (normalize/parseQuery/query), snippet (ไฮไลต์), password policy, item-content, attachment-meta, item-history) · `npm run typecheck` · `npm run build`
- e2e (ต้องมีเซิร์ฟเวอร์รันอยู่ + DB ที่ seed แล้ว + `psql`; เขียนเป็น bash — บน Windows ใช้ Git Bash/WSL): `scripts/e2e-auth.sh` (login lockout, เชิญ, รีเซ็ตรหัส, ปิดบัญชี) และ `scripts/e2e-items.sh` (สิทธิ์/สืบทอด/409/ความลึก + ป้าย/tag/Markdown) ตั้งตัวแปร env `B`, `PSQL`, `ADMIN_EMAIL`, `ADMIN_PW`, `MEMBER_EMAIL`, `PY` ให้ตรงกับเครื่อง — บนเครื่องนี้: `PY=python` (python3 เป็นแค่ stub ของ Store), `PSQL="docker exec -i source-db-1 psql -U inventory inventory"`, `B=http://localhost:3100`
- e2e-items.sh นับจำนวนแบบ workspace ว่าง จึงควรรันกับ workspace ใหม่ที่มี admin คนเดียว และ `MEMBER_EMAIL` ที่ไม่เคยใช้ (ผลล่าสุด 2026-11-06 หลังสัปดาห์ 6: 163/163 ผ่าน) · ข้อความไทยใน curl ต้องเขียนเป็น `\uXXXX`/`%XX` เพราะ Git Bash ทำ argv ภาษาไทยเพี้ยน · `curl -F file=@…` บน Windows อ่าน path แบบ `/tmp/…` ไม่ได้ ต้องใช้ `cygpath -m` (สคริปต์ทำให้แล้ว)
- เพิ่มเทสต์ทุกครั้งที่แตะ permission engine; ทุก endpoint ใหม่ต้องมีเคส "ไม่มีสิทธิ์ → 404" และ "ข้าม workspace"
- ยังไม่มีเทส UI/Playwright (อยู่ในแผนสัปดาห์ 8) — หน้า Editor/Detail/หน้าแรก ตรวจในเบราว์เซอร์แล้ว แต่หน้า Login/Admin/Collection ของสัปดาห์ 2–3 ยังไม่ได้ไล่ดูละเอียดเทียบ ui-design
- พอร์ต 3000 บนเครื่องนี้มีบริการอื่น (Gotenberg) จับอยู่ — `.claude/launch.json` รัน dev ที่ **3100**
- **ห้ามรัน `next dev` สองตัวพร้อมกันในโฟลเดอร์ `source/`** (ใช้ `.next` ร่วมกัน → chunk 404 / หน้าเว็บพัง) ถ้าเกิดแล้ว: ปิดทุกตัว `rm -rf .next` แล้วเปิดใหม่ตัวเดียว

## รูปแบบรายการ (D22) — ข้อควรรู้

- รายการทุกชิ้นเป็น Note: `title`, `summary`, `body` (Markdown), `kinds` (text[] ⊆ note/snippet/script/link, ≥ 1), tag, (ไฟล์แนบ สัปดาห์ 5 อยู่ใต้ Note) — **ไม่มี** `type`, `url`, `script_meta`, ตาราง `item_code_blocks` แล้ว (ลบใน `0003_note_kinds.sql` หลังแปลงข้อมูลเก่าเป็น Markdown)
- โค้ดอยู่ใน code fence ของ body: แสดงผลด้วย `MarkdownView` (rehype-sanitize **ก่อน** แล้วจึง Shiki) + `CodePre` (แถบภาษา · N บรรทัด + Copy)
- API: `POST/PUT /items` รับ `kinds` (ไม่ส่ง = `["note"]`), `GET /items?kind=` · ป้ายเรียงตามลำดับ KINDS และไม่ซ้ำ
- `PUT /items/:id` แทนที่ทั้งก้อน: ไม่ส่ง `tags` = ลบ tag ทั้งหมด, ไม่ส่ง `kinds` = กลับเป็น `["note"]` (Editor ส่งครบเสมอ)
- snapshot ใน `item_versions` ก่อน D22 ยังมีรูปแบบเก่า (`url`/`scriptMeta`/`codeBlocks` ไม่มี `kinds`) — หน้า History (สัปดาห์ 5) ต้องรองรับทั้งสองแบบ
- tag ใช้ร่วมทั้ง workspace (unique `workspace_id+slug`); ชื่อที่แสดงคือชื่อที่พิมพ์ครั้งแรก · `listTags` แสดงเฉพาะที่ผูกกับรายการที่มองเห็น · เรียงด้วย collation th-TH (ไทยมาก่อน)
- Shiki คืน HTML ที่มี `style` inline และ CodeMirror inject `<style>` — ตอนใส่ CSP strict ต้องอนุญาต `style-src 'unsafe-inline'` หรือใช้ nonce/class
- หน้า `/tags/[slug]` เป็นลิสต์ชั่วคราว จะถูกแทนด้วยหน้าค้นหา `tag:` ในสัปดาห์ 6 · ตัวกรอง `lang:` ในสัปดาห์ 6 ให้หาจาก code fence ใน body (`` ```bash ``)

## สัปดาห์ 5 — ไฟล์แนบ / History / 409 — ข้อควรรู้

- **ไฟล์แนบ** (design §9, D22: อยู่ใต้ Note ไม่มีประเภท File): เก็บที่ `{FILES_DIR}/{workspace_id}/{uuid}` (ไม่มีชื่อจริงใน path) · dev บน Windows ตั้ง `FILES_DIR=./data/files` ใน `.env` (ถ้าใช้ `/data/files` จะกลายเป็น `D:\data\files`) และ `data/` ถูก ignore · ≤ 50 MB/ไฟล์, ≤ 50 ไฟล์/รายการ · อัปโหลดอ่านทั้งไฟล์เข้าหน่วยความจำ (พอสำหรับทีมเล็ก; ถ้าต้องรองรับไฟล์ใหญ่ขึ้นให้เปลี่ยนเป็น stream)
- **MIME ตรวจจากเนื้อไฟล์จริง** (`sniffMime`): รู้จัก png/jpeg/gif/webp/pdf/zip/gzip นอกนั้น `application/octet-stream` · แสดง inline เฉพาะรูปแรสเตอร์ (**ไม่รวม SVG**) ที่เหลือบังคับ `Content-Disposition: attachment` · header: `nosniff`, `Cache-Control: private, no-store`, CSP `default-src 'none'; sandbox`
- ไฟล์แนบไม่มีสิทธิ์ของตัวเอง: ทุก endpoint ตรวจผ่านรายการแม่ (`loadItem`/`canEdit`) ไม่มีสิทธิ์/ไม่มี/ถูกลบ = 404 · ลบ = soft delete (`deleted_at`) ไฟล์จริงลบตอน purge ถังขยะ (สัปดาห์ 7 — **ต้องลบไฟล์บนดิสก์ด้วย**) · อัปโหลด/ลบ/ผ่าน `refreshSearchText` อัปเดต `search_text` (ชื่อไฟล์ค้นเจอ) และเขียน audit `attachment.uploaded|deleted`
- รายการใหม่: Editor เก็บไฟล์ไว้ก่อนแล้วอัปโหลดหลังสร้างรายการสำเร็จ (ถ้าบางไฟล์ล้มเหลวจะพาไปหน้าแก้ไข) · ปุ่ม "ลิงก์" คัดลอก Markdown (`![ชื่อ](/api/v1/attachments/:id/download)` สำหรับรูป) ไปวางในเนื้อหา
- **History**: `GET /items/:id/versions[/:v]`, `POST …/versions/:v/restore` (body `{version}` = เวอร์ชันปัจจุบันที่ผู้ใช้เห็น → optimistic locking) · กู้ = เวอร์ชันใหม่เสมอ **ไม่ merge** กับเวอร์ชันล่าสุดแม้เป็นคนเดิมภายใน 5 นาที (`updateItem(..., { noMerge: true })`) · สิทธิ์ตรวจก่อนเงื่อนไขอื่น (ดูได้แต่แก้ไม่ได้ = 403 ก่อน 422 `already_current`) · กู้เฉพาะ title/summary/body/kinds/tags (ไม่แตะสิทธิ์/Collection/ไฟล์แนบ)
- snapshot ก่อน D22 ถูกแปลงตอนอ่านด้วย `snapshotToView` ให้ได้ Markdown แบบเดียวกับ migration 0003 (ไม่แก้ข้อมูลเดิมใน DB)
- **409**: payload `current` = `{version,title,summary,body,kinds,tags,editedBy,editedAt}` · `ConflictDialog` (กว้าง 720 — สเปก ui-design ระบุ 560 แต่ diff แบบ 2 คอลัมน์แคบเกินไป) 3 ทาง: ใช้ของล่าสุดแล้วแก้ใหม่ / บันทึกทับ / คัดลอกของฉันเก็บไว้ก่อน
- ยังไม่มี "กำลังแก้ไขโดย …" (heartbeat, design §10.2 ท้ายหัวข้อ — best-effort) และการรวมเวอร์ชันยังไม่มีนโยบายจำกัดจำนวน (เก็บทุกเวอร์ชัน)

## สัปดาห์ 6 — ค้นหา — ข้อควรรู้

- **API**: `GET /api/v1/search?q=&kind=&tag=&lang=&page=` (ผล 20/หน้า + `total` + `facets{kinds,tags,langs}` + `didYouMean`) และ `GET /api/v1/search/quick?q=` (ชื่อ/tag สูงสุด 8) · หน้า `/search` (`/tags/:slug` redirect มาที่นี่) · Ctrl/⌘+K เปิด palette จากทุกหน้า (Enter = เปิดรายการ, Ctrl+Enter = ผลค้นหาเต็ม)
- **ไวยากรณ์**: คำ AND, `"วลี"`, `-คำ` (มีแต่ `-คำ` ก็ค้นได้), `tag:` `kind:`/`type:` `lang:` `in:"ชื่อ Collection"` (รวม sub-collection, นับเฉพาะ Collection ที่ผู้ถามเห็น) `owner:me` `is:private` · ตัวกรองจาก UI (`kind`/`tag`/`lang`) ถูกรวมเข้าไวยากรณ์เดียวกันใน `mergeQuery` · จำกัดคำค้น 200 ตัวอักษร / 12 คำ
- **สิทธิ์**: `visibleItemsWhere` อยู่ใน WHERE ของ **ทุก** query (ผล, total, facet 3 ชนิด, คำแนะนำ, quick) · facet/total/ข้อความตัวอย่างจึงไม่รั่วรายการ private ของคนอื่นแม้เป็น Admin · breadcrumb ใช้ `canView` ของ Collection (หยุดที่ชั้นที่ไม่มีสิทธิ์เห็น)
- **ภาษา (`lang:` และ facet)** หาจาก code fence ใน body (regex `` ```lang ``) ไม่ใช่ตาราง · ชื่อภาษาหลัง ``` **ไม่อยู่ใน `search_text`** (stripMarkdown ตัดทิ้ง) จึงค้นด้วยคำว่า "python" ไม่เจอเพียงเพราะเป็นภาษาของ block — ต้องใช้ `lang:python`
- **คะแนน**: ชื่อมีคำแรก 10 + คำอื่นในชื่อ 3/คำ + tag ตรง 6 + summary ตรง 2 + 4×สัดส่วนที่คำค้นครอบคลุมชื่อ · **ห้ามกลับไปใช้ `word_similarity` กับ `search_text`/ชื่อ** (pg_trgm ภายใต้ ICU th-TH ช้า: 50,000 แถว ≈ 390 ms) — ดู design §8.4
- **ไฮไลต์**: server ส่งส่วนข้อความ `{t, m}` ไม่ใช่ HTML (React escape ให้) · เลขบรรทัดคือบรรทัดภายใน code block
- **คำแนะนำ "คุณหมายถึง…"** เมื่อไม่พบผล: tag (similarity > 0.2) + ชื่อรายการ (word_similarity > 0.3) เฉพาะที่ผู้ถามเห็น
- **เปิดล่าสุด** ใน palette เก็บใน localStorage ของเบราว์เซอร์ คีย์ตาม user id (`di-recent:<userId>`) ไม่ขึ้น server — ใช้ได้โดยไม่มี localStorage
- ทดสอบความเร็ว: สร้าง workspace ชั่วคราว + `generate_series` 50,000 แถว ใส่ ICU th-TH แล้วลบทิ้ง (สคริปต์ไม่อยู่ใน repo) ถ้าแก้ query ค้นหาให้วัดซ้ำด้วยคำที่ตรงทุกแถว (กรณีแย่สุด)

## ช่องว่างที่รู้อยู่แล้ว (ทำตอนถึงสัปดาห์ที่เกี่ยวข้อง)

- dialog ย้ายรายการเตือนแบบรวม ๆ ยังไม่แยกกรณี "สิทธิ์เปิดกว้างขึ้น" (design §4.4.4)
- ลบรายการ = soft delete เท่านั้น ยังไม่มีหน้าถังขยะ/กู้คืน (สัปดาห์ 7)
- ยังไม่มี endpoint `/me`, `/auth/methods`, `/trash`, admin `private-items`/`audit-logs`/`settings`/transfer
- ตรรกะ `canTransfer` มีและทดสอบแล้ว แต่ยังไม่มี endpoint/หน้าจอ (TransferDialog ออกแบบไว้แล้วในแคนวาส)
- แอปตั้ง `X-Frame-Options` ฯลฯ เบื้องต้นใน `next.config.ts`; CSP แบบ strict ยังไม่ได้ใส่
- Dockerfile/compose ผ่านการเขียนแล้วแต่ **ยังไม่เคย build จริง** (service `migrate` ใช้ stage `build`); backup (restic) อยู่สัปดาห์ 7

## ธรรมเนียมการทำงาน

- ทำเป็นขั้นเล็ก ๆ และรัน `npm run typecheck && npm test` ก่อน commit; ฟีเจอร์ที่แตะ API ให้รัน e2e ที่เกี่ยวข้องด้วย
- commit message ภาษาอังกฤษ สั้น บอกว่าทำอะไรและทำไม; branch หลักคือ `main`
- แก้ `schema.ts` ต้องแก้ SQL migration ให้ตรงกันเสมอ
- ไม่ใส่ข้อมูลลับใน repo (`.env` ถูก ignore); อย่า log รหัสผ่าน/token; รหัสชั่วคราวและลิงก์เชิญแสดงครั้งเดียว
- ผู้ใช้ไม่ใช่นักพัฒนาประจำของโปรเจกต์นี้ทุกขั้นตอน — อธิบายสั้น ๆ ว่าต้องรันอะไรและคาดหวังผลอย่างไร และเมื่อเจอ error ให้ขอข้อความ error จริงจาก terminal ก่อนเดา
