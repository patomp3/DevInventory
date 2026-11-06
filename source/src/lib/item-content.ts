// ส่วนที่เป็น pure function ของเนื้อหารายการ (ใช้ได้ทั้ง server, client และ unit test — ห้าม import db)
// D22: รายการทุกชิ้นเป็น Note ชนิดเดียว เนื้อหาทั้งหมดเป็น Markdown และติด "ป้าย" (kinds) ได้หลายป้าย
import { AppError } from "@/lib/errors";

export const KINDS = ["note", "snippet", "script", "link"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABEL: Record<Kind, string> = { note: "Note", snippet: "Snippet", script: "Script", link: "Link" };
export const KIND_HINT: Record<Kind, string> = {
  note: "เอกสาร / บันทึก",
  snippet: "มีโค้ดสั้น ๆ ให้คัดลอก",
  script: "สคริปต์พร้อมวิธีรัน",
  link: "ลิงก์อ้างอิง",
};
export const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v);

// ---------- ข้อจำกัด ----------
export const LIMITS = {
  bodyChars: 500_000,
  tags: 20,
  tagChars: 40,
} as const;

// ---------- Tag ----------

/** slug ของ tag: NFC, ตัวพิมพ์เล็ก, ช่องว่าง → "-", เหลือเฉพาะตัวอักษร/ตัวเลข/สระวรรณยุกต์ไทย และ - _ . + # (ตรงกับ CHECK tags_slug_format) */
export function normalizeTag(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(/[​﻿]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\p{M}\-_.+#]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.tagChars)
    .replace(/-+$/, "");
}

/** รับ tag ที่ผู้ใช้พิมพ์ → [{name, slug}] ไม่ซ้ำ (ตาม slug) ตัดค่าว่าง จำกัดจำนวน */
export function normalizeTags(raw: readonly string[]): { name: string; slug: string }[] {
  const out = new Map<string, { name: string; slug: string }>();
  for (const r of raw) {
    const slug = normalizeTag(r);
    if (!slug || out.has(slug)) continue;
    const name = r.normalize("NFC").replace(/[​﻿]/g, "").trim().replace(/\s+/g, " ").slice(0, LIMITS.tagChars);
    out.set(slug, { name: name || slug, slug });
  }
  if (out.size > LIMITS.tags) throw new AppError(422, "too_many_tags");
  return [...out.values()];
}

/** ป้ายของรายการ: ไม่ซ้ำ เรียงตาม KINDS และต้องมีอย่างน้อย 1 ป้าย */
export function normalizeKinds(raw: readonly string[] | undefined): Kind[] {
  const set = new Set(raw ?? []);
  if ([...set].some((k) => !isKind(k))) throw new AppError(422, "invalid_kind");
  const kinds = KINDS.filter((k) => set.has(k));
  if (!kinds.length) throw new AppError(422, "kind_required");
  return kinds;
}

export type ItemContent = {
  title: string;
  summary?: string | null;
  body?: string | null;
  kinds?: string[];
  tags?: string[];
};

/** ตรวจและจัดรูปเนื้อหา คืนค่าที่พร้อมบันทึก */
export function prepareContent(c: ItemContent) {
  const title = c.title.trim();
  if (!title) throw new AppError(422, "title_required");
  const body = c.body || null;
  if (body && body.length > LIMITS.bodyChars) throw new AppError(422, "body_too_large");
  return {
    title,
    summary: c.summary?.trim() || null,
    body,
    kinds: normalizeKinds(c.kinds ?? ["note"]),
    tags: normalizeTags(c.tags ?? []),
  };
}
export type PreparedContent = ReturnType<typeof prepareContent>;
