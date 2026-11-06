// งานรายคืน (design.md §10.3): ลบถาวรรายการที่อยู่ในถังขยะเกิน 30 วัน รวมไฟล์แนบจริง + ไฟล์แนบที่ถูกลบมาเกิน 30 วัน
// รัน: npm run job:purge  (compose service "purge" รันวันละครั้ง) · บันทึก audit item.purged / attachment.purged (actor = ไม่มี, reason = retention)
import { purgeExpired } from "@/lib/trash";

const r = await purgeExpired();
console.log(`purged ${r.items} item(s), ${r.attachments} attachment(s)`);
process.exit(0);
