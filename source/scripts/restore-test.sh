#!/usr/bin/env bash
# ทดสอบ restore (ทำทุกเดือน — design.md §15.2): กู้ dump ลงฐานข้อมูลชั่วคราว ตรวจจำนวนแถว + ค้นภาษาไทยได้ แล้วลบทิ้ง
# ไม่แตะฐานข้อมูลจริง · ใช้: scripts/restore-test.sh backups/db/inventory-YYYYMMDD-HHMMSS.dump
set -euo pipefail
cd "$(dirname "$0")/.."
DUMP=${1:?ระบุไฟล์ dump เช่น backups/db/inventory-20261106-020000.dump}
[ -s "$DUMP" ] || { echo "ไม่พบไฟล์ $DUMP" >&2; exit 1; }
[ -f .env ] && set -a && . ./.env && set +a
: "${POSTGRES_USER:?ไม่พบ POSTGRES_USER}" "${POSTGRES_DB:?ไม่พบ POSTGRES_DB}"
TMPDB="${POSTGRES_DB}_restore_test"

db_exec() { if [ -n "${DB_CONTAINER:-}" ]; then docker exec -i "$DB_CONTAINER" "$@"; else docker compose exec -T db "$@"; fi; }
psql_t() { db_exec psql -U "$POSTGRES_USER" -d "$1" -t -A -c "$2"; }
cleanup() { db_exec psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TMPDB\"" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "สร้างฐานข้อมูลชั่วคราว $TMPDB (ICU th-TH เหมือนของจริง)"
cleanup
db_exec psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$TMPDB\" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'th-TH' ENCODING 'UTF8'" >/dev/null

echo "กู้ $DUMP"
db_exec pg_restore -U "$POSTGRES_USER" -d "$TMPDB" --no-owner < "$DUMP"

echo "--- จำนวนแถว (ต้องมากกว่า 0 สำหรับ workspaces / users)"
fail=0
for t in workspaces users collections items item_versions attachments tags audit_logs; do
  n=$(psql_t "$TMPDB" "select count(*) from $t")
  printf '%-14s %s\n' "$t" "$n"
  { [ "$t" = workspaces ] || [ "$t" = users ]; } && [ "$n" -eq 0 ] && fail=1
done
mig=$(psql_t "$TMPDB" "select count(*) from _migrations" 2>/dev/null || echo 0)
echo "migrations     $mig"
echo "--- ค้นภาษาไทย (LIKE + trigram) ต้องทำงาน"
psql_t "$TMPDB" "select count(*) from items where search_text like '%ติดตั้ง%'" >/dev/null && echo "ค้นไทยได้"
echo "--- audit_logs ต้องยังเป็น append-only หลังกู้"
out=$(db_exec psql -U "$POSTGRES_USER" -d "$TMPDB" -c "update audit_logs set action = action where id = (select min(id) from audit_logs)" 2>&1 || true)  # เก็บผลก่อน grep (grep -q + pipefail ให้ผลผิด)
if grep -q 'append-only' <<<"$out"; then echo "append-only ✓"; else echo "append-only ✗ (trigger หาย!)"; fail=1; fi

[ "$fail" -eq 0 ] && echo "ผ่าน: restore ใช้ได้" || { echo "ไม่ผ่าน — ดูข้อความด้านบน" >&2; exit 1; }
