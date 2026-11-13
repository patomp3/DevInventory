-- ภาษาที่ผู้ใช้เลือก (เมนูเปลี่ยนภาษา) เก็บต่อผู้ใช้; ผู้ใช้เดิมเป็นไทย
ALTER TABLE users ADD COLUMN locale text NOT NULL DEFAULT 'th' CHECK (locale IN ('th', 'en'));
