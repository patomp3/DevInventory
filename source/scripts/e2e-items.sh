# ทดสอบ collections/items: สิทธิ์ การสืบทอด 409 ความลึก — ต้องมีเซิร์ฟเวอร์ที่รันอยู่ (B) และ DB ที่ seed แล้ว (PSQL, ADMIN_PW)
B=${B:-http://localhost:3100}; O="Origin: $B"; J="content-type: application/json"
PSQL=${PSQL:-psql -h /tmp -p 5433 -U pgrun inv3}
ADMIN_PW=${ADMIN_PW:-Initial-Pass-2026}
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}; MEMBER_EMAIL=${MEMBER_EMAIL:-m@example.com}
PY=${PY:-python3}   # Windows: PY=python
pass=0; failn=0
j() { $PY -c "import sys,json; d=json.load(sys.stdin.buffer); print(d$1)" 2>/dev/null; }
chk() { # name expected actual
  if [ "$2" == "$3" ]; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAIL $1: want [$2] got [$3]"; fi; }
rm -f A.jar M.jar
# --- admin: login + เปลี่ยนรหัส (ถ้าบังคับ)
R=$(curl -s -c A.jar -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}")
if [ "$(echo "$R" | j "['mustChangePassword']")" == "True" ]; then
  curl -s -b A.jar -c A.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d "{\"currentPassword\":\"$ADMIN_PW\",\"newPassword\":\"Admin-New-Pass-77\"}" >/dev/null
fi
# --- member: เชิญ + รับเชิญ
INV=$(curl -s -b A.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d "{\"email\":\"$MEMBER_EMAIL\"}"); TOKEN=$(echo "$INV" | j "['link']"); TOKEN=${TOKEN##*/}
curl -s -c M.jar -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Mem\",\"password\":\"Member-Pass-2026\"}" >/dev/null
a() { curl -s -b A.jar -H "$O" -H "$J" "$@"; }   # admin
m() { curl -s -b M.jar -H "$O" -H "$J" "$@"; }   # member
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

CA=$(a -X POST $B/api/v1/collections -d '{"name":"A-private","visibility":"private"}' | j "['id']")
CA1=$(a -X POST $B/api/v1/collections -d "{\"name\":\"A1\",\"parentId\":\"$CA\"}" | j "['id']")
CB=$(a -X POST $B/api/v1/collections -d '{"name":"B-view","visibility":"workspace_view"}' | j "['id']")
CC=$(a -X POST $B/api/v1/collections -d '{"name":"C-edit","visibility":"workspace_edit"}' | j "['id']")
chk top-inherit-422 422 "$(code -b A.jar -X POST $B/api/v1/collections -H "$O" -H "$J" -d '{"name":"x","visibility":"inherit"}')"

I1=$(a -X POST $B/api/v1/items -d "{\"title\":\"ลับใน A1\",\"body\":\"สูตรลับ\",\"collectionId\":\"$CA1\"}" | j "['id']")
chk inherit-private private "$(a $B/api/v1/items/$I1 | j "['item']['effectiveVisibility']")"
chk member-404-private 404 "$(code -b M.jar $B/api/v1/items/$I1)"
chk member-tree "['B-view', 'C-edit']" "$(m $B/api/v1/collections/tree | $PY -c "import sys,json; print(sorted(c['name'] for c in json.load(sys.stdin)['tree']))")"
chk member-list-hides 0 "$(m "$B/api/v1/items?collection=$CA1" | j "['items'].__len__()")"
chk admin-sees-A-tree 4 "$(a $B/api/v1/collections/tree | j "['tree'].__len__()")"

# เปลี่ยนสิทธิ์ A → ลูกที่ inherit เปลี่ยนตามทันที
a -X PATCH $B/api/v1/collections/$CA -d '{"visibility":"workspace_edit"}' >/dev/null
chk cascade workspace_edit "$(a $B/api/v1/items/$I1 | j "['item']['effectiveVisibility']")"
chk member-200 200 "$(code -b M.jar $B/api/v1/items/$I1)"
chk tree-count-A 1 "$(m $B/api/v1/collections/tree | $PY -c "import sys,json; print([c['count'] for c in json.load(sys.stdin)['tree'] if c['name']=='A-private'][0])")"
V=$(m $B/api/v1/items/$I1 | j "['item']['version']")
chk member-put-ok 2 "$(m -X PUT $B/api/v1/items/$I1 -d "{\"version\":$V,\"title\":\"แก้โดย member\",\"body\":\"x\"}" | j "['version']")"
chk stale-409 409 "$(code -b M.jar -X PUT $B/api/v1/items/$I1 -H "$O" -H "$J" -d "{\"version\":$V,\"title\":\"ช้าไป\"}")"
chk member-cannot-delete 403 "$(code -b M.jar -X DELETE $B/api/v1/items/$I1 -H "$O")"
chk member-cannot-chvis 403 "$(code -b M.jar -X PATCH $B/api/v1/items/$I1/visibility -H "$O" -H "$J" -d '{"visibility":"private"}')"

# สร้างใน Collection
chk create-in-view-403 403 "$(code -b M.jar -X POST $B/api/v1/items -H "$O" -H "$J" -d "{\"title\":\"t\",\"collectionId\":\"$CB\"}")"
I2=$(m -X POST $B/api/v1/items -d "{\"kinds\":[\"link\"],\"title\":\"docs\",\"body\":\"<https://example.com>\",\"collectionId\":\"$CC\"}" | j "['id']")
chk member-create-edit-col 36 "$(echo -n $I2 | wc -c)"
chk kind-required-422 422 "$(code -b M.jar -X POST $B/api/v1/items -H "$O" -H "$J" -d '{"title":"x","kinds":[]}')"
chk kind-invalid-422 422 "$(code -b M.jar -X POST $B/api/v1/items -H "$O" -H "$J" -d '{"title":"x","kinds":["file"]}')"
chk admin-edit-nonprivate 200 "$(code -b A.jar -X PUT $B/api/v1/items/$I2 -H "$O" -H "$J" -d '{"version":1,"title":"docs2","url":"https://example.com"}')"
chk admin-manage-nonprivate 200 "$(code -b A.jar -X PATCH $B/api/v1/items/$I2/visibility -H "$O" -H "$J" -d '{"visibility":"workspace_view"}')"

# Inbox: inherit → ค่า default ของ workspace
I3=$(m -X POST $B/api/v1/items -d '{"title":"inbox item"}' | j "['id']")
chk inbox-default workspace_view "$(m $B/api/v1/items/$I3 | j "['item']['effectiveVisibility']")"
chk inbox-list-1 1 "$(m "$B/api/v1/items?scope=inbox" | j "['items'].__len__()")"
# private ของ member: admin ไม่เห็น (404) และไม่อยู่ใน list
m -X PATCH $B/api/v1/items/$I3/visibility -d '{"visibility":"private"}' >/dev/null
chk admin-404-private 404 "$(code -b A.jar $B/api/v1/items/$I3)"
chk admin-list-hides 0 "$(a "$B/api/v1/items?scope=inbox" | j "['items'].__len__()")"
chk admin-cannot-chvis-private 404 "$(code -b A.jar -X PATCH $B/api/v1/items/$I3/visibility -H "$O" -H "$J" -d '{"visibility":"workspace_view"}')"
# ย้ายรายการ inherit ไปอยู่ C → effective ตามปลายทาง
I4=$(m -X POST $B/api/v1/items -d "{\"title\":\"mv\",\"collectionId\":\"$CC\"}" | j "['id']")
m -X PATCH $B/api/v1/items/$I4/move -d "{\"collectionId\":null}" >/dev/null
chk move-to-inbox-uses-ws-default workspace_view "$(m $B/api/v1/items/$I4 | j "['item']['effectiveVisibility']")"

# Collection: ความลึก, วนลูป, ลบเมื่อไม่ว่าง
CA2=$(a -X POST $B/api/v1/collections -d "{\"name\":\"A2\",\"parentId\":\"$CA1\"}" | j "['id']")
chk depth4-422 422 "$(code -b A.jar -X POST $B/api/v1/collections -H "$O" -H "$J" -d "{\"name\":\"A3\",\"parentId\":\"$CA2\"}")"
chk cycle-422 422 "$(code -b A.jar -X PATCH $B/api/v1/collections/$CA -H "$O" -H "$J" -d "{\"parentId\":\"$CA2\"}")"
chk move-too-deep-422 422 "$(code -b A.jar -X PATCH $B/api/v1/collections/$CA -H "$O" -H "$J" -d "{\"parentId\":\"$CB\"}")"
chk delete-nonempty-409 409 "$(code -b A.jar -X DELETE $B/api/v1/collections/$CA1 -H "$O")"
chk delete-empty-200 200 "$(code -b A.jar -X DELETE $B/api/v1/collections/$CA2 -H "$O")"
chk member-cannot-patch-col 403 "$(code -b M.jar -X PATCH $B/api/v1/collections/$CC -H "$O" -H "$J" -d '{"name":"hack"}')"
chk unauth-401 401 "$(code $B/api/v1/collections/tree)"
chk csrf-403 403 "$(code -b M.jar -X POST $B/api/v1/items -H "$J" -d '{"title":"x"}')"

# เวอร์ชัน: บันทึกซ้ำภายใน 5 นาทีโดยคนเดิมรวมเป็นเวอร์ชันเดียว
V=$(m $B/api/v1/items/$I4 | j "['item']['version']")
m -X PUT $B/api/v1/items/$I4 -d "{\"version\":$V,\"title\":\"a\"}" >/dev/null; m -X PUT $B/api/v1/items/$I4 -d "{\"version\":$((V+1)),\"title\":\"b\"}" >/dev/null
chk versions-merged "1" "$($PSQL -t -A -c "select count(*) from item_versions where item_id='$I4'")"
chk search-text-thai "t" "$($PSQL -t -A -c "select (search_text like '%สูตรลับ%' or search_text like '%x%') from items where id='$I1'")"

# --- Note + ป้าย (D22) / Tag
# ข้อความไทยส่งเป็น \uXXXX (JSON) / %XX (URL) เพราะ Git Bash บน Windows ทำ argv ที่ไม่ใช่ ASCII เพี้ยน
S1=$(m -X POST $B/api/v1/items -d "{\"kinds\":[\"snippet\",\"note\",\"snippet\"],\"title\":\"compose\",\"collectionId\":\"$CC\",\"tags\":[\"Docker\",\"\u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07 \u0e23\u0e30\u0e1a\u0e1a\"],\"body\":\"**compose.yml**\n\n\`\`\`yaml\nservices: {}\n\`\`\`\n\n\`\`\`bash\ndocker compose up -d\n\`\`\`\"}" | j "['id']")
chk note-created 36 "$(echo -n $S1 | wc -c)"
chk kinds-normalized "['note', 'snippet']" "$(a $B/api/v1/items/$S1 | j "['item']['kinds']")"
chk detail-no-legacy-fields "False" "$(a $B/api/v1/items/$S1 | j "['item'].keys().__contains__('codeBlocks') or 'url' in d['item'] or 'type' in d['item']")"
S2=$(m -X POST $B/api/v1/items -d '{"kinds":["script"],"title":"secret script","visibility":"private","tags":["secret-ops"],"body":"```bash\npg_dump app > out.sql\n```"}' | j "['id']")
chk script-private-admin-404 404 "$(code -b A.jar $B/api/v1/items/$S2)"
$PY -c "import json; print(json.dumps({'title':'x','body':'a'*500001}))" > big.json   # ใหญ่เกิน argv ของ Windows จึงส่งจากไฟล์
chk body-too-large-422 422 "$(code -b M.jar -X POST $B/api/v1/items -H "$O" -H "$J" --data-binary @big.json)"; rm -f big.json
# /tags: ไม่รั่ว tag ของรายการ private (§8.7)
chk tags-owner-sees-private 1 "$(m "$B/api/v1/tags?prefix=secret" | j "['tags'].__len__()")"
chk tags-admin-hidden-private 0 "$(a "$B/api/v1/tags?prefix=secret" | j "['tags'].__len__()")"
chk tags-thai-prefix True "$(a "$B/api/v1/tags?prefix=%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B8%B1%E0%B9%89%E0%B8%87" | j "['tags'][0]['slug'] == '\u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07-\u0e23\u0e30\u0e1a\u0e1a'")"
chk tags-unauth-401 401 "$(code "$B/api/v1/tags")"
chk list-tag-filter 1 "$(a "$B/api/v1/items?tag=docker" | j "['items'].__len__()")"
chk list-tag-private-hidden 0 "$(a "$B/api/v1/items?tag=secret-ops" | j "['items'].__len__()")"
chk list-kind-filter 1 "$(m "$B/api/v1/items?scope=mine&kind=script" | j "['items'].__len__()")"
chk list-kind-multi 1 "$(a "$B/api/v1/items?kind=snippet" | j "['items'].__len__()")"
chk list-kind-private-hidden 0 "$(a "$B/api/v1/items?kind=script" | j "['items'].__len__()")"
chk list-kind-invalid-422 422 "$(code -b M.jar "$B/api/v1/items?kind=file")"
# แก้ไข: แทนที่ป้าย + tag, 409
chk note-put-ok 2 "$(m -X PUT $B/api/v1/items/$S1 -d '{"version":1,"title":"compose2","kinds":["link"],"tags":["k8s"],"body":"**a.yml**\n\n```yaml\na: 1\n```"}' | j "['version']")"
chk note-put-replaced "k8s link" "$(m $B/api/v1/items/$S1 | j "['item']['tags'][0]['slug'] + ' ' + d['item']['kinds'][0]")"
chk note-put-409 409 "$(code -b M.jar -X PUT $B/api/v1/items/$S1 -H "$O" -H "$J" -d '{"version":1,"title":"x"}')"
chk note-put-nokind-422 422 "$(code -b M.jar -X PUT $B/api/v1/items/$S1 -H "$O" -H "$J" -d '{"version":2,"title":"x","kinds":[]}')"
chk note-search-text "t" "$($PSQL -t -A -c "select (search_text like '%a.yml%' and search_text like '%k8s%' and search_text not like '%\`\`\`%') from items where id='$S1'")"
chk snapshot-kinds '["link"]' "$($PSQL -t -A -c "select snapshot->'kinds' from item_versions where item_id='$S1' order by version desc limit 1")"
# --- ไฟล์แนบ (สัปดาห์ 5): สิทธิ์ผ่านรายการแม่, MIME จากเนื้อไฟล์, header ดาวน์โหลด, ลบ, search_text
T=$(mktemp -d); TW=$(cygpath -m "$T" 2>/dev/null || echo "$T")   # curl บน Windows อ่าน path แบบ /tmp/... ของ Git Bash ไม่ได้ → ใช้ path แบบ Windows
$PY - "$TW" <<'PYEOF'
import sys
d = sys.argv[1]
open(d + "/pic.png", "wb").write(b"\x89PNG\r\n\x1a\n0123456789abcdef")   # PNG signature + ข้อมูลเติม
open(d + "/note.txt", "wb").write(b"hello attachment\n")
open(d + "/evil.png", "wb").write(b"<script>alert(1)</script>")         # ปลอมเป็นรูป
open(d + "/empty.bin", "wb").close()
open(d + "/big.bin", "wb").write(b"\0" * 52428801)                      # เกิน 50 MB
PYEOF

PNG_SIZE=$(wc -c < "$T/pic.png" | tr -d ' ')
up() { curl -s -b "$1" -H "$O" -F "file=@$3;filename=$4" "$B/api/v1/items/$2/attachments"; }   # up jar item file filename
upc() { curl -s -o /dev/null -w "%{http_code}" -b "$1" -H "$O" -F "file=@$3;filename=$4" "$B/api/v1/items/$2/attachments"; }
hdr() { curl -s -D - -o /dev/null -b "$1" "$B/api/v1/attachments/$2/download" | tr -d '\r'; }
AP=$(up M.jar $S1 "$TW/pic.png" "../pic.png")
AP_ID=$(echo "$AP" | j "['attachment']['id']")
chk att-upload-name pic.png "$(echo "$AP" | j "['attachment']['name']")"
chk att-upload-mime image/png "$(echo "$AP" | j "['attachment']['mime']")"
H=$(hdr M.jar $AP_ID)
chk att-dl-200 "HTTP/1.1 200 OK" "$(echo "$H" | head -1)"
chk att-dl-inline-image 1 "$(echo "$H" | grep -ci '^content-disposition: inline')"
chk att-dl-nosniff 1 "$(echo "$H" | grep -ci '^x-content-type-options: nosniff')"
chk att-dl-no-store 1 "$(echo "$H" | grep -ci '^cache-control: private, no-store')"
chk att-dl-bytes "$PNG_SIZE" "$(curl -s -b M.jar "$B/api/v1/attachments/$AP_ID/download" | wc -c | tr -d ' ')"
AT_ID=$(up M.jar $S1 "$TW/note.txt" "note.txt" | j "['attachment']['id']")
H2=$(hdr M.jar $AT_ID)
chk att-txt-forced-download 1 "$(echo "$H2" | grep -ci '^content-disposition: attachment')"
AE=$(up M.jar $S1 "$TW/evil.png" "evil.png")
chk att-fake-image-mime application/octet-stream "$(echo "$AE" | j "['attachment']['mime']")"
chk att-fake-image-attachment 1 "$(hdr M.jar $(echo "$AE" | j "['attachment']['id']") | grep -ci '^content-disposition: attachment')"
chk att-empty-422 422 "$(upc M.jar $S1 "$TW/empty.bin" "e.bin")"
chk att-too-large-413 413 "$(upc M.jar $S1 "$TW/big.bin" "big.bin")"
chk att-list-3 3 "$(m $B/api/v1/items/$S1/attachments | j "['attachments'].__len__()")"
chk att-search-text t "$($PSQL -t -A -c "select (search_text like '%pic.png%' and search_text like '%note.txt%') from items where id='$S1'")"
chk att-admin-nonprivate-dl 200 "$(code -b A.jar "$B/api/v1/attachments/$AP_ID/download")"
# สิทธิ์: ไฟล์แนบใช้สิทธิ์ของรายการแม่เสมอ
AS2=$(up M.jar $S2 "$TW/note.txt" "secret.txt" | j "['attachment']['id']")
chk att-private-owner-dl 200 "$(code -b M.jar "$B/api/v1/attachments/$AS2/download")"
chk att-private-admin-404 404 "$(code -b A.jar "$B/api/v1/attachments/$AS2/download")"
chk att-private-admin-list-404 404 "$(code -b A.jar "$B/api/v1/items/$S2/attachments")"
chk att-private-admin-upload-404 404 "$(upc A.jar $S2 "$TW/note.txt" "x.txt")"
chk att-private-admin-delete-404 404 "$(code -b A.jar -X DELETE "$B/api/v1/attachments/$AS2" -H "$O")"
chk att-unauth-401 401 "$(code "$B/api/v1/attachments/$AP_ID/download")"
chk att-bad-id-404 404 "$(code -b M.jar "$B/api/v1/attachments/00000000-0000-7000-8000-000000000000/download")"
chk att-csrf-403 403 "$(curl -s -o /dev/null -w "%{http_code}" -b M.jar -F "file=@$T/note.txt" "$B/api/v1/items/$S1/attachments")"
# ดูได้แต่แก้ไม่ได้ → 403 (อัปโหลด/ลบ) แต่ยังดาวน์โหลดได้
IV=$(a -X POST $B/api/v1/items -d "{\"title\":\"view only\",\"collectionId\":\"$CB\"}" | j "['id']")
AV=$(up A.jar $IV "$TW/note.txt" "ro.txt" | j "['attachment']['id']")
chk att-viewer-upload-403 403 "$(upc M.jar $IV "$TW/note.txt" "x.txt")"
chk att-viewer-delete-403 403 "$(code -b M.jar -X DELETE "$B/api/v1/attachments/$AV" -H "$O")"
chk att-viewer-download-200 200 "$(code -b M.jar "$B/api/v1/attachments/$AV/download")"
# ลบ: soft delete แล้วดาวน์โหลดไม่ได้ และชื่อไฟล์หายจาก search_text
chk att-delete-200 200 "$(code -b M.jar -X DELETE "$B/api/v1/attachments/$AP_ID" -H "$O")"
chk att-deleted-404 404 "$(code -b M.jar "$B/api/v1/attachments/$AP_ID/download")"
chk att-list-after-delete 2 "$(m $B/api/v1/items/$S1/attachments | j "['attachments'].__len__()")"
chk att-search-text-removed t "$($PSQL -t -A -c "select (search_text not like '%pic.png%' and search_text like '%note.txt%') from items where id='$S1'")"
chk att-save-keeps-search-name t "$(m -X PUT $B/api/v1/items/$S1 -d "{\"version\":$(m $B/api/v1/items/$S1 | j "['item']['version']"),\"title\":\"compose3\"}" >/dev/null; $PSQL -t -A -c "select search_text like '%note.txt%' from items where id='$S1'")"
chk att-audit 1 "$($PSQL -t -A -c "select (count(*) > 0)::int from audit_logs where action='attachment.uploaded' and target_id='$S1'")"
rm -rf "$T"
# --- ประวัติเวอร์ชัน + กู้เวอร์ชัน (สัปดาห์ 5)
ver() { m $B/api/v1/items/$S1 | j "['item']['version']"; }
V0=$(ver)
OLD_TITLE=$(m $B/api/v1/items/$S1 | j "['item']['title']")
chk hist-admin-edit-200 200 "$(code -b A.jar -X PUT $B/api/v1/items/$S1 -H "$O" -H "$J" -d "{\"version\":$V0,\"title\":\"by admin\",\"body\":\"ADMIN BODY\"}")"
V1=$((V0+1))
chk hist-list-2 2 "$(m $B/api/v1/items/$S1/versions | j "['versions'].__len__()")"
chk hist-list-newest-first "[$V1, $V0]" "$(m $B/api/v1/items/$S1/versions | $PY -c "import sys,json; print([v['version'] for v in json.load(sys.stdin.buffer)['versions']])")"
chk hist-get-old-title "$OLD_TITLE" "$(m $B/api/v1/items/$S1/versions/$V0 | j "['view']['title']")"
chk hist-get-prev-version "$V0" "$(m $B/api/v1/items/$S1/versions/$V1 | j "['prev']['version']")"
chk hist-get-first-no-prev None "$(m $B/api/v1/items/$S1/versions/$V0 | j "['prev']")"
chk hist-get-missing-404 404 "$(code -b M.jar $B/api/v1/items/$S1/versions/9999)"
chk hist-get-bad-422 422 "$(code -b M.jar $B/api/v1/items/$S1/versions/abc)"
chk hist-restore-current-422 422 "$(code -b M.jar -X POST $B/api/v1/items/$S1/versions/$V1/restore -H "$O" -H "$J" -d "{\"version\":$V1}")"
chk hist-restore-stale-409 409 "$(code -b M.jar -X POST $B/api/v1/items/$S1/versions/$V0/restore -H "$O" -H "$J" -d "{\"version\":$V0}")"
chk hist-restore-ok $((V1+1)) "$(m -X POST $B/api/v1/items/$S1/versions/$V0/restore -d "{\"version\":$V1}" | j "['version']")"
chk hist-restore-content "$OLD_TITLE" "$(m $B/api/v1/items/$S1 | j "['item']['title']")"
# กู้ซ้ำโดยคนเดิมภายใน 5 นาที ต้องเกิดเวอร์ชันใหม่เสมอ (ไม่รวมเป็นเวอร์ชันเดียว)
chk hist-restore-twice $((V1+2)) "$(m -X POST $B/api/v1/items/$S1/versions/$V1/restore -d "{\"version\":$((V1+1))}" | j "['version']")"
chk hist-restore-no-merge 4 "$(m $B/api/v1/items/$S1/versions | j "['versions'].__len__()")"
chk hist-restore-content2 "by admin" "$(m $B/api/v1/items/$S1 | j "['item']['title']")"
chk hist-restore-audit 1 "$($PSQL -t -A -c "select (count(*) >= 2)::int from audit_logs where action='item.version_restored' and target_id='$S1'")"
chk hist-restore-csrf-403 403 "$(code -b M.jar -X POST $B/api/v1/items/$S1/versions/$V0/restore -H "$J" -d "{\"version\":$((V1+2))}")"
chk hist-unauth-401 401 "$(code $B/api/v1/items/$S1/versions)"
# ผู้ดูอย่างเดียว: ดูประวัติได้ กู้ไม่ได้ (403)
chk hist-viewer-list-200 200 "$(code -b M.jar $B/api/v1/items/$IV/versions)"
chk hist-viewer-restore-403 403 "$(code -b M.jar -X POST $B/api/v1/items/$IV/versions/1/restore -H "$O" -H "$J" -d '{"version":1}')"
# ไม่มีสิทธิ์ดู (private ของ member) → 404 ทุกทาง แม้เป็น Admin
chk hist-private-admin-list-404 404 "$(code -b A.jar $B/api/v1/items/$S2/versions)"
chk hist-private-admin-get-404 404 "$(code -b A.jar $B/api/v1/items/$S2/versions/1)"
chk hist-private-admin-restore-404 404 "$(code -b A.jar -X POST $B/api/v1/items/$S2/versions/1/restore -H "$O" -H "$J" -d '{"version":1}')"
chk hist-private-owner-list-200 200 "$(code -b M.jar $B/api/v1/items/$S2/versions)"
# 409 ต้องแนบสถานะล่าสุดพร้อม tag และคนแก้ล่าสุด (ใช้แสดง dialog 3 ทาง)
chk conflict-payload-keys "body,editedAt,editedBy,kinds,summary,tags,title,version" "$(code_body() { curl -s -b M.jar -X PUT $B/api/v1/items/$S1 -H "$O" -H "$J" -d '{"version":1,"title":"x"}'; }; code_body | $PY -c "import sys,json; print(','.join(sorted(json.load(sys.stdin.buffer)['current'].keys())))")"
# --- ค้นหา (สัปดาห์ 6): สิทธิ์ใน SQL, ไทย, identifier, วลี, ตัวกรอง, facet, คำแนะนำ, quick
# ใช้คำเฉพาะ "xyzkb" กันปนกับรายการจากเคสก่อนหน้า; ข้อความไทยเป็น \uXXXX / %XX เหมือนส่วนอื่น
KB=$(a -X POST $B/api/v1/collections -d '{"name":"kbcol","visibility":"workspace_view"}' | j "['id']")
KP=$(a -X POST $B/api/v1/collections -d '{"name":"kbpriv","visibility":"private"}' | j "['id']")
SA=$(a -X POST $B/api/v1/items -d "{\"title\":\"xyzkb \u0e04\u0e39\u0e48\u0e21\u0e37\u0e2d\u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07\u0e23\u0e30\u0e1a\u0e1a\",\"kinds\":[\"snippet\"],\"collectionId\":\"$KB\",\"tags\":[\"Docker\",\"ops\"],\"body\":\"## setup\n\n\`\`\`bash\nsudo docker compose up -d\n\`\`\`\n\n\`\`\`js\nfunction getUserById(id) {}\n\`\`\`\"}" | j "['id']")
SB=$(m -X POST $B/api/v1/items -d '{"title":"xyzkb backup nightly","kinds":["script"],"tags":["ops"],"visibility":"workspace_view","body":"```python\nimport os\nprint(1)\n```"}' | j "['id']")
SP=$(m -X POST $B/api/v1/items -d '{"title":"xyzkb secret plan","kinds":["note"],"tags":["private-tag"],"visibility":"private","body":"secret docker plan xyzkb"}' | j "['id']")
SD=$(m -X POST $B/api/v1/items -d '{"title":"xyzkb to delete","visibility":"workspace_view"}' | j "['id']")
chk srch-fixture-delete-200 200 "$(code -b M.jar -X DELETE "$B/api/v1/items/$SD" -H "$O")"
sa() { curl -s -b "$1" "$B/api/v1/search?$2"; }
sq() { curl -s -b "$1" "$B/api/v1/search/quick?q=$2"; }
chk srch-admin-total 2 "$(sa A.jar 'q=xyzkb' | j "['total']")"
chk srch-owner-total 3 "$(sa M.jar 'q=xyzkb' | j "['total']")"
chk srch-total-equals-hits 2 "$(sa A.jar 'q=xyzkb' | j "['hits'].__len__()")"
chk srch-private-not-in-hits-admin 0 "$(sa A.jar 'q=xyzkb' | grep -c "$SP")"
chk srch-deleted-hidden 0 "$(sa M.jar 'q=xyzkb' | grep -c "$SD")"
chk srch-private-title-not-in-body-admin 0 "$(sa A.jar 'q=secret+plan' | j "['total']")"
chk srch-private-owner-finds 1 "$(sa M.jar 'q=secret+plan' | j "['total']")"
# facet ต้องไม่รั่ว tag / ภาษา / จำนวนของรายการที่มองไม่เห็น
chk srch-facet-tag-admin-no-private-tag 0 "$(sa A.jar 'q=xyzkb' | grep -c 'private-tag')"
chk srch-facet-tag-owner-has-private-tag 1 "$(sa M.jar 'q=xyzkb' | grep -c 'private-tag')"
chk srch-facet-kind-admin "[('note', 0), ('script', 1), ('snippet', 1)]" "$(sa A.jar 'q=xyzkb' | $PY -c "import sys,json; d=json.load(sys.stdin.buffer)['facets']['kinds']; k={x['value']:x['count'] for x in d}; print([(n,k.get(n,0)) for n in ('note','script','snippet')])")"
chk srch-facet-kind-owner-note-1 1 "$(sa M.jar 'q=xyzkb' | $PY -c "import sys,json; d=json.load(sys.stdin.buffer)['facets']['kinds']; print({x['value']:x['count'] for x in d}.get('note',0))")"
chk srch-facet-lang-admin "bash js python" "$(sa A.jar 'q=xyzkb' | $PY -c "import sys,json; print(' '.join(sorted(x['value'] for x in json.load(sys.stdin.buffer)['facets']['langs'])))")"
# ภาษาไทยไม่มีช่องว่าง (ค้นกลางคำ) + ชื่อใน code (identifier) + วลี
chk srch-thai-substring 1 "$(sa A.jar 'q=%E0%B8%95%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B8%B1%E0%B9%89%E0%B8%87+xyzkb' | j "['total']")"
chk srch-identifier-words 1 "$(sa A.jar 'q=user+by+id+xyzkb' | j "['total']")"
chk srch-identifier-excerpt code "$(sa A.jar 'q=user+by+id+xyzkb' | j "['hits'][0]['snippet']['excerpt']['kind']")"
chk srch-phrase 1 "$(sa A.jar 'q=%22up+-d%22+xyzkb' | j "['total']")"
chk srch-and-terms 1 "$(sa A.jar 'q=docker+compose+xyzkb' | j "['total']")"
chk srch-exclude 1 "$(sa A.jar 'q=xyzkb+-print' | j "['total']")"
chk srch-code-line-number 1 "$(sa A.jar 'q=compose+xyzkb' | j "['hits'][0]['snippet']['excerpt']['line']")"
# ตัวกรอง (ไวยากรณ์ + พารามิเตอร์จาก UI)
chk srch-kind-script 1 "$(sa A.jar 'q=xyzkb&kind=script' | j "['total']")"
chk srch-kind-syntax 1 "$(sa A.jar 'q=xyzkb+kind%3Asnippet' | j "['total']")"
chk srch-type-alias 1 "$(sa A.jar 'q=xyzkb+type%3Ascript' | j "['total']")"
chk srch-tag-ops 2 "$(sa A.jar 'q=xyzkb&tag=ops' | j "['total']")"
chk srch-tag-docker 1 "$(sa A.jar 'q=xyzkb&tag=Docker' | j "['total']")"
chk srch-lang-bash 1 "$(sa A.jar 'q=xyzkb&lang=bash' | j "['total']")"
chk srch-lang-python 1 "$(sa A.jar 'q=xyzkb&lang=python' | j "['total']")"
chk srch-lang-none 0 "$(sa A.jar 'q=xyzkb&lang=rust' | j "['total']")"
chk srch-owner-me-admin 1 "$(sa A.jar 'q=xyzkb+owner%3Ame' | j "['total']")"
chk srch-owner-me-member 2 "$(sa M.jar 'q=xyzkb+owner%3Ame' | j "['total']")"
chk srch-is-private-owner 1 "$(sa M.jar 'q=xyzkb+is%3Aprivate' | j "['total']")"
chk srch-is-private-admin 0 "$(sa A.jar 'q=xyzkb+is%3Aprivate' | j "['total']")"
chk srch-in-collection 1 "$(sa A.jar 'q=xyzkb+in%3Akbcol' | j "['total']")"
chk srch-in-collection-breadcrumb kbcol "$(sa M.jar 'q=xyzkb+in%3Akbcol' | j "['hits'][0]['breadcrumb'][0]['name']")"
chk srch-in-private-collection-hidden 0 "$(sa M.jar 'q=in%3Akbpriv' | j "['total']")"
chk srch-only-filter-no-terms 2 "$(sa A.jar 'tag=ops' | j "['total']")"
# ไม่พบผล → "คุณหมายถึง" (เฉพาะ tag/ชื่อที่ผู้ถามเห็น)
chk srch-did-you-mean-tag 1 "$(sa A.jar 'q=dokcer' | $PY -c "import sys,json; d=json.load(sys.stdin.buffer); print(int('tag:docker' in [x['q'] for x in d['didYouMean']]))")"
chk srch-did-you-mean-no-private-leak 0 "$(sa A.jar 'q=privte-tag' | grep -c 'private-tag')"
chk srch-no-term-empty 0 "$(sa A.jar 'q=' | j "['total']")"
chk srch-unauth-401 401 "$(code "$B/api/v1/search?q=xyzkb")"
chk srch-escape-chars-ok 200 "$(code -b A.jar "$B/api/v1/search?q=%25_%5C%27%22")"
chk srch-long-query-ok 200 "$(code -b A.jar "$B/api/v1/search?q=$(head -c 3000 /dev/zero | tr '\0' a)")"
chk srch-page-out-of-range 0 "$(sa A.jar 'q=xyzkb&page=99' | j "['hits'].__len__()")"
# quick (Ctrl+K): ชื่อหรือ tag, สิทธิ์เหมือนกัน, สูงสุด 8
chk quick-admin 2 "$(sq A.jar xyzkb | j "['items'].__len__()")"
chk quick-owner 3 "$(sq M.jar xyzkb | j "['items'].__len__()")"
chk quick-tag-match 2 "$(sq A.jar ops | j "['items'].__len__()")"
chk quick-private-tag-admin 0 "$(sq A.jar private-tag | j "['items'].__len__()")"
chk quick-empty 0 "$(sq A.jar '' | j "['items'].__len__()")"
chk quick-breadcrumb kbcol "$(sq A.jar xyzkb | $PY -c "import sys,json; print([x['breadcrumb'] for x in json.load(sys.stdin.buffer)['items'] if x['breadcrumb']][0])")"
chk quick-unauth-401 401 "$(code "$B/api/v1/search/quick?q=xyzkb")"
# --- ถังขยะ (สัปดาห์ 7): สิทธิ์ 404, กู้คืน, Collection ถูกลบ → Inbox, ลบถาวร + ไฟล์จริง, งานรายคืน 30 วัน
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"                 # โฟลเดอร์ source/
FILES_HOST=${FILES_HOST:-$SRC/data/files}                              # ที่เก็บไฟล์แนบของเซิร์ฟเวอร์ dev (FILES_DIR=./data/files)
TT=$(mktemp -d); TTW=$(cygpath -m "$TT" 2>/dev/null || echo "$TT"); printf 'trash file\n' > "$TT/t.txt"
TA=$(m -X POST $B/api/v1/items -d '{"title":"zzt alpha","visibility":"workspace_view"}' | j "['id']")
TB=$(m -X POST $B/api/v1/items -d '{"title":"zzt private","visibility":"private"}' | j "['id']")
TC=$(a -X POST $B/api/v1/items -d '{"title":"zzt admin item","visibility":"workspace_view"}' | j "['id']")
TD=$(m -X POST $B/api/v1/items -d '{"title":"zzt expired","visibility":"workspace_view"}' | j "['id']")
curl -s -b M.jar -H "$O" -F "file=@$TTW/t.txt;filename=t.txt" "$B/api/v1/items/$TB/attachments" >/dev/null
curl -s -b M.jar -H "$O" -F "file=@$TTW/t.txt;filename=t.txt" "$B/api/v1/items/$TD/attachments" >/dev/null
KEY_B=$($PSQL -t -A -c "select workspace_id || '/' || storage_key from attachments where item_id='$TB' limit 1")
KEY_D=$($PSQL -t -A -c "select workspace_id || '/' || storage_key from attachments where item_id='$TD' limit 1")
chk trash-file-exists-before 1 "$([ -f "$FILES_HOST/$KEY_B" ] && echo 1 || echo 0)"
chk trash-not-deleted-restore-404 404 "$(code -b M.jar -X POST $B/api/v1/items/$TA/restore -H "$O")"
chk trash-delete-ta 200 "$(code -b M.jar -X DELETE $B/api/v1/items/$TA -H "$O")"
chk trash-delete-tb 200 "$(code -b M.jar -X DELETE $B/api/v1/items/$TB -H "$O")"
chk trash-delete-tc 200 "$(code -b A.jar -X DELETE $B/api/v1/items/$TC -H "$O")"
chk trash-delete-td 200 "$(code -b M.jar -X DELETE $B/api/v1/items/$TD -H "$O")"
ids() { curl -s -b "$1" "$B/api/v1/trash" | $PY -c "import sys,json; print(' '.join(sorted(x['title'] for x in json.load(sys.stdin.buffer)['items'])))"; }
chk trash-list-owner "xyzkb to delete zzt alpha zzt expired zzt private" "$(ids M.jar)"
chk trash-list-admin-no-private "xyzkb to delete zzt admin item zzt alpha zzt expired" "$(ids A.jar)"
chk trash-days-left 30 "$(curl -s -b M.jar "$B/api/v1/trash" | j "['items'][0]['daysLeft']")"
chk trash-unauth-401 401 "$(code "$B/api/v1/trash")"
chk trash-detail-404-after-delete 404 "$(code -b M.jar $B/api/v1/items/$TA)"
chk trash-search-hides 0 "$(curl -s -b M.jar "$B/api/v1/search?q=zzt" | j "['total']")"
# สิทธิ์: ไม่ใช่ของตัวเอง/ส่วนตัวของคนอื่น = 404 (ไม่บอกว่ามีอยู่)
chk trash-admin-restore-private-404 404 "$(code -b A.jar -X POST $B/api/v1/items/$TB/restore -H "$O")"
chk trash-admin-purge-private-404 404 "$(code -b A.jar -X DELETE $B/api/v1/trash/$TB -H "$O")"
chk trash-member-restore-others-404 404 "$(code -b M.jar -X POST $B/api/v1/items/$TC/restore -H "$O")"
chk trash-member-purge-others-404 404 "$(code -b M.jar -X DELETE $B/api/v1/trash/$TC -H "$O")"
chk trash-csrf-restore-403 403 "$(code -b M.jar -X POST $B/api/v1/items/$TA/restore)"
chk trash-csrf-purge-403 403 "$(code -b M.jar -X DELETE $B/api/v1/trash/$TA)"
chk trash-purge-not-trashed-404 404 "$(code -b M.jar -X DELETE $B/api/v1/trash/$S1 -H "$O")"
# Admin กู้รายการที่ไม่ใช่ส่วนตัวของคนอื่นได้ และกลับมาค้นเจอ
chk trash-admin-restore-nonprivate 200 "$(code -b A.jar -X POST $B/api/v1/items/$TA/restore -H "$O")"
chk trash-restored-visible 200 "$(code -b M.jar $B/api/v1/items/$TA)"
chk trash-restored-search 1 "$(curl -s -b M.jar "$B/api/v1/search?q=zzt+alpha" | j "['total']")"
chk trash-restored-audit 1 "$($PSQL -t -A -c "select (count(*) > 0)::int from audit_logs where action='item.restored' and target_id='$TA'")"
# ลบถาวร: ไฟล์จริงหาย แถวไฟล์แนบหาย audit ครบ
chk trash-owner-purge-private 200 "$(code -b M.jar -X DELETE $B/api/v1/trash/$TB -H "$O")"
chk trash-purged-gone 0 "$($PSQL -t -A -c "select count(*) from items where id='$TB'")"
chk trash-purged-attachment-rows 0 "$($PSQL -t -A -c "select count(*) from attachments where item_id='$TB'")"
chk trash-purged-file-removed 0 "$([ -f "$FILES_HOST/$KEY_B" ] && echo 1 || echo 0)"
chk trash-purged-audit 1 "$($PSQL -t -A -c "select (count(*) = 1)::int from audit_logs where action='item.purged' and target_id='$TB' and after->>'reason'='manual'")"
chk trash-purged-twice-404 404 "$(code -b M.jar -X DELETE $B/api/v1/trash/$TB -H "$O")"
# Collection เดิมถูกลบไปแล้ว → กู้แล้วกลับ Inbox (inherit → ค่า default ของ workspace)
KT=$(a -X POST $B/api/v1/collections -d '{"name":"zzt-col","visibility":"workspace_edit"}' | j "['id']")
TE=$(a -X POST $B/api/v1/items -d "{\"title\":\"zzt in col\",\"collectionId\":\"$KT\"}" | j "['id']")
code -b A.jar -X DELETE $B/api/v1/items/$TE -H "$O" >/dev/null
chk trash-collection-delete-200 200 "$(code -b A.jar -X DELETE $B/api/v1/collections/$KT -H "$O")"
chk trash-restore-moved-to-inbox True "$(a -X POST $B/api/v1/items/$TE/restore | j "['movedToInbox']")"
chk trash-restore-inbox-collection None "$(a $B/api/v1/items/$TE | j "['item']['collectionId']")"
chk trash-restore-inbox-visibility workspace_view "$(a $B/api/v1/items/$TE | j "['item']['effectiveVisibility']")"
# งานรายคืน: เกิน 30 วันถูกลบ (พร้อมไฟล์) ที่ยังไม่เกินอยู่ครบ
$PSQL -c "update items set deleted_at = now() - interval '31 days' where id='$TD'" >/dev/null
code -b M.jar -X DELETE $B/api/v1/items/$TA -H "$O" >/dev/null     # TA เพิ่งลบ (ไม่เกิน 30 วัน)
(cd "$SRC" && npm run job:purge 2>&1 | grep -E "^purged") > "$TT/purge.out"
chk trash-job-ran 1 "$(grep -c '^purged' "$TT/purge.out")"
chk trash-job-purged-expired 0 "$($PSQL -t -A -c "select count(*) from items where id='$TD'")"
chk trash-job-file-removed 0 "$([ -f "$FILES_HOST/$KEY_D" ] && echo 1 || echo 0)"
chk trash-job-keeps-recent 1 "$($PSQL -t -A -c "select count(*) from items where id='$TA' and deleted_at is not null")"
chk trash-job-audit-retention 1 "$($PSQL -t -A -c "select (count(*) = 1)::int from audit_logs where action='item.purged' and target_id='$TD' and actor_id is null and after->>'reason'='retention'")"
rm -rf "$TT"
TT=$(mktemp -d); TTW=$(cygpath -m "$TT" 2>/dev/null || echo "$TT")
# --- Admin (สัปดาห์ 7): ตั้งค่า, รายการส่วนตัว (metadata), โอนเจ้าของ (D6), Audit log
n() { curl -s -b N.jar -H "$O" -H "$J" "$@"; }
M_ID=$($PSQL -t -A -c "select id from users where email = lower('$MEMBER_EMAIL')")
A_ID=$($PSQL -t -A -c "select id from users where email = lower('$ADMIN_EMAIL')")
NEW_EMAIL="n-$MEMBER_EMAIL"
INVN=$(a -X POST $B/api/v1/admin/invites -d "{\"email\":\"$NEW_EMAIL\"}"); TOKN=$(echo "$INVN" | j "['link']"); TOKN=${TOKN##*/}
curl -s -c N.jar -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKN\",\"displayName\":\"NewOwner\",\"password\":\"Member-Pass-2026\"}" >/dev/null
N_ID=$($PSQL -t -A -c "select id from users where email = lower('$NEW_EMAIL')")
chk adm-new-user-created 36 "$(echo -n $N_ID | wc -c)"
# ตั้งค่า Workspace
chk adm-settings-get "True" "$(a $B/api/v1/admin/settings | j "['settings']['name'].__len__() > 0")"
chk adm-settings-limits "50 7 30" "$(a $B/api/v1/admin/settings | $PY -c "import sys,json; l=json.load(sys.stdin.buffer)['limits']; print(l['maxFileMb'], l['inviteDays'], l['trashDays'])")"
chk adm-settings-member-404 404 "$(code -b M.jar $B/api/v1/admin/settings)"
chk adm-settings-unauth-401 401 "$(code $B/api/v1/admin/settings)"
chk adm-settings-patch-200 200 "$(code -b A.jar -X PATCH $B/api/v1/admin/settings -H "$O" -H "$J" -d '{"name":"E2E Team","defaultVisibility":"workspace_view"}')"
chk adm-settings-name-saved "E2E Team" "$(a $B/api/v1/admin/settings | j "['settings']['name']")"
chk adm-settings-empty-name-422 422 "$(code -b A.jar -X PATCH $B/api/v1/admin/settings -H "$O" -H "$J" -d '{"name":"   ","defaultVisibility":"workspace_view"}')"
chk adm-settings-inherit-422 422 "$(code -b A.jar -X PATCH $B/api/v1/admin/settings -H "$O" -H "$J" -d '{"name":"x","defaultVisibility":"inherit"}')"
chk adm-settings-member-patch-404 404 "$(code -b M.jar -X PATCH $B/api/v1/admin/settings -H "$O" -H "$J" -d '{"name":"hack","defaultVisibility":"private"}')"
chk adm-settings-csrf-403 403 "$(code -b A.jar -X PATCH $B/api/v1/admin/settings -H "$J" -d '{"name":"x","defaultVisibility":"workspace_view"}')"
chk adm-settings-same-no-audit 1 "$(a -X PATCH $B/api/v1/admin/settings -d '{"name":"E2E Team","defaultVisibility":"workspace_view"}' >/dev/null; $PSQL -t -A -c "select count(*) from audit_logs where action='workspace.settings_changed' and actor_id='$A_ID'")"
# รายการส่วนตัว: metadata เท่านั้น ไม่มีเนื้อหา
PI=$(a $B/api/v1/admin/private-items)
chk adm-private-lists-title 1 "$(echo "$PI" | grep -c 'secret script')"
chk adm-private-no-body 0 "$(echo "$PI" | grep -c 'pg_dump')"
chk adm-private-keys "createdAt,id,kinds,owner,sizeBytes,title" "$(echo "$PI" | $PY -c "import sys,json; print(','.join(sorted(json.load(sys.stdin.buffer)['items'][0].keys())))")"
chk adm-private-member-404 404 "$(code -b M.jar $B/api/v1/admin/private-items)"
chk adm-private-unauth-401 401 "$(code $B/api/v1/admin/private-items)"
chk adm-private-excludes-nonprivate 0 "$(echo "$PI" | grep -c 'xyzkb backup nightly')"
chk adm-private-excludes-deleted 0 "$(echo "$PI" | grep -c 'zzt private')"
# โอนเจ้าของ: เงื่อนไข D6
chk adm-xfer-private-owner-active-403 403 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-member-404 404 "$(code -b M.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-unauth-401 401 "$(code -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-csrf-403 403 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-bad-body-422 422 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d '{"newOwnerId":"nope"}')"
chk adm-xfer-unknown-owner-422 422 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d '{"newOwnerId":"00000000-0000-7000-8000-000000000000"}')"
chk adm-xfer-same-owner-422 422 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$M_ID\"}")"
chk adm-xfer-missing-item-404 404 "$(code -b A.jar -X POST $B/api/v1/admin/items/00000000-0000-7000-8000-000000000000/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-deleted-item-404 404 "$(code -b A.jar -X POST $B/api/v1/admin/items/$SD/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-nonprivate-200 200 "$(code -b A.jar -X POST $B/api/v1/admin/items/$SB/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-nonprivate-owner-changed NewOwner "$(n $B/api/v1/items/$SB | j "['item']['ownerName']")"
# ปิดบัญชีเจ้าของ (M) → โอนรายการส่วนตัวได้ แต่ไม่ให้ตัว Admin เอง และไม่ให้ผู้ใช้ที่ถูกปิด
chk adm-disable-owner-200 200 "$(code -b A.jar -X PATCH $B/api/v1/admin/users/$M_ID -H "$O" -H "$J" -d '{"status":"disabled"}')"
chk adm-private-shows-disabled disabled "$(a $B/api/v1/admin/private-items | $PY -c "import sys,json; print([i['owner']['status'] for i in json.load(sys.stdin.buffer)['items'] if i['id']=='$S2'][0])")"
chk adm-xfer-private-to-self-403 403 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$A_ID\"}")"
chk adm-xfer-to-disabled-422 422 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$M_ID\"}")"
chk adm-xfer-private-admin-still-404 404 "$(code -b A.jar $B/api/v1/items/$S2)"
chk adm-xfer-private-ok 200 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$N_ID\"}")"
chk adm-xfer-new-owner-reads 200 "$(code -b N.jar $B/api/v1/items/$S2)"
chk adm-xfer-stays-private private "$(n $B/api/v1/items/$S2 | j "['item']['effectiveVisibility']")"
chk adm-xfer-admin-still-404-after 404 "$(code -b A.jar $B/api/v1/items/$S2)"
chk adm-xfer-audit 2 "$($PSQL -t -A -c "select count(*) from audit_logs where action='item.owner_transferred' and target_id in ('$S2','$SB')")"
chk adm-xfer-audit-before-owner "$M_ID" "$($PSQL -t -A -c "select before->>'ownerId' from audit_logs where action='item.owner_transferred' and target_id='$S2'")"
chk adm-private-after-xfer-owner-new NewOwner "$(a $B/api/v1/admin/private-items | $PY -c "import sys,json; print([i['owner']['name'] for i in json.load(sys.stdin.buffer)['items'] if i['id']=='$S2'][0])")"
chk adm-xfer-private-to-self-after-active-owner-403 403 "$(code -b A.jar -X POST $B/api/v1/admin/items/$S2/transfer -H "$O" -H "$J" -d "{\"newOwnerId\":\"$A_ID\"}")"
# Audit log
AL=$(a "$B/api/v1/admin/audit-logs")
chk adm-audit-has-rows True "$(echo "$AL" | j "['total'] > 20")"
chk adm-audit-matches-db "$($PSQL -t -A -c "select count(*) from audit_logs where workspace_id=(select workspace_id from users where id='$A_ID')")" "$(echo "$AL" | j "['total']")"
chk adm-audit-page-size 50 "$(echo "$AL" | j "['rows'].__len__()")"
chk adm-audit-page2 True "$(a "$B/api/v1/admin/audit-logs?page=1" | j "['rows'].__len__() > 0")"
chk adm-audit-filter-action True "$(a "$B/api/v1/admin/audit-logs?action=item.owner_transferred" | j "['total'] == 2 and all(r['action']=='item.owner_transferred' for r in d['rows'])")"
chk adm-audit-filter-user True "$(a "$B/api/v1/admin/audit-logs?user=$N_ID" | j "['rows'].__len__() > 0 and all(r['actorEmail'].startswith('n-') for r in d['rows'])")"
chk adm-audit-filter-future-empty 0 "$(a "$B/api/v1/admin/audit-logs?from=2999-01-01" | j "['total']")"
chk adm-audit-filter-past-empty 0 "$(a "$B/api/v1/admin/audit-logs?to=2000-01-01" | j "['total']")"
chk adm-audit-filter-range-has True "$(a "$B/api/v1/admin/audit-logs?from=2000-01-01&to=2999-01-01" | j "['total'] > 20")"
chk adm-audit-bad-date-ignored True "$(a "$B/api/v1/admin/audit-logs?from=not-a-date'%3B--" | j "['total'] > 20")"
chk adm-audit-member-404 404 "$(code -b N.jar "$B/api/v1/admin/audit-logs")"
chk adm-audit-unauth-401 401 "$(code "$B/api/v1/admin/audit-logs")"
CSV_H=$(curl -s -D - -o "$TTW/audit.csv" -b A.jar "$B/api/v1/admin/audit-logs?format=csv&action=item.owner_transferred" | tr -d '\r')
chk adm-csv-type 1 "$(echo "$CSV_H" | grep -ci '^content-type: text/csv')"
chk adm-csv-attachment 1 "$(echo "$CSV_H" | grep -ci '^content-disposition: attachment')"
chk adm-csv-no-store 1 "$(echo "$CSV_H" | grep -ci '^cache-control: private, no-store')"
chk adm-csv-bom efbbbf "$(head -c 3 "$TT/audit.csv" | od -An -tx1 | tr -d ' \n')"
chk adm-csv-rows 3 "$(tr -d '\r' < "$TT/audit.csv" | grep -c .)"
chk adm-csv-member-404 404 "$(code -b N.jar "$B/api/v1/admin/audit-logs?format=csv")"
# audit_logs เป็น append-only ใน DB
chk adm-audit-append-only 1 "$($PSQL -c "update audit_logs set action='x' where id=(select min(id) from audit_logs)" 2>&1 | grep -c 'append-only')"
chk adm-audit-no-delete 1 "$($PSQL -c "delete from audit_logs where id=(select min(id) from audit_logs)" 2>&1 | grep -c 'append-only')"
rm -f N.jar; rm -rf "$TT"
# ผลรวม
echo "passed=$pass failed=$failn"
