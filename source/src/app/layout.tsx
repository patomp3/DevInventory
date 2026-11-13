import type { Metadata } from "next";
// ฟอนต์ self-host (ไม่ต้องพึ่งอินเทอร์เน็ตตอน build/รัน) — ui-design §3.2
import "@fontsource/ibm-plex-sans-thai/thai-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-500.css";
import "@fontsource/ibm-plex-sans-thai/thai-600.css";
import "@fontsource/ibm-plex-sans-thai/latin-400.css";
import "@fontsource/ibm-plex-sans-thai/latin-500.css";
import "@fontsource/ibm-plex-sans-thai/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getLocale } from "@/lib/i18n/server";
import { getTheme } from "@/lib/theme-server";

export const metadata: Metadata = { title: "Dev Inventory" };

// ทั้งแอปเป็น dynamic: ไม่ prerender ตอน build (ตอน build ใน Docker ไม่มี .env/ฐานข้อมูล) และทุกหน้าต้องได้ nonce ของ CSP ต่อ request (src/middleware.ts)
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const theme = await getTheme();
  return (
    <html lang={locale} data-theme={theme}>
      <body><LocaleProvider locale={locale}><ThemeProvider theme={theme}>{children}</ThemeProvider></LocaleProvider></body>
    </html>
  );
}
