import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Shiki โหลด grammar แบบ dynamic import — ให้ Node โหลดเองแทนการ bundle ทุกภาษา
  serverExternalPackages: ["shiki"],
  // CSP แบบ strict ตาม design.md §14 (เริ่มต้นแบบพื้นฐาน ปรับเพิ่มเมื่อมี UI จริง)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
