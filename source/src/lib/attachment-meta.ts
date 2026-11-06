// ส่วน pure ของไฟล์แนบ (ใช้ได้ทั้ง server/client/unit test — ห้าม import db หรือ fs)

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB ต่อไฟล์ (D14)
export const MAX_ATTACHMENTS_PER_ITEM = 50;

/** รูปที่แสดง inline ได้ — ไม่รวม SVG (SVG รัน script ได้) */
export const INLINE_MIMES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const isInlineMime = (m: string) => (INLINE_MIMES as readonly string[]).includes(m);

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** ตรวจ MIME จากเนื้อไฟล์จริง (magic bytes) ไม่เชื่อ Content-Type/นามสกุลจากผู้ใช้ (design §9) — ไม่รู้จัก = octet-stream */
export function sniffMime(head: Uint8Array): string {
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06])) return "application/zip";
  if (startsWith(head, [0x1f, 0x8b])) return "application/gzip";
  return "application/octet-stream";
}

/** ชื่อไฟล์ที่เก็บ/แสดง: ตัด path, อักขระควบคุม, อักขระต้องห้ามของ Windows, จำกัด 200 ตัว */
export function cleanFilename(raw: string): string {
  const base = raw.normalize("NFC").split(/[\\/]/).pop() ?? "";
  const s = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").replace(/^\.+/, "").trim().slice(0, 200);
  return s || "file";
}

/** ค่า header Content-Disposition ที่รองรับชื่อไทย (RFC 5987) */
export function contentDisposition(kind: "inline" | "attachment", filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
