import { describe, expect, it } from "vitest";
import { actionLabel, auditToCsv, csvCell, isIsoDay, summarizeDetail, type AuditRow } from "@/lib/audit-format";

const row = (o: Partial<AuditRow> = {}): AuditRow => ({
  id: 1, createdAt: new Date("2026-11-06T02:00:00Z"), actorName: "สมชาย", actorEmail: "a@example.com", action: "item.created",
  targetType: "item", targetId: "id-1", before: null, after: { title: "t" }, ip: "::1", ...o,
});

describe("csvCell", () => {
  it("ครอบด้วย \" และ escape \"\"", () => expect(csvCell('a "b", c')).toBe('"a ""b"", c"'));
  it("null/undefined เป็นค่าว่าง", () => { expect(csvCell(null)).toBe('""'); expect(csvCell(undefined)).toBe('""'); });
  it("กัน CSV/formula injection ทุกตัวนำที่อันตราย", () => {
    for (const v of ["=cmd|' /C calc'!A0", "+1+1", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(v).startsWith(`"'`)).toBe(true);
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
  });
  it("ค่าปกติไม่ถูกแก้", () => { expect(csvCell("สวัสดี")).toBe('"สวัสดี"'); expect(csvCell(42)).toBe('"42"'); });
});

describe("auditToCsv", () => {
  it("มี BOM, header ภาษาไทย, ขึ้นบรรทัดด้วย CRLF และ JSON ใน cell ถูก escape", () => {
    const csv = auditToCsv([row({ before: { v: 1 }, after: { title: 'say "hi"' } })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe('"เวลา","ผู้กระทำ","อีเมลผู้กระทำ","action","ชนิดเป้าหมาย","เป้าหมาย","ก่อน","หลัง","IP"');
    expect(lines[1]).toContain('"{""v"":1}"');
    expect(lines[1]).toContain('"{""title"":""say \\""hi\\""""}"');
    expect(lines[2]).toBe("");
  });
  it("ชื่อผู้ใช้ที่เป็นสูตรถูก neutralize", () => {
    expect(auditToCsv([row({ actorName: "=1+1" })])).toContain(`"'=1+1"`);
  });
  it("ไม่มีแถว = มีแต่ header", () => expect(auditToCsv([]).split("\r\n").filter(Boolean)).toHaveLength(1));
});

describe("summarizeDetail / actionLabel / isIsoDay", () => {
  it("สรุปก่อน/หลัง และตัดความยาว", () => {
    expect(summarizeDetail({ before: { a: 1 }, after: { a: 2 } })).toBe('ก่อน: {"a":1} · หลัง: {"a":2}');
    expect(summarizeDetail({ before: null, after: null })).toBe("");
    expect(summarizeDetail({ before: null, after: { x: "y".repeat(500) } }, 50).length).toBe(50);
  });
  it("ชื่อ action ภาษาไทย และตกกลับเป็นค่าเดิม", () => {
    expect(actionLabel("item.purged")).toBe("ลบถาวร");
    expect(actionLabel("future.action")).toBe("future.action");
  });
  it("isIsoDay", () => {
    expect(isIsoDay("2026-11-06")).toBe(true);
    for (const v of ["2026-13-45", "06/11/2026", "", undefined, "2026-11-06'; drop table"]) expect(isIsoDay(v as string | undefined)).toBe(false);
  });
});
