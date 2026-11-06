# PROGRESS — Dev Inventory (session 2026-11-05: สัปดาห์ 4 + เปลี่ยนเป็น Note ชนิดเดียว D22)

> **อัปเดตล่าสุด (D22):** ผู้ใช้ตัดสินให้รายการทุกชิ้นเป็น "Note" ชนิดเดียว เนื้อหาเป็น Markdown ทั้งหมด และเลือก "ป้าย" note/snippet/script/link ได้หลายป้าย ส่วน Snippet/Script แบบหลายไฟล์, ฟอร์ม Script และช่อง URL ที่ทำในสัปดาห์ 4 **ถูกถอดออกแล้ว** (ข้อมูลเดิมแปลงเป็น Markdown) — ส่วนด้านล่างที่พูดถึง code block / script_meta เป็นประวัติก่อน D22

## เป้าหมาย (Objective)

Dev Inventory คือคลังความรู้ภายในทีม dev (ไม่เกิน 10 คน) เก็บโค้ด/snippet/script/note/ลิงก์ ค้นหาได้ (รวมภาษาไทย) และควบคุมสิทธิ์
Session นี้ทำ **สัปดาห์ 4 ตามแผน design.md §17**: เปิดใช้ประเภท **Snippet / Script** (หลาย code block ต่อรายการ, editor CodeMirror 6, แสดงผล Shiki) และ **Tag** (autocomplete ที่กรองตามสิทธิ์ ไม่ให้ tag ของรายการ private รั่ว) แล้วตรวจทั้ง unit test, service, HTTP e2e และหน้าจอจริงในเบราว์เซอร์

แหล่งความจริงหลัก: `docs/design.md` (v1.3) และ `docs/ui-design.md` (v1.4) · กฎการทำงานอยู่ใน `CLAUDE.md`

## สิ่งที่ทำไปแล้ว (Progress / Completed)

**D22 — Note ชนิดเดียว + ป้าย (ทำหลังสัปดาห์ 4 ในวันเดียวกัน)**
- `source/drizzle/0003_note_kinds.sql` (รันแล้ว): เพิ่ม `items.kinds text[]` (CHECK ⊆ note/snippet/script/link, ≥ 1) + GIN index `items_kinds`; แปลงข้อมูลเก่าเป็น Markdown ใน `body` (URL → `<url>`, script_meta → หัวข้อ "วิธีรัน" + ตาราง parameter, code blocks → `**ชื่อไฟล์**` + code fence) แล้วลบ `items.type/url/script_meta`, ตาราง `item_code_blocks`, enum `item_type` · สำรอง DB ก่อนรันไว้ที่ `before-0003.dump` (scratchpad)
- Service/API: `prepareContent` ไม่มีประเภทแล้ว, `kinds` ใน create/update/snapshot/409, `GET /items?kind=`, `buildSearchText` ใช้เฉพาะ body (ตัดที่ 200 KB, แตก identifier จาก body)
- UI: Editor เดียว (ป้ายเป็น checkbox 2×2, เนื้อหา Markdown ใน CodeMirror พร้อม highlight code fence), ปุ่ม "+ สร้างใหม่" ไปที่ `/new` ตรง ๆ, หน้า Detail render Markdown ด้วย `MarkdownAsync` → rehype-sanitize → `@shikijs/rehype` + `CodePre` (ภาษา · N บรรทัด + Copy + เลขบรรทัด), `KindChips` ในรายการ/Detail
- ลบ: `CodeBlock.tsx`, `CreateMenu.tsx`, ฟอร์ม Script, `LANGUAGES`/`guessLanguage`/`scriptMetaSchema`
- เทสต์: unit 54/54, e2e-items.sh 56/56 (ปรับเป็นป้าย/Markdown), typecheck ผ่าน, ตรวจในเบราว์เซอร์: สร้าง Note 3 ป้าย + code fence 2 block, Copy ใช้ได้, รายการที่แปลงจากข้อมูลเก่าแสดงถูก
- เอกสาร: design.md v1.3 (D22, §3, §6, §8, §12, §13, §17), ui-design.md v1.4, CLAUDE.md
- อื่น ๆ วันเดียวกัน: รีเซ็ตรหัส `admin@example.com` (เคยตั้งด้วยแป้นไทย) และล้างการล็อก — บันทึก audit `user.password_reset`; สร้าง `run.txt`

**สัปดาห์ 4 (ก่อน D22)**

**ฐานข้อมูล**
- `source/drizzle/0002_code_tags.sql` (รันแล้วบน dev DB): index `item_code_blocks_item (item_id, sort_order)`, `item_code_blocks_lang (language)`, `item_tags_tag (tag_id)` และ CHECK `tags_slug_format` (slug ตัวเล็ก ไม่มีช่องว่าง 1–40 ตัว) — `schema.ts` ปรับให้ตรงแล้ว (ตารางเดิมมีตั้งแต่ 0000 ไม่ต้องสร้างใหม่)

**Service / logic**
- `src/lib/item-content.ts` (ใหม่, pure ไม่ import db): `AVAILABLE_TYPES` = note/snippet/script/link, รายการภาษา `LANGUAGES` (Shiki id ↔ ชื่อใน CodeMirror ↔ นามสกุลไฟล์), `guessLanguage`, `LIMITS`, `normalizeTag(s)`, `codeBlockSchema`, `scriptMetaSchema` (`{shell, os[], params[{name,desc,required,default}], run_example}`), `prepareContent()` (ตรวจ/จัดรูปตามประเภท แทน `validateContent` เดิม), `downloadName`
- `src/lib/item-schema.ts` (ใหม่): zod body ของ POST/PUT items
- `src/lib/tags.ts` (ใหม่): `replaceItemTags` (upsert tag + ผูกใหม่ใน transaction เดียวกับรายการ), `tagsForItems`, `listTags` (ผ่าน `visibleItemsWhere` นับเฉพาะรายการที่มองเห็น, prefix match ขึ้นก่อน)
- `src/lib/items.ts`: create/update เขียน code blocks + tags + `script_meta`; `search_text` รวมโค้ด/ชื่อไฟล์/tag/run_example/params; snapshot ใน `item_versions` มี `scriptMeta`, `codeBlocks`, `tags`; `getItemDetail` คืน `codeBlocks`, `tags` (และไม่คืน `searchText` แล้ว); `listItems` รองรับ filter `type`, `tag` และคืน `tags` ต่อแถว
- `src/lib/highlight.ts` (ใหม่): Shiki ฝั่ง server, JS regex engine (ไม่ใช้ WASM), ธีมเองตามสี ui-design §3.1, โหลดภาษาเฉพาะที่ใช้

**API**
- `POST /api/v1/items`, `PUT /api/v1/items/:id` รับ `codeBlocks`, `scriptMeta`, `tags`
- `GET /api/v1/items` เพิ่ม `?type=` และ `?tag=`
- `GET /api/v1/tags?prefix=&limit=` (ใหม่) — autocomplete / tag ยอดนิยม กรองตามสิทธิ์
- ข้อความ error ภาษาไทยของโค้ดใหม่เพิ่มใน `API_ERR` (`src/components/PermissionDialog.tsx`)

**UI**
- `ItemEditor.tsx` เขียนใหม่ตาม ui-design §7.5: เลือกประเภท 4 แบบ, tab หลายไฟล์ (ชื่อไฟล์ + ภาษา + เดาภาษาจากชื่อไฟล์, สูงสุด 20), ฟอร์ม Script (คำสั่งตัวอย่าง, shell, OS, ตาราง parameter), Markdown ด้วย CodeMirror, คอลัมน์ขวา (Collection, สิทธิ์, Tag), Ctrl+S, เตือนก่อนออกถ้ายังไม่บันทึก, dialog 409 แบบง่ายเดิม
- คอมโพเนนต์ใหม่: `CodeEditor` (CodeMirror 6 ธีมเดียวกับ CodeBlock), `CodeBlock` (tab ชื่อไฟล์ + "ภาษา · N บรรทัด" + Copy + Download + เลขบรรทัด), `TagInput` (chip + combobox autocomplete debounce 150ms), `TagChips`, `CreateMenu` (ปุ่ม "+ สร้างใหม่" เลือกประเภท)
- หน้า Detail (`/i/[id]`): tag, ส่วน "วิธีรัน" + ตาราง parameter + shell/OS (Script), CodeBlock, หัวข้อ "วิธีใช้"
- หน้าแรกมี "Tag ที่ใช้บ่อย"; `ItemRow` แสดง tag; หน้าใหม่ `/tags/[slug]` (ลิสต์ชั่วคราว)
- `globals.css` เพิ่มสไตล์ `.code-view` (เลขบรรทัดด้วย CSS counter); `next.config.ts` เพิ่ม `serverExternalPackages: ["shiki"]`
- แพ็กเกจใหม่: `shiki@4.6`, `@codemirror/{state,view,commands,language,language-data,search,autocomplete}`, `@lezer/highlight`

**การทดสอบ (ผลจริง)**
- `npm run typecheck` ผ่าน · `npm test` **58/58 ผ่าน** (เพิ่ม `tests/item-content.test.ts` 20 เคส) · `npm run build` ผ่าน
- ตรวจระดับ service กับ DB จริง (สคริปต์ชั่วคราว ไม่อยู่ใน repo): ผลลัพธ์ถูกทั้งหมด — tag ของรายการ private ไม่โผล่ให้ Admin/คนอื่น, ข้าม workspace = 404, รายการในถังขยะไม่ถูกนับ, 409, ชื่อไฟล์มี path ถูกปฏิเสธ, snapshot/search_text ครบ
- `scripts/e2e-items.sh` เพิ่ม 19 เช็กของสัปดาห์ 4 แล้วรันบน workspace ทดสอบใหม่: **54/54 ผ่าน**
- ตรวจด้วยตาในเบราว์เซอร์ (localhost:3100): สร้าง Script 2 ไฟล์ + tag (เลือกจาก autocomplete + พิมพ์ใหม่) + Ctrl+S, หน้า Detail (highlight, tab, Copy), หน้า Edit — ไม่มี console/server error
- แก้ระหว่างตรวจ: Shiki แสดงบรรทัดว่างเกิน 1 บรรทัดจาก newline ท้ายไฟล์ → ตัด newline ท้ายก่อน highlight

**เอกสาร**
- `CLAUDE.md` อัปเดต: สถานะสัปดาห์ 4 = เสร็จ / สัปดาห์ 5 = ถัดไป, โครงสร้างไฟล์ใหม่, จำนวนเทสต์, วิธีรัน e2e บนเครื่องนี้, ส่วน "สัปดาห์ 4 — สิ่งที่ทำและข้อควรรู้"

## Decision ที่ตกลงกันแล้ว (Key Decisions)

- **D22: รายการทุกชิ้นเป็น Note + ป้าย kinds หลายป้าย** — ผู้ใช้ต้องการลดความซับซ้อน ให้ใส่ทุกอย่างในเนื้อหาเอง · ไฟล์แนบ (สัปดาห์ 5) อยู่ใต้ Note ไม่มีประเภท File
- **ป้าย = ชุดตายตัว 4 ค่า แยกจาก tag** (เลือก ≥ 1, ค่าเริ่มต้น note) — กรอง/ค้นด้วย `kind:` ได้แน่นอน ไม่ปนกับ tag อิสระ
- **แปลงข้อมูลเก่าเป็น Markdown แทนการลบ** และ **อัปเดต design.md/ui-design.md ให้ตรงกับโค้ด** (ผู้ใช้เลือกเอง)
- **render Markdown ฝั่ง server: sanitize ก่อน แล้วค่อย Shiki** — ไม่ให้ HTML ดิบผ่าน แต่คง style ของ Shiki
- (การตัดสินใจด้านล่างที่เกี่ยวกับ code block หลายไฟล์ / script_meta / ข้อจำกัดต่อไฟล์ ถูกแทนด้วย D22)

- **แยก logic เนื้อหาเป็น pure module (`item-content.ts`)** — ใช้ร่วม server/client/unit test ได้โดยไม่ต้องต่อ DB
- **`PUT /items/:id` = แทนที่ทั้งก้อน** — code blocks และ tag ถูกลบแล้วเขียนใหม่ทุกครั้ง ง่ายและสอดคล้องกับ snapshot ต่อเวอร์ชัน (ข้อเสีย: ไม่ส่ง `tags` = ลบ tag ทั้งหมด, Snippet/Script ต้องส่ง `codeBlocks` เสมอ)
- **Tag ใช้ร่วมทั้ง workspace** (unique `workspace_id + slug`), ชื่อที่แสดง = ชื่อที่พิมพ์ครั้งแรก; tag กำพร้าไม่ลบ แต่ `listTags` แสดงเฉพาะที่ผูกกับรายการที่มองเห็น — ตาม design §8.7
- **slug ของ tag**: ตัวเล็ก, ช่องว่าง → `-`, คงตัวอักษรไทย/สระ/วรรณยุกต์ และ `- _ . + #`, ≤ 40 ตัว, ≤ 20 tag ต่อรายการ (บังคับซ้ำด้วย CHECK ใน DB)
- **Shiki render ฝั่ง server + JS regex engine** — ไม่ต้องจัดการ WASM ใน webpack, ไม่ส่ง grammar ไปฝั่ง client; HTML ที่ได้ escape แล้ว
- **ข้อจำกัด**: ≤ 20 ไฟล์/รายการ, ≤ 500,000 ตัวอักษร/ไฟล์, รวม ≤ 1,000,000; ชื่อไฟล์ห้ามมี `/` `\` และอักขระควบคุม; `search_text` ตัดโค้ดที่ 200 KB (ของเดิม)
- **Download ทำฝั่ง client ด้วย Blob** — ไม่ต้องเพิ่ม endpoint
- **ทดสอบโดยไม่ใช้รหัส admin ของผู้ใช้**: สร้าง workspace + ผู้ใช้ทดสอบแยกใน dev DB (ผู้ใช้ตกลงให้รัน e2e เอง)
- **dev server รันพอร์ต 3100** เพราะพอร์ต 3000 ถูกบริการอื่น (Gotenberg) ใช้อยู่

## สิ่งที่ยังค้างอยู่ / ปัญหาที่เจอ (Open Issues / Blockers)

- ไม่มี blocker
- repo GitHub **`patomp3/DevInventory` เป็น public** — ระวังอย่า commit ข้อมูลลับ (`.env`, dump, cookie jar); `Claude outputs/` ถูก ignore
- CSP แบบ strict ยังไม่ได้ใส่: Shiki ใช้ `style` inline และ CodeMirror inject `<style>` → ตอนใส่ CSP ต้องอนุญาต `style-src 'unsafe-inline'` หรือใช้ `EditorView.cspNonce`/class
- dialog 409 ยังเป็นแบบง่าย (บันทึกทับ / เปิดเวอร์ชันล่าสุด) — แบบ 3 ทางเต็มอยู่สัปดาห์ 5
- ข้อมูลทดสอบค้างใน dev DB: workspace "W4 test" (3 ผู้ใช้) และ workspace `e2e-*` หลายชุด — ลบไม่ได้ง่ายเพราะ `audit_logs` เป็น append-only (FK) ถ้าต้องการสะอาดให้ `docker compose … down -v` แล้ว migrate/seed ใหม่
- หน้า Login/Admin/Collection ของสัปดาห์ 2–3 ยังไม่ได้ไล่ตรวจด้วยตาเทียบ ui-design
- ข้อจำกัดเครื่อง Windows: Git Bash ทำ argv ภาษาไทยเพี้ยน และ Python อ่าน stdin ไม่ใช่ UTF-8 (แก้ใน e2e-items.sh แล้ว; e2e-auth.sh ยังไม่ได้ปรับ `PY`/อีเมล)

## Next Steps

0. (หลัง D22) ไม่มีงานค้างของการเปลี่ยนนี้ — งานถัดไปตามลำดับด้านล่าง; ตอนทำหน้า History ต้องรองรับ snapshot รูปแบบเก่า

1. (เสร็จ 2026-11-06) ต่อโฟลเดอร์เข้ากับ git `https://github.com/patomp3/DevInventory` (branch `main`) และ push งานสัปดาห์ 4 + D22
2. **สัปดาห์ 5**: ไฟล์แนบใต้ Note (`attachments`, Dropzone ในคอลัมน์ขวาของ Editor, ดาวน์โหลดตรวจสิทธิ์ทุกครั้ง, ≤ 50 MB — ไม่มีประเภท File แล้ว), หน้า History + diff (`GET /items/:id/versions…`, กู้เวอร์ชัน = เวอร์ชันใหม่), dialog 409 แบบ 3 ทาง (design §10.2)
3. ปรับ `scripts/e2e-auth.sh` ให้รับ `ADMIN_EMAIL`/`PY` แบบเดียวกับ e2e-items.sh แล้วรันบน workspace ทดสอบ
4. ไล่ตรวจหน้าจอสัปดาห์ 2–3 ในเบราว์เซอร์เทียบ ui-design
5. สัปดาห์ 6: หน้าค้นหาเต็มรูปแบบ (แทนหน้า `/tags/[slug]` ด้วย `tag:`), Ctrl+K, facet ตามป้าย, `kind:` (index `items_kinds`), `lang:` หาจาก code fence ใน body
6. ตอนใส่ CSP strict: จัดการ inline style ของ Shiki/CodeMirror

## Context สำคัญอื่นๆ (Notes)

- **ห้ามรัน `next dev` สองตัวพร้อมกันในโฟลเดอร์ `source/`** — ใช้ `.next` ร่วมกันแล้ว chunk 404 (เกิดขึ้นจริงใน session นี้) แก้โดยปิดทุกตัว `rm -rf .next` แล้วเปิดใหม่
- สำรอง DB ก่อน migration 0003: `C:\Users\PATOMP~1\AppData\Local\Temp\claude\a73355957480c67d\300e579c-0852-4c8d-9c9c-4acb0ee91fd2\scratchpad\before-0003.dump` (กู้ด้วย `pg_restore`; ไฟล์ชั่วคราว)

- **โครงสร้าง**: โค้ดทั้งหมดใน `source/` (รัน npm จากที่นั่น) · เอกสารออกแบบอยู่ใน `docs/` (`docs/design.md`, `docs/ui-design.md`) · `CLAUDE.md`, `PROGRESS.md`, `run.txt`, `README.md` อยู่ที่ root · git remote `origin` = https://github.com/patomp3/DevInventory (branch `main`) · `.claude/launch.json` ที่ root รัน `npm --prefix source run dev -- -p 3100`
- **DB dev**: container `source-db-1`, พอร์ต 5433, user/db = `inventory`/`inventory`; เครื่องนี้ไม่มี `psql` → `docker exec -i source-db-1 psql -U inventory inventory`
- **รัน e2e-items.sh บนเครื่องนี้**: ต้องมี server ที่ 3100 + workspace ใหม่ที่มี admin คนเดียว แล้วตั้ง `B=http://localhost:3100 PY=python PSQL="docker exec -i source-db-1 psql -U inventory inventory" ADMIN_EMAIL=… ADMIN_PW=… MEMBER_EMAIL=<อีเมลที่ไม่เคยใช้>`; ข้อความไทยใน curl ต้องเป็น `\uXXXX` / `%XX`
- **บัญชีทดสอบสำหรับเปิดดู UI** (workspace "W4 test"): อีเมลและรหัสผ่านอยู่ในไฟล์ scratchpad `C:\Users\PATOMP~1\AppData\Local\Temp\claude\a73355957480c67d\300e579c-0852-4c8d-9c9c-4acb0ee91fd2\scratchpad\w4-test-login.txt` (ไฟล์ชั่วคราว อาจหายเมื่อ session ถูกล้าง — ถ้าหายให้สร้างผู้ใช้ทดสอบใหม่)
- **ลำดับ tag** เรียงด้วย collation th-TH → ภาษาไทยมาก่อนอังกฤษ (ตั้งใจ ไม่ใช่บั๊ก)
- `npm install` ต้องใช้ `.npmrc` legacy-peer-deps เดิม; npm เตือน `allow-scripts` ของ esbuild (ไม่กระทบการทำงาน)
- กฎสำคัญยังเหมือนเดิม (ดู CLAUDE.md): สิทธิ์ตัดสินที่ `src/lib/permissions` + `visibleItemsWhere` ใน SQL เท่านั้น, ไม่มีสิทธิ์ = 404, migration ที่ merge แล้วห้ามแก้ (เพิ่ม `0003_*.sql` ใหม่), ทุก endpoint ใหม่ต้องมีเทส "ไม่มีสิทธิ์ → 404" และ "ข้าม workspace", ตอบผู้ใช้เป็นภาษาไทย
