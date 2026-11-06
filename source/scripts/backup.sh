#!/usr/bin/env bash
# Backup ทุกคืน (design.md §15.2): pg_dump + restic (ไฟล์แนบ + dump) ไปเก็บที่ disk อื่น / NAS / object storage
# เก็บรายวัน 7 ชุด รายสัปดาห์ 4 ชุด รายเดือน 6 ชุด · รันบนเซิร์ฟเวอร์ Linux ด้วย root ผ่าน cron (ดู docs/runbook.md)
#
# ต้องมี: docker + docker compose, restic ติดตั้งบนเครื่อง host, และตัวแปรสภาพแวดล้อม
#   RESTIC_REPOSITORY  ที่เก็บ backup (เช่น /mnt/nas/inventory-restic หรือ s3:https://…)
#   RESTIC_PASSWORD    รหัสผ่านเข้ารหัส repo (เก็บไว้ที่ปลอดภัย — เสียรหัสนี้ = กู้ backup ไม่ได้)
# ตัวเลือก: BACKUP_DUMP_DIR (ค่าเริ่ม ./backups/db) · FILES_VOLUME (ค่าเริ่ม <ชื่อโฟลเดอร์>_files) · DB_CONTAINER (ถ้าไม่ใช้ docker compose exec)
set -euo pipefail
cd "$(dirname "$0")/.."

: "${RESTIC_REPOSITORY:?ตั้ง RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD:?ตั้ง RESTIC_PASSWORD}"
[ -f .env ] && set -a && . ./.env && set +a
: "${POSTGRES_USER:?ไม่พบ POSTGRES_USER ใน .env}" "${POSTGRES_DB:?ไม่พบ POSTGRES_DB ใน .env}"

STAMP=$(date +%Y%m%d-%H%M%S)
DUMP_DIR=${BACKUP_DUMP_DIR:-./backups/db}
VOLUME=${FILES_VOLUME:-$(basename "$PWD")_files}
mkdir -p "$DUMP_DIR"

db_exec() { if [ -n "${DB_CONTAINER:-}" ]; then docker exec -i "$DB_CONTAINER" "$@"; else docker compose exec -T db "$@"; fi; }

echo "[1/4] pg_dump → $DUMP_DIR/inventory-$STAMP.dump"
db_exec pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$DUMP_DIR/inventory-$STAMP.dump.tmp"
[ -s "$DUMP_DIR/inventory-$STAMP.dump.tmp" ] || { echo "dump ว่าง — ยกเลิก" >&2; rm -f "$DUMP_DIR/inventory-$STAMP.dump.tmp"; exit 1; }
mv "$DUMP_DIR/inventory-$STAMP.dump.tmp" "$DUMP_DIR/inventory-$STAMP.dump"

echo "[2/4] restic backup (dump + ไฟล์แนบจาก volume $VOLUME)"
FILES_PATH=$(docker volume inspect "$VOLUME" -f '{{.Mountpoint}}')
restic cat config >/dev/null 2>&1 || restic init
restic backup --tag inventory "$DUMP_DIR" "$FILES_PATH"

echo "[3/4] เก็บตามนโยบาย 7 วัน / 4 สัปดาห์ / 6 เดือน"
restic forget --tag inventory --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune

echo "[4/4] ลบ dump ในเครื่องที่เก่ากว่า 7 วัน (ชุดเก่ากว่านั้นอยู่ใน restic)"
find "$DUMP_DIR" -name 'inventory-*.dump' -mtime +7 -delete

echo "เสร็จ: $STAMP"
