# Dev Inventory — Runbook (การดูแลระบบ)

> สำหรับผู้ดูแลเซิร์ฟเวอร์ · เวอร์ชัน 2026-11-06 (สัปดาห์ 7) · คำสั่งทั้งหมดรันจากโฟลเดอร์ `source/` ของโปรเจกต์บนเซิร์ฟเวอร์
> **สถานะการทดสอบ:** `pg_dump` + `restore-test.sh` + `reset-password` ทดสอบจริงแล้วบนเครื่อง dev · ส่วนที่ใช้ **restic** (`backup.sh` ขั้น 2–3) และ **docker compose บนเซิร์ฟเวอร์จริง** ยังไม่เคยรันจริง (ไม่มี restic ในเครื่องพัฒนา) — ให้รัน backup ครั้งแรกด้วยมือและตรวจผลตามหัวข้อ 2.3 ก่อนเชื่อถือ

## 1. บริการและข้อมูลสำคัญ

| อะไร | อยู่ที่ไหน | หมายเหตุ |
|---|---|---|
| ฐานข้อมูล PostgreSQL 17 | docker volume `pgdata` (service `db`) | สร้างด้วย ICU `th-TH` — **จำเป็น** ต่อการค้นภาษาไทย |
| ไฟล์แนบ | docker volume `files` → `/data/files/{workspace_id}/{uuid}` | ไม่มีชื่อจริงใน path ชื่อจริงอยู่ในตาราง `attachments` |
| งานลบถาวรรายคืน | service `purge` | ลบรายการในถังขยะที่เกิน 30 วัน + ไฟล์จริง วันละครั้งนับจากเวลาที่ container เริ่ม |
| ความลับ | `.env` (ไม่อยู่ใน git) | `BETTER_AUTH_SECRET`, รหัส DB, รหัส Admin เริ่มต้น — **สำรองไว้ที่ปลอดภัยแยกจาก backup ข้อมูล** |

ข้อมูลที่ต้องสำรองครบ 3 อย่าง: **ฐานข้อมูล + ไฟล์แนบ + `.env`** (ถ้าเสีย `BETTER_AUTH_SECRET` ผู้ใช้ทุกคนต้องล็อกอินใหม่ แต่ข้อมูลไม่หาย)

## 2. Backup

### 2.1 ตั้งค่าครั้งแรก
1. ติดตั้ง `restic` บนเซิร์ฟเวอร์ (host ไม่ใช่ใน container)
2. เลือกที่เก็บ **คนละ disk/เครื่อง** กับตัวระบบ เช่น NAS (`/mnt/nas/inventory-restic`) หรือ object storage (`s3:https://…`)
3. ตั้งตัวแปร (ใส่ในไฟล์ที่ root อ่านได้คนเดียว เช่น `/etc/inventory-backup.env`, `chmod 600`):
   ```bash
   export RESTIC_REPOSITORY=/mnt/nas/inventory-restic
   export RESTIC_PASSWORD='…รหัสยาว…'   # เก็บสำเนาไว้ที่ปลอดภัย — เสียรหัสนี้ = กู้ backup ไม่ได้
   ```
4. รันครั้งแรกด้วยมือ: `. /etc/inventory-backup.env && sudo -E scripts/backup.sh`

### 2.2 ตั้งให้รันทุกคืน (root crontab)
```cron
15 2 * * * . /etc/inventory-backup.env && cd /opt/inventory/source && scripts/backup.sh >> /var/log/inventory-backup.log 2>&1
```
สคริปต์: `pg_dump -Fc` → restic backup (dump + volume ไฟล์แนบ) → `forget` เก็บ **รายวัน 7 / รายสัปดาห์ 4 / รายเดือน 6** (+ prune) → ลบ dump ในเครื่องที่เก่ากว่า 7 วัน

### 2.3 ตรวจว่า backup ใช้ได้จริง (ครั้งแรก และเมื่อสงสัย)
```bash
restic snapshots --tag inventory          # ต้องมี snapshot ล่าสุดภายใน 24 ชม.
restic check                              # ตรวจความสมบูรณ์ของ repo
tail -n 20 /var/log/inventory-backup.log  # ท้ายไฟล์ต้องขึ้น "เสร็จ: …"
```

## 3. Restore

### 3.1 ทดสอบ restore ทุกเดือน (ไม่แตะข้อมูลจริง)
```bash
restic restore latest --target /tmp/restore --tag inventory      # ดึง dump ล่าสุดออกมา
scripts/restore-test.sh /tmp/restore/<path>/backups/db/inventory-YYYYMMDD-HHMMSS.dump
```
สคริปต์สร้างฐานข้อมูลชั่วคราว (ICU th-TH) → กู้ → แสดงจำนวนแถวของตารางหลัก → ตรวจว่าค้นไทยได้และ `audit_logs` ยังเป็น append-only → **ลบฐานข้อมูลชั่วคราวทิ้งเสมอ** ต้องจบด้วย "ผ่าน: restore ใช้ได้" แล้วจดวันที่ทดสอบไว้

### 3.2 กู้จริง (ฐานข้อมูลเสีย/ข้อมูลหาย)
1. หยุดแอปและงาน: `docker compose stop app purge`
2. กู้ฐานข้อมูล (สร้าง DB ใหม่ด้วย ICU แล้ว restore):
   ```bash
   docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\""
   docker compose exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'th-TH' ENCODING 'UTF8'"
   docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner < inventory-XXXX.dump
   ```
3. กู้ไฟล์แนบ: `restic restore latest --target / --include "$(docker volume inspect source_files -f '{{.Mountpoint}}')"` (ชื่อ volume ตามโฟลเดอร์โปรเจกต์)
4. เปิดแอป: `docker compose up -d app purge` แล้วตรวจ: ล็อกอินได้, เปิดรายการที่มีไฟล์แนบ, ค้นหาคำไทยได้
5. migration จะไม่ถูกรันซ้ำ (ตาราง `_migrations` กู้มาด้วย)

## 4. รีเซ็ตรหัสผ่าน / Admin เข้าไม่ได้

- **ปกติ:** Admin รีเซ็ตให้ผู้ใช้อื่นที่หน้า *ผู้ดูแลระบบ › ผู้ใช้ › รีเซ็ตรหัสผ่าน* (ได้รหัสชั่วคราวครั้งเดียว ผู้ใช้ต้องเปลี่ยนตอนเข้าครั้งแรก)
- **Admin ทุกคนเข้าไม่ได้** (ทางหนีไฟ — D19): รันบนเซิร์ฟเวอร์
  ```bash
  docker compose run --rm migrate npm run user:reset-password -- admin@ทีม.example
  ```
  (หรือ `npm run user:reset-password -- <อีเมล>` ถ้ามี Node + `.env` บนเครื่อง) ได้รหัสชั่วคราวแสดงครั้งเดียว → ตั้ง `must_change_password`, ออกจากระบบทุกอุปกรณ์, ปลดล็อก login และบันทึก audit `user.password_reset` (actor = ระบบ, via = cli)
- บัญชีที่ **ถูกปิด** รีเซ็ตรหัสแล้วก็ยังเข้าไม่ได้ ต้องเปิดบัญชีที่หน้าผู้ใช้ก่อน
- login ผิด 5 ครั้งใน 15 นาที บัญชีถูกล็อก 15 นาที (รีเซ็ตรหัสด้วย CLI จะปลดล็อกให้)

## 5. ถังขยะและพื้นที่ดิสก์

- ลบรายการ = ย้ายเข้าถังขยะ 30 วัน (กู้ได้) แล้วงาน `purge` ลบถาวรพร้อมไฟล์แนบและ audit `item.purged` (reason = retention)
- รันงานด้วยมือ: `docker compose run --rm migrate npm run job:purge` — ผลลัพธ์ `purged N item(s), M attachment(s)`
- ดูงานค้าง/ล้ม: `docker compose logs purge --tail 50`
- ไฟล์แนบที่ผู้ใช้ลบจากรายการ (ไม่ใช่ทั้งรายการ) ก็ถูกลบจริงหลัง 30 วันเช่นกัน

## 6. โอนรายการส่วนตัวของผู้ใช้ที่ลาออก

1. ปิดบัญชีที่หน้าผู้ใช้
2. *ผู้ดูแลระบบ › รายการส่วนตัว* → แถวของเจ้าของที่ปิดบัญชีจะมีปุ่ม **โอน** → เลือกผู้รับ (ไม่มีตัว Admin เองในรายการ)
3. รายการยังเป็นส่วนตัวหลังโอน เฉพาะเจ้าของใหม่เห็นเนื้อหา · ทุกครั้งบันทึก audit `item.owner_transferred`

## 7. Audit log

*ผู้ดูแลระบบ › Audit log*: กรองตาม action / ผู้กระทำ / ช่วงวันที่ (เวลาไทย) และ Export CSV (สูงสุด 50,000 แถว, UTF-8 มี BOM, ค่าที่ขึ้นต้นด้วย `=` `+` `-` `@` ถูกนำหน้าด้วย `'` กัน formula injection) · ตารางเป็น append-only (trigger ในฐานข้อมูล) เก็บอย่างน้อย 1 ปี ห้ามลบด้วยมือ

## 8. ปัญหาที่เจอบ่อย

| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| ค้นภาษาไทยไม่เจอ/ช้า หลังกู้ฐานข้อมูล | DB ใหม่ไม่ได้สร้างด้วย ICU `th-TH` | สร้าง DB ตามขั้นตอน 3.2 ข้อ 2 แล้วกู้ใหม่ |
| อัปโหลดไฟล์แล้ว error 500 | `FILES_DIR` ไม่มีสิทธิ์เขียน/ดิสก์เต็ม | ตรวจ volume `files` และพื้นที่ดิสก์ (`df -h`) |
| backup ล้มด้วย "dump ว่าง" | container `db` ไม่ทำงาน/ตัวแปร `.env` ผิด | `docker compose ps`, ตรวจ `POSTGRES_USER`/`POSTGRES_DB` |
| ถังขยะไม่ลดลง | service `purge` หยุดทำงาน | `docker compose ps purge` / `logs purge` |
