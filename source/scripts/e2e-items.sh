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
# ผลรวม
echo "passed=$pass failed=$failn"
