import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/uuid";

describe("isUuid (กัน 500 จาก Postgres เมื่อ id ไม่ใช่ UUID)", () => {
  it("รับ UUID รูปแบบมาตรฐาน (รวม v4/v7 และตัวพิมพ์ใหญ่)", () => {
    expect(isUuid("01a1aee0-095f-79bf-aded-e1239dfd78c2")).toBe(true);
    expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
    expect(isUuid("00000000-0000-7000-8000-000000000000")).toBe(true);
  });
  it("ปฏิเสธทุกอย่างที่ไม่ใช่ UUID", () => {
    for (const v of ["zzz", "", "none", "1", "null", "undefined", " 01a1aee0-095f-79bf-aded-e1239dfd78c2", "01a1aee0095f79bfadede1239dfd78c2",
      "01a1aee0-095f-79bf-aded-e1239dfd78c2'; drop table items;--", "01a1aee0-095f-79bf-aded-e1239dfd78c2\n", "../etc/passwd", "g1a1aee0-095f-79bf-aded-e1239dfd78c2"]) {
      expect(isUuid(v), JSON.stringify(v)).toBe(false);
    }
  });
  it("ปฏิเสธค่าที่ไม่ใช่ string", () => {
    for (const v of [undefined, null, 0, {}, [], ["01a1aee0-095f-79bf-aded-e1239dfd78c2"]]) expect(isUuid(v)).toBe(false);
  });
});
