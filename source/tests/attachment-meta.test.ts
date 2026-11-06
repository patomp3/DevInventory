import { describe, expect, it } from "vitest";
import { cleanFilename, contentDisposition, formatBytes, isInlineMime, sniffMime } from "@/lib/attachment-meta";

const bytes = (...n: number[]) => new Uint8Array([...n, ...new Array(16).fill(0)]);

describe("sniffMime (ตรวจจากเนื้อไฟล์จริง)", () => {
  it("รูปและ PDF", () => {
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("application/pdf");
  });
  it("WebP ต้องมี RIFF....WEBP", () => {
    expect(sniffMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(sniffMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBe("application/octet-stream");
  });
  it("SVG/HTML/สคริปต์ที่ปลอมเป็นรูปไม่ผ่าน → octet-stream (ไม่เชื่อนามสกุล)", () => {
    expect(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe("application/octet-stream");
    expect(sniffMime(new TextEncoder().encode("<script>alert(1)</script>"))).toBe("application/octet-stream");
  });
  it("ไฟล์สั้น/ว่างไม่ error", () => expect(sniffMime(new Uint8Array(0))).toBe("application/octet-stream"));
});

describe("isInlineMime", () => {
  it("เฉพาะรูปแรสเตอร์ ไม่รวม SVG/PDF", () => {
    expect(isInlineMime("image/png")).toBe(true);
    expect(isInlineMime("image/svg+xml")).toBe(false);
    expect(isInlineMime("application/pdf")).toBe(false);
    expect(isInlineMime("text/html")).toBe(false);
  });
});

describe("cleanFilename", () => {
  it("ตัด path และ .. นำหน้า", () => {
    expect(cleanFilename("../../etc/passwd")).toBe("passwd");
    expect(cleanFilename("C:\\Users\\x\\รายงาน.pdf")).toBe("รายงาน.pdf");
    expect(cleanFilename("..hidden")).toBe("hidden");
  });
  it("แทนอักขระต้องห้าม/ควบคุม และไม่ปล่อยให้ว่าง", () => {
    expect(cleanFilename('a<b>:"c|d?.txt')).toBe("a_b___c_d_.txt");
    expect(cleanFilename("a\u0000b.txt")).toBe("a_b.txt");
    expect(cleanFilename("   ")).toBe("file");
    expect(cleanFilename("a".repeat(300)).length).toBe(200);
  });
});

describe("contentDisposition", () => {
  it("ชื่อไทยใช้ filename* แบบ UTF-8 และไม่หลุดเครื่องหมายคำพูด", () => {
    const h = contentDisposition("attachment", 'รายงาน "q3".pdf');
    expect(h.startsWith("attachment;")).toBe(true);
    expect(h).toContain("filename*=UTF-8''%E0%B8%A3");
    expect(h).not.toMatch(/filename="[^"]*"[^;]*"/);
  });
});

describe("formatBytes", () => {
  it("หน่วย", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
