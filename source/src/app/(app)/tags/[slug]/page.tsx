import { redirect } from "next/navigation";

/** หน้า tag ชั่วคราวของสัปดาห์ 4 ถูกแทนที่ด้วยหน้าค้นหาแล้ว (สัปดาห์ 6) — ลิงก์เดิมยังใช้ได้ */
export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/search?tag=${encodeURIComponent(decodeURIComponent(slug))}`);
}
