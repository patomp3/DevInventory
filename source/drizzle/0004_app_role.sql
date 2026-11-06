-- สัปดาห์ 8 (design.md §14 "Database"): role สิทธิ์ต่ำสำหรับแอป — ไม่ใช่ superuser, ไม่แก้ schema, และ UPDATE/DELETE/TRUNCATE ตาราง audit_logs ไม่ได้
-- migration รันด้วยเจ้าของ (DATABASE_URL เดิม) ส่วนแอปใช้ role นี้ (ตั้งรหัสผ่านด้วย: npm run db:app-user) · ถ้าไม่ตั้ง แอปยังใช้ role เดิมได้ (dev)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'inventory_app') THEN
    CREATE ROLE inventory_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO inventory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO inventory_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO inventory_app;

-- audit_logs: อ่านและเพิ่มได้เท่านั้น (ชั้นที่สองต่อจาก trigger append-only)
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM inventory_app;
-- ตารางของระบบ migration: แอปไม่ต้องแตะ
REVOKE ALL ON _migrations FROM inventory_app;

-- ตารางที่เจ้าของสร้างใน migration ถัด ๆ ไปได้สิทธิ์ชุดเดียวกันอัตโนมัติ (ต้องเพิ่ม REVOKE เองถ้าเป็นตารางที่ต้อง append-only)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO inventory_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO inventory_app;
