-- ธีมที่ผู้ใช้เลือก (light/dark) เก็บต่อผู้ใช้; ผู้ใช้เดิมเป็น dark (ค่าเดิมของแอป)
ALTER TABLE users ADD COLUMN theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark'));
