import { describe, expect, it } from "vitest";
import { changedFields, fenceFor, sideBySide, snapshotToView } from "@/lib/item-history";

describe("snapshotToView (รองรับ snapshot ทั้งสองรูปแบบ)", () => {
  it("รูปแบบใหม่ (หลัง D22)", () => {
    expect(snapshotToView({ title: "t", summary: "s", body: "b", kinds: ["snippet", "link"], tags: ["a"] }))
      .toEqual({ title: "t", summary: "s", body: "b", kinds: ["snippet", "link"], tags: ["a"] });
  });
  it("ป้ายที่ไม่รู้จักถูกตัด และไม่ว่างเสมอ", () => {
    expect(snapshotToView({ title: "t", kinds: ["file"] }).kinds).toEqual(["note"]);
    expect(snapshotToView({ title: "t", kinds: ["script", "file"] }).kinds).toEqual(["script"]);
  });
  it("รูปแบบเก่า: note ธรรมดา", () => {
    expect(snapshotToView({ title: "n", summary: null, body: "hello", url: null, codeBlocks: [], scriptMeta: null, tags: ["x"] }))
      .toEqual({ title: "n", summary: null, body: "hello", kinds: ["note"], tags: ["x"] });
  });
  it("รูปแบบเก่า: link → <url> + ป้าย link", () => {
    const v = snapshotToView({ title: "l", url: "https://example.com", body: "ดูนี่", codeBlocks: [], tags: [] });
    expect(v.kinds).toEqual(["link"]);
    expect(v.body).toBe("<https://example.com>\n\nดูนี่");
  });
  it("รูปแบบเก่า: snippet หลายไฟล์ → ชื่อไฟล์ + code fence + หัวข้อ วิธีใช้", () => {
    const v = snapshotToView({
      title: "s", body: "อธิบาย", tags: [], codeBlocks: [
        { filename: "a.yml", language: "yaml", content: "a: 1\n" }, { filename: null, language: "text", content: "plain" },
      ],
    });
    expect(v.kinds).toEqual(["snippet"]);
    expect(v.body).toBe("**a.yml**\n\n```yaml\na: 1\n```\n\n```\nplain\n```\n\n## วิธีใช้\n\nอธิบาย");
  });
  it("รูปแบบเก่า: script → วิธีรัน + ตาราง parameter และ escape |", () => {
    const v = snapshotToView({
      title: "sc", tags: [], codeBlocks: [{ filename: "x.sh", language: "bash", content: "echo" }],
      scriptMeta: { shell: "bash", os: ["linux", "macos"], run_example: "./x.sh --db a|b", params: [{ name: "--db", desc: "ชื่อ|ฐาน", required: true, default: "" }] },
    });
    expect(v.kinds).toEqual(["script"]);
    expect(v.body).toContain("## วิธีรัน\n\n```sh\n./x.sh --db a|b\n```");
    expect(v.body).toContain("Shell: `bash` · OS: linux, macos");
    expect(v.body).toContain("| `--db` | ชื่อ\\|ฐาน | ใช่ |  |");
    expect(v.body).toContain("**x.sh**\n\n```bash\necho\n```");
  });
  it("snapshot เสียหาย/ว่างไม่ทำให้พัง", () => {
    expect(snapshotToView(null)).toEqual({ title: "", summary: null, body: null, kinds: ["note"], tags: [] });
    expect(snapshotToView("x").kinds).toEqual(["note"]);
  });
});

describe("fenceFor", () => {
  it("ยาวกว่า backtick ในเนื้อหา", () => {
    expect(fenceFor("ls")).toBe("```");
    expect(fenceFor("a ``` b")).toBe("````");
    expect(fenceFor("`````")).toBe("``````");
  });
});

describe("sideBySide", () => {
  it("เหมือนกัน = ทุกแถว same", () => {
    const r = sideBySide("a\nb", "a\nb");
    expect(r.map((x) => [x.left?.kind, x.right?.kind])).toEqual([["same", "same"], ["same", "same"]]);
  });
  it("บรรทัดที่เปลี่ยนวางคู่กัน", () => {
    const r = sideBySide("a\nb\nc", "a\nB\nc");
    expect(r).toHaveLength(3);
    expect(r[1]).toEqual({ left: { text: "b", kind: "removed" }, right: { text: "B", kind: "added" } });
  });
  it("เพิ่มบรรทัด = ซ้ายว่าง, ลบบรรทัด = ขวาว่าง", () => {
    expect(sideBySide("a", "a\nb")[1]).toEqual({ left: null, right: { text: "b", kind: "added" } });
    expect(sideBySide("a\nb", "a")[1]).toEqual({ left: { text: "b", kind: "removed" }, right: null });
  });
  it("ลบ 2 เพิ่ม 1 → จับคู่แถวแรก แถวสองซ้ายเท่านั้น", () => {
    const r = sideBySide("x\ny", "z");
    expect(r).toEqual([
      { left: { text: "x", kind: "removed" }, right: { text: "z", kind: "added" } },
      { left: { text: "y", kind: "removed" }, right: null },
    ]);
  });
  it("ว่าง/null รองรับ", () => {
    expect(sideBySide(null, null)).toEqual([]);
    expect(sideBySide(null, "a")).toEqual([{ left: null, right: { text: "a", kind: "added" } }]);
  });
  it("บรรทัดที่เนื้อหาเป็นภาษาไทยทำงานปกติ", () => {
    const r = sideBySide("สวัสดี", "สวัสดีครับ");
    expect(r).toEqual([{ left: { text: "สวัสดี", kind: "removed" }, right: { text: "สวัสดีครับ", kind: "added" } }]);
  });
});

describe("changedFields", () => {
  const base = { title: "t", summary: null, body: "b", kinds: ["note" as const], tags: ["a", "b"] };
  it("ไม่เปลี่ยน = ว่าง (ลำดับ tag ไม่นับ)", () => expect(changedFields(base, { ...base, tags: ["b", "a"] })).toEqual([]));
  it("รายงานฟิลด์ที่เปลี่ยน", () => {
    expect(changedFields(base, { ...base, title: "t2", kinds: ["note", "link"] })).toEqual([
      { field: "title", before: "t", after: "t2" }, { field: "kinds", before: "note", after: "note, link" },
    ]);
  });
  it("เวอร์ชันแรก (ไม่มี prev) แสดงค่าที่ตั้งไว้", () => {
    expect(changedFields(null, base).map((c) => c.field)).toEqual(["title", "kinds", "tags"]);
  });
});
