# ทดสอบ flow auth / คำเชิญ / Admin แบบ end-to-end กับเซิร์ฟเวอร์ที่รันอยู่ — จบด้วย passed=… failed=…
# ต้องมี: เซิร์ฟเวอร์ (B), psql (PSQL), Admin ที่ยังไม่ถูกล็อก และอีเมลคำเชิญที่ไม่เคยใช้ (INVITE_EMAIL)
# ตัวแปร (ค่าเริ่มต้นเหมาะกับ DB ที่ seed ใหม่): B, ADMIN_EMAIL, ADMIN_PW, INVITE_EMAIL, PSQL, PY — ดูตัวอย่างใน CLAUDE.md (หัวข้อ ทดสอบ)
# ควรรันกับ workspace ใหม่ที่มี Admin คนเดียว (สคริปต์เปลี่ยนรหัส Admin เป็น Admin-New-Pass-77 และสร้างผู้ใช้ INVITE_EMAIL)
B=${B:-http://localhost:3100}; O="Origin: $B"; J="content-type: application/json"
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}; ADMIN_PW=${ADMIN_PW:-Initial-Pass-2026}
INVITE_EMAIL=${INVITE_EMAIL:-dev1@example.com}
PSQL=${PSQL:-psql -h /tmp -p 5433 -U pgrun inv2}
PY=${PY:-python3}
pass=0; failn=0
chk() { if [ "$2" == "$3" ]; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAIL $1: want [$2] got [$3]"; fi; }
j() { $PY -c "import sys,json; d=json.load(sys.stdin.buffer); print(d.get('$1'))" 2>/dev/null; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
IP="9.$((RANDOM % 250)).$((RANDOM % 250)).$((RANDOM % 250))"     # IP สมมติของผู้โจมตี (throttle นับต่ออีเมล+IP)
rm -f a.jar m.jar m2.jar

# --- ด่านหน้า: ไม่ล็อกอิน / CSRF / เส้นทางของ Better Auth ที่ต้องปิด
chk unauth-admin-page-redirect 307 "$(code $B/admin/users)"
chk unauth-api-401 401 "$(code $B/api/v1/admin/users)"
chk login-no-origin-403 403 "$(code -X POST $B/api/v1/auth/login -H "$J" -d '{"email":"x@y.z","password":"x"}')"
chk login-foreign-origin-403 403 "$(code -X POST $B/api/v1/auth/login -H "Origin: https://evil.example" -H "$J" -d '{"email":"x@y.z","password":"x"}')"
chk better-auth-sign-in-closed 404 "$(code -X POST $B/api/auth/sign-in/email -H "$O" -H "$J" -d '{}')"
chk better-auth-sign-up-closed 404 "$(code -X POST $B/api/auth/sign-up/email -H "$O" -H "$J" -d '{}')"
chk better-auth-reset-closed 404 "$(code -X POST $B/api/auth/request-password-reset -H "$O" -H "$J" -d '{}')"

# --- header ความปลอดภัย (design §14): CSP แบบ nonce, clickjacking, ไม่เปิดเผยเทคโนโลยี
H1=$(curl -s -D - -o /dev/null $B/login | tr -d '\r'); H2=$(curl -s -D - -o /dev/null $B/login | tr -d '\r')
CSP1=$(echo "$H1" | grep -i '^content-security-policy' | head -1); CSP2=$(echo "$H2" | grep -i '^content-security-policy' | head -1)
chk csp-present 1 "$(echo "$CSP1" | grep -c .)"
chk csp-script-src-nonce 1 "$(echo "$CSP1" | grep -c "script-src 'self' 'nonce-")"
chk csp-script-no-unsafe-inline 0 "$(echo "$CSP1" | sed 's/;/\n/g' | grep -i 'script-src' | grep -c "unsafe-inline")"
chk csp-frame-ancestors-none 1 "$(echo "$CSP1" | grep -c "frame-ancestors 'none'")"
chk csp-object-src-none 1 "$(echo "$CSP1" | grep -c "object-src 'none'")"
chk csp-nonce-differs-per-request 1 "$([ "$CSP1" != "$CSP2" ] && echo 1 || echo 0)"
NONCE=$(echo "$CSP1" | sed -n "s/.*'nonce-\([^']*\)'.*/\1/p" | head -1)
chk csp-inline-scripts-all-nonced 0 "$(curl -s $B/login | grep -o '<script\b[^>]*>' | grep -vc 'nonce=')"
chk xfo-deny 1 "$(echo "$H1" | grep -ci '^x-frame-options: deny')"
chk nosniff 1 "$(echo "$H1" | grep -ci '^x-content-type-options: nosniff')"
chk permissions-policy 1 "$(echo "$H1" | grep -ci '^permissions-policy:')"
chk no-x-powered-by 0 "$(echo "$H1" | grep -ci '^x-powered-by')"
chk api-not-wrapped-by-csp-middleware 0 "$(curl -s -D - -o /dev/null $B/api/health | grep -ci '^content-security-policy')"

# --- throttle: 5 ครั้งผิด → ล็อก 15 นาทีแม้รหัสถูก (ต่ออีเมล+IP) และข้อความ error เดียวกันทุกกรณี
for i in 1 2 3 4 5; do
  r=$(curl -s -X POST $B/api/v1/auth/login -H "$O" -H "$J" -H "x-forwarded-for: $IP" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"wrong-password\"}")
  chk "bad-login-$i-error" invalid_credentials "$(echo "$r" | j error)"
  chk "bad-login-$i-remaining" $((5 - i)) "$(echo "$r" | j remaining)"
done
chk locked-with-right-pw 429 "$(code -X POST $B/api/v1/auth/login -H "$O" -H "$J" -H "x-forwarded-for: $IP" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}")"
chk unknown-email-same-error invalid_credentials "$(curl -s -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d '{"email":"nobody-here@example.test","password":"whatever-123"}' | j error)"
chk other-ip-not-locked 200 "$(curl -s -c a.jar -o /dev/null -w '%{http_code}' -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"$(echo "$ADMIN_EMAIL" | tr 'a-z' 'A-Z')\",\"password\":\"$ADMIN_PW\"}")"   # อีเมลตัวพิมพ์ใหญ่ก็ได้

# --- เปลี่ยนรหัสผ่าน: รหัสอ่อน/ซ้ำ/ผิด ถูกปฏิเสธ
chk weak-pw-rejected weak_password "$(curl -s -b a.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d "{\"currentPassword\":\"$ADMIN_PW\",\"newPassword\":\"password123\"}" | j error)"
chk same-pw-rejected same_password "$(curl -s -b a.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d "{\"currentPassword\":\"$ADMIN_PW\",\"newPassword\":\"$ADMIN_PW\"}" | j error)"
chk wrong-current-rejected wrong_current_password "$(curl -s -b a.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d '{"currentPassword":"not-the-password","newPassword":"Admin-New-Pass-77"}' | j error)"
chk change-pw-csrf-403 403 "$(code -b a.jar -X POST $B/api/v1/auth/change-password -H "$J" -d "{\"currentPassword\":\"$ADMIN_PW\",\"newPassword\":\"Admin-New-Pass-77\"}")"
chk change-pw-ok True "$(curl -s -b a.jar -c a.jar -X POST $B/api/v1/auth/change-password -H "$O" -H "$J" -d "{\"currentPassword\":\"$ADMIN_PW\",\"newPassword\":\"Admin-New-Pass-77\"}" | j ok)"
chk home-ok 200 "$(code -b a.jar $B/)"
chk admin-page-ok 200 "$(code -b a.jar $B/admin/users)"
chk old-pw-dead 401 "$(code -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}")"

# --- คำเชิญ: อีเมลซ้ำ/มีบัญชีอยู่แล้ว/รูปแบบผิด, token ใช้ได้ครั้งเดียว, ไม่มีสมัครเอง
INV=$(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d "{\"email\":\"$(echo "$INVITE_EMAIL" | sed 's/^./\U&/')\",\"role\":\"member\"}")
LINK=$(echo "$INV" | j link); TOKEN=${LINK##*/}
chk invite-created-link-has-token 1 "$([ ${#TOKEN} -ge 30 ] && echo 1 || echo 0)"
chk invite-token-hashed-in-db 0 "$($PSQL -t -A -c "select count(*) from invites where token_hash = '$TOKEN'")"          # เก็บเป็น hash ไม่ใช่ token ดิบ
chk invite-dup-rejected invite_pending "$(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d "{\"email\":\"$INVITE_EMAIL\"}" | j error)"
chk invite-existing-user user_exists "$(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\"}" | j error)"
chk invite-bad-email invalid_email "$(curl -s -b a.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d '{"email":"nope"}' | j error)"
chk invite-page-valid 200 "$(code $B/invite/$TOKEN)"
chk invite-page-bad-token-text 1 "$(curl -s $B/invite/zzzzzzzzzzzzzzzzzzzzzzzzzz | grep -c 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ')"
chk accept-weak-pw-rejected weak_password "$(curl -s -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Dev One\",\"password\":\"short\"}" | j error)"
chk accept-ok True "$(curl -s -c m.jar -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Dev One\",\"password\":\"Dev-One-Pass-55\"}" | j ok)"
chk accept-email-from-invite "$(echo "$INVITE_EMAIL" | tr 'A-Z' 'a-z')" "$($PSQL -t -A -c "select email from users where email = lower('$INVITE_EMAIL')")"
chk token-reuse-rejected 1 "$([ "$(code -X POST $B/api/v1/auth/accept-invite -H "$O" -H "$J" -d "{\"token\":\"$TOKEN\",\"displayName\":\"Evil\",\"password\":\"Dev-One-Pass-55\"}")" -ge 400 ] && echo 1 || echo 0)"
chk invite-page-after-use-closed 1 "$(curl -s $B/invite/$TOKEN | grep -c 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุ')"
chk member-home 200 "$(code -b m.jar $B/)"
chk member-admin-page-404 404 "$(code -b m.jar $B/admin/users)"
chk member-admin-api-404 404 "$(code -b m.jar $B/api/v1/admin/users)"
chk member-invite-api-404 404 "$(code -b m.jar -X POST $B/api/v1/admin/invites -H "$O" -H "$J" -d '{"email":"x@example.test"}')"

# --- จัดการผู้ใช้
UID_=$($PSQL -t -A -c "select id from users where email = lower('$INVITE_EMAIL')")
AID=$($PSQL -t -A -c "select id from users where email = lower('$ADMIN_EMAIL')")
chk disable-self-refused cannot_demote_self "$(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$AID -H "$O" -H "$J" -d '{"status":"disabled"}' | j error)"
chk demote-self-refused cannot_demote_self "$(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$AID -H "$O" -H "$J" -d '{"role":"member"}' | j error)"
chk create-user-directly-405 405 "$(code -b a.jar -X POST $B/api/v1/admin/users -H "$O" -H "$J" -d '{}')"
R=$(curl -s -b a.jar -X POST $B/api/v1/admin/users/$UID_/reset-password -H "$O"); TP=$(echo "$R" | j temporaryPassword)
chk reset-pw-returns-temp 1 "$([ ${#TP} -ge 10 ] && echo 1 || echo 0)"
chk member-session-dead-after-reset 307 "$(code -b m.jar $B/)"
chk old-member-pw-dead 401 "$(code -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"$INVITE_EMAIL\",\"password\":\"Dev-One-Pass-55\"}")"
chk temp-pw-login-must-change True "$(curl -s -c m2.jar -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"$INVITE_EMAIL\",\"password\":\"$TP\"}" | j mustChangePassword)"
chk must-change-blocks-api 403 "$(code -b m2.jar $B/api/v1/items)"
chk must-change-redirects-page 307 "$(code -b m2.jar $B/)"
chk disable-member-ok True "$(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$UID_ -H "$O" -H "$J" -d '{"status":"disabled"}' | j ok)"
chk disabled-session-dead 307 "$(code -b m2.jar $B/)"
chk disabled-login-refused 401 "$(code -X POST $B/api/v1/auth/login -H "$O" -H "$J" -d "{\"email\":\"$INVITE_EMAIL\",\"password\":\"$TP\"}")"
chk disabled-sessions-removed-in-db 0 "$($PSQL -t -A -c "select count(*) from session where user_id = '$UID_'")"
chk re-enable-ok True "$(curl -s -b a.jar -X PATCH $B/api/v1/admin/users/$UID_ -H "$O" -H "$J" -d '{"status":"active"}' | j ok)"
chk revoke-invite-unknown-404 404 "$(code -b a.jar -X DELETE $B/api/v1/admin/invites/00000000-0000-7000-8000-000000000000 -H "$O")"

# --- audit: ทุกการกระทำสำคัญถูกบันทึก
for act in auth.login user.password_changed invite.created invite.accepted user.password_reset user.disabled user.enabled; do
  chk "audit-$act" 1 "$($PSQL -t -A -c "select (count(*) > 0)::int from audit_logs where action = '$act' and workspace_id = (select workspace_id from users where id = '$AID')")"
done
chk audit-no-password-in-details 0 "$($PSQL -t -A -c "select count(*) from audit_logs where workspace_id = (select workspace_id from users where id = '$AID') and (coalesce(before::text,'') || coalesce(after::text,'')) ~* '(newPassword|currentPassword|temporaryPassword|Dev-One-Pass|Admin-New-Pass|$ADMIN_PW|$TP)'")"

# --- role ของแอปในฐานข้อมูล (design §14): สิทธิ์ต่ำ, แก้/ลบ audit_logs ไม่ได้ (migration 0004)
priv() { $PSQL -t -A -c "select has_table_privilege('inventory_app','$1','$2')"; }
chk dbrole-exists 1 "$($PSQL -t -A -c "select count(*) from pg_roles where rolname='inventory_app'")"
chk dbrole-not-superuser f "$($PSQL -t -A -c "select rolsuper from pg_roles where rolname='inventory_app'")"
chk dbrole-no-createrole f "$($PSQL -t -A -c "select rolcreaterole from pg_roles where rolname='inventory_app'")"
chk dbrole-audit-select t "$(priv audit_logs SELECT)"
chk dbrole-audit-insert t "$(priv audit_logs INSERT)"
chk dbrole-audit-no-update f "$(priv audit_logs UPDATE)"
chk dbrole-audit-no-delete f "$(priv audit_logs DELETE)"
chk dbrole-audit-no-truncate f "$(priv audit_logs TRUNCATE)"
chk dbrole-items-crud "t t t t" "$(echo "$(priv items SELECT) $(priv items INSERT) $(priv items UPDATE) $(priv items DELETE)")"
chk dbrole-migrations-hidden f "$(priv _migrations SELECT)"
chk dbrole-cannot-create-in-schema f "$($PSQL -t -A -c "select has_schema_privilege('inventory_app','public','CREATE')")"

rm -f a.jar m.jar m2.jar
echo "passed=$pass failed=$failn"
