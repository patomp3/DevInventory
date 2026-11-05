# ทดสอบ flow auth/invite/admin แบบ end-to-end กับเซิร์ฟเวอร์ที่รันอยู่ (ดู README) — ต้องมีฐานข้อมูลที่ seed แล้วและ psql
# ใช้: B=http://localhost:3100 bash scripts/e2e-auth.sh (ปรับ psql ท้ายไฟล์ให้ตรงกับ DB ของคุณ)
B=http://localhost:3100; O="Origin: $B"; J="content-type: application/json"
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1'))"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
rm -f a.jar m.jar
echo "1 unauth page      : $(code $B/admin/users) (want 307)"
echo "2 no-origin login  : $(code -X POST $B/api/v1/auth/login -H "$J" -d '{"email":"x@y.z","password":"x"}') (want 403)"
echo "3 BA sign-in route : $(code -X POST $B/api/auth/sign-in/email -H "$O" -H "$J" -d '{}') (want 404)  sign-up: $(code -X POST $B/api/auth/sign-up/email -H "$O" -H "$J" -d '{}') (want 404)"
for i in 1 2 3 4 5; do r=$(curl -s -X POST $B/api/v1/auth/login -H "$O" -H "$J" -H "x-forwarded-for: 9.9.9.9" -d '{"email":"admin@example.com","password":"wrong-password"}'); echo "4.$i bad login      : $r"; done
echo "5 locked even w/ right pw: $(curl -s -X POST $B/api/v1/auth/login -H "$O" -H "$J" -H 'x-forwarded-for: 9.9.9.9' -d '{"email":"admin@example.com","password":"Initial-Pass-2026"}')"
echo "6 login (other ip) : $(curl -s -c a.jar -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d '{"email":"ADMIN@example.com","password":"Initial-Pass-2026"}')"
echo "7 home -> redirect : $(curl -s -b a.jar -o /dev/null -w '%{http_code} %{redirect_url}' $B/)"
echo "8 weak pw          : $(curl -s -b a.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d '{"currentPassword":"Initial-Pass-2026","newPassword":"password123"}')"
echo "9 change pw        : $(curl -s -b a.jar -c a.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d '{"currentPassword":"Initial-Pass-2026","newPassword":"Admin-New-Pass-77"}')"
echo "10 home ok         : $(code -b a.jar $B/)"
echo "11 admin page      : $(code -b a.jar $B/admin/users)"
INV=$(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d '{"email":"Dev1@Example.com","role":"member"}'); echo "12 invite          : $INV"
LINK=$(echo "$INV" | j link); TOKEN=${LINK##*/}
echo "13 dup invite      : $(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d '{"email":"dev1@example.com"}')"
echo "14 existing user   : $(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d '{"email":"admin@example.com"}')"
echo "15 bad email       : $(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d '{"email":"nope"}')"
echo "16 invite page     : $(code $B/invite/$TOKEN) / bad token page text: $(curl -s $B/invite/zzzzzzzzzzzzzzzzzzzzzzzzzz | grep -o 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ' | head -1)"
echo "17 weak accept     : $(curl -s -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Dev One\",\"password\":\"short\"}")"
echo "18 accept          : $(curl -s -c m.jar -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Dev One\",\"password\":\"Dev-One-Pass-55\"}")"
echo "19 reuse token     : $(curl -s -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Evil\",\"password\":\"Dev-One-Pass-55\"}")"
echo "20 member home     : $(code -b m.jar $B/)  member admin page: $(code -b m.jar $B/admin/users) (want 404)  member admin api: $(code -b m.jar $B/api/v1/admin/users) (want 404)"
UID_=$(curl -s -b a.jar $B/api/v1/admin/users | python3 -c "import sys,json; print([u['id'] for u in json.load(sys.stdin)['users'] if u['email']=='dev1@example.com'][0])")
AID=$(curl -s -b a.jar $B/api/v1/admin/users | python3 -c "import sys,json; print([u['id'] for u in json.load(sys.stdin)['users'] if u['email']=='admin@example.com'][0])")
echo "21 disable self    : $(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$AID -H "$O" -H "$J" -d '{"status":"disabled"}')"
echo "22 POST user       : $(code -b a.jar -X POST $B/api/v1/admin/users -H "$O" -H "$J" -d '{}') (want 405)"
R=$(curl -s -b a.jar -X POST $B/api/v1/admin/users/$UID_/reset-password -H "$O"); echo "23 reset pw        : ${R:0:30}..."
TP=$(echo "$R" | j temporaryPassword)
echo "24 member sess dead: $(curl -s -b m.jar -o /dev/null -w '%{http_code} %{redirect_url}' $B/)"
echo "25 old pw          : $(curl -s -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d '{"email":"dev1@example.com","password":"Dev-One-Pass-55"}')"
echo "26 temp pw login   : $(curl -s -c m2.jar -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"dev1@example.com\",\"password\":\"$TP\"}")"
echo "27 disable member  : $(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$UID_ -H "$O" -H "$J" -d '{"status":"disabled"}')"
echo "28 disabled sess   : $(curl -s -b m2.jar -o /dev/null -w '%{http_code} %{redirect_url}' $B/)  login: $(curl -s -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"dev1@example.com\",\"password\":\"$TP\"}")"
echo "29 re-enable       : $(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$UID_ -H "$O" -H "$J" -d '{"status":"active"}')"
echo "30 audit actions   :"; psql -h /tmp -p 5433 -U pgrun inv2 -t -c "select action, count(*) from audit_logs group by 1 order by 1"
