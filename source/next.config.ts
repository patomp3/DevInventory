import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Shiki โหลด grammar แบบ dynamic import — ให้ Node โหลดเองแทนการ bundle ทุกภาษา
  serverExternalPackages: ["shiki"],
  // CSP (nonce ต่อ request) อยู่ใน src/middleware.ts · header พื้นฐานที่ไม่ขึ้นกับ request อยู่ที่นี่ · HSTS ตั้งที่ Caddy (ตัวจบ TLS)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
