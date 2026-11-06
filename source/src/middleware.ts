// CSP แบบ strict (design.md §14): script-src 'self' + nonce ต่อ request — ไม่มี inline script ที่ไม่มี nonce, ไม่มี eval ใน production
// ข้าม /api (JSON/ดาวน์โหลดไฟล์ตั้ง header เองแล้ว) เพื่อไม่ให้ middleware ไปบัฟเฟอร์ body ของการอัปโหลดไฟล์ใหญ่ (50 MB)
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Shiki (style="…") และ CodeMirror (<style>) ใช้ inline style — ไม่ใช่ script จึงยอมรับได้ (บันทึกไว้ใน CLAUDE.md)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // Next อ่าน nonce จาก header ของ request เพื่อใส่ให้ script ของตัวเอง
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
    },
  ],
};
