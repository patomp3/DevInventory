-- D22 (2026-11-05): รายการทุกชิ้นเป็น "Note" ชนิดเดียว เนื้อหาทั้งหมด (โค้ด, ลิงก์, วิธีรัน) อยู่ใน Markdown
-- ประเภทเดิมกลายเป็น "ป้าย" (kinds) เลือกได้หลายป้าย: note, snippet, script, link
-- ข้อมูลเดิมถูกแปลงเป็น Markdown ใน body ก่อนลบคอลัมน์/ตารางเก่า (ไม่มีข้อมูลหาย)

ALTER TABLE items ADD COLUMN kinds text[] NOT NULL DEFAULT '{note}';
ALTER TABLE items ADD CONSTRAINT items_kinds_valid
  CHECK (cardinality(kinds) >= 1 AND kinds <@ ARRAY['note','snippet','script','link']::text[]);

-- fence ของ code block ต้องยาวกว่า backtick ที่ติดกันยาวที่สุดในเนื้อหา
CREATE FUNCTION pg_temp.md_fence(content text) RETURNS text AS $$
  SELECT repeat('`', greatest(3, coalesce((SELECT max(length(m[1])) FROM regexp_matches(content, '(`+)', 'g') AS m), 0) + 1));
$$ LANGUAGE sql IMMUTABLE;
CREATE FUNCTION pg_temp.md_cell(v text) RETURNS text AS $$
  SELECT replace(replace(coalesce(v, ''), '|', '\|'), E'\n', ' ');
$$ LANGUAGE sql IMMUTABLE;

WITH code AS (
  SELECT b.item_id,
         string_agg(
           concat_ws(E'\n',
             CASE WHEN b.filename IS NOT NULL THEN '**' || b.filename || '**' || E'\n' END,
             f.fence || CASE WHEN b.language = 'text' THEN '' ELSE b.language END || E'\n' || rtrim(b.content, E'\r\n') || E'\n' || f.fence),
           E'\n\n' ORDER BY b.sort_order) AS md
  FROM item_code_blocks b CROSS JOIN LATERAL (SELECT pg_temp.md_fence(b.content) AS fence) f
  GROUP BY b.item_id
),
script AS (
  SELECT i.id AS item_id,
         concat_ws(E'\n\n',
           '## วิธีรัน',
           CASE WHEN coalesce(i.script_meta->>'run_example', '') <> '' THEN
             pg_temp.md_fence(i.script_meta->>'run_example') || E'sh\n' || (i.script_meta->>'run_example') || E'\n' || pg_temp.md_fence(i.script_meta->>'run_example') END,
           'Shell: `' || coalesce(i.script_meta->>'shell', 'bash') || '`'
             || CASE WHEN jsonb_array_length(coalesce(i.script_meta->'os', '[]')) > 0
                  THEN ' · OS: ' || (SELECT string_agg(o, ', ') FROM jsonb_array_elements_text(i.script_meta->'os') o) ELSE '' END,
           CASE WHEN jsonb_array_length(coalesce(i.script_meta->'params', '[]')) > 0 THEN
             E'| Parameter | คำอธิบาย | จำเป็น | ค่าเริ่มต้น |\n|---|---|---|---|\n' ||
             (SELECT string_agg('| `' || pg_temp.md_cell(p->>'name') || '` | ' || pg_temp.md_cell(p->>'desc') || ' | '
                                || CASE WHEN (p->>'required')::boolean THEN 'ใช่' ELSE '—' END || ' | ' || pg_temp.md_cell(p->>'default') || ' |', E'\n')
              FROM jsonb_array_elements(i.script_meta->'params') p) END) AS md
  FROM items i WHERE i.script_meta IS NOT NULL
)
UPDATE items i SET
  kinds = CASE i.type WHEN 'file' THEN ARRAY['note'] ELSE ARRAY[i.type::text] END,
  body = nullif(concat_ws(E'\n\n',
    CASE WHEN i.url IS NOT NULL THEN '<' || i.url || '>' END,
    s.md,
    c.md,
    CASE WHEN c.md IS NOT NULL AND coalesce(i.body, '') <> '' THEN E'## วิธีใช้\n\n' || i.body ELSE nullif(i.body, '') END
  ), '')
FROM items x
LEFT JOIN code c ON c.item_id = x.id
LEFT JOIN script s ON s.item_id = x.id
WHERE x.id = i.id;
-- search_text เดิมรวมโค้ด/ชื่อไฟล์/URL/วิธีรันไว้แล้ว จึงยังค้นเจอเหมือนเดิม และจะสร้างใหม่ตอนแก้ไขครั้งถัดไป
-- snapshot เก่าใน item_versions ยังเป็นรูปแบบเดิม (มี codeBlocks/url/scriptMeta) — หน้า History ต้องรองรับทั้งสองแบบ

ALTER TABLE items DROP COLUMN type, DROP COLUMN url, DROP COLUMN script_meta;
DROP TABLE item_code_blocks;
DROP TYPE item_type;

-- ตัวกรองตามป้าย (kind: / ตัวกรองในหน้า Collection และค้นหา)
CREATE INDEX items_kinds ON items USING gin (kinds) WHERE deleted_at IS NULL;
