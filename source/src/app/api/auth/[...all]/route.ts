// เปิดให้ Better Auth ตอบเฉพาะ get-session และ sign-out
// ส่วน login/สมัคร/เปลี่ยนรหัสผ่านผ่าน /api/v1/auth/* ที่เรา throttle และบันทึก audit เอง
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["GET /api/auth/get-session", "POST /api/auth/sign-out"]);

function handle(req: Request) {
  const key = `${req.method} ${new URL(req.url).pathname}`;
  if (!ALLOWED.has(key)) return new Response("Not Found", { status: 404 });
  return getAuth().handler(req);
}

export { handle as GET, handle as POST };
