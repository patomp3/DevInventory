-- สัปดาห์ 4: Snippet / Script (หลาย code block) และ tag (design.md §6.2, §8.7)
-- ตาราง item_code_blocks / tags / item_tags มีตั้งแต่ 0000 แล้ว ไฟล์นี้เพิ่ม index และข้อจำกัดที่ต้องใช้

-- อ่าน code block ของรายการตามลำดับ (หน้า Detail / Editor)
CREATE INDEX item_code_blocks_item ON item_code_blocks (item_id, sort_order);
-- ตัวกรอง lang: ในการค้นหา (§8.3)
CREATE INDEX item_code_blocks_lang ON item_code_blocks (language);
-- autocomplete / tag cloud: join จาก tag → รายการ
CREATE INDEX item_tags_tag ON item_tags (tag_id);

-- slug เป็นตัวพิมพ์เล็กเสมอ ไม่มีช่องว่าง และไม่ยาวเกิน 40 ตัวอักษร (ตรงกับ normalizeTag ใน src/lib/item-content.ts)
ALTER TABLE tags ADD CONSTRAINT tags_slug_format
  CHECK (slug = lower(slug) AND slug !~ '\s' AND char_length(slug) BETWEEN 1 AND 40);
