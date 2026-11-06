import { describe, expect, it } from "vitest";
import { bodyExcerpt, buildResultSnippet, highlight } from "@/lib/search/snippet";

const joined = (segs: { t: string }[]) => segs.map((s) => s.t).join("");

describe("highlight", () => {
  it("เน้นทุกที่ที่เจอ ไม่สนตัวพิมพ์เล็กใหญ่", () => {
    expect(highlight("Docker docker", ["docker"])).toEqual([{ t: "Docker", m: true }, { t: " ", m: false }, { t: "docker", m: true }]);
  });
  it("ภาษาไทยไม่มีช่องว่าง", () => {
    expect(highlight("วิธีติดตั้งระบบ", ["ติดตั้ง"])).toEqual([{ t: "วิธี", m: false }, { t: "ติดตั้ง", m: true }, { t: "ระบบ", m: false }]);
  });
  it("อักขระพิเศษของ regex ในคำค้นไม่ทำให้พัง", () => {
    expect(highlight("a.b (c) [d]", [".b", "(c)", "[d]"]).filter((s) => s.m).map((s) => s.t)).toEqual([".b", "(c)", "[d]"]);
  });
  it("คำยาวชนะคำสั้นที่ซ้อนกัน", () => {
    expect(highlight("docker-compose", ["docker", "docker-compose"])).toEqual([{ t: "docker-compose", m: true }]);
  });
  it("ไม่มีคำค้น/ข้อความว่าง", () => {
    expect(highlight("abc", [])).toEqual([{ t: "abc", m: false }]);
    expect(highlight("", ["a"])).toEqual([]);
  });
  it("เนื้อหา HTML ไม่ถูกแปลง (ส่งเป็นข้อความล้วน ให้ UI escape ผ่าน React)", () => {
    expect(highlight("<script>alert(1)</script>", ["alert"]).map((s) => s.t).join("")).toBe("<script>alert(1)</script>");
  });
});

describe("bodyExcerpt", () => {
  const body = ["## วิธีรัน", "", "ข้อความธรรมดา docker ในย่อหน้า", "", "```bash", "# เริ่ม", "docker compose up -d", "```"].join("\n");
  it("เจอในข้อความธรรมดาก่อน (ลำดับบรรทัด)", () => {
    const e = bodyExcerpt(body, ["docker"])!;
    expect(e.kind).toBe("text");
    expect(joined(e.segments)).toBe("ข้อความธรรมดา docker ในย่อหน้า");
  });
  it("เจอใน code fence → เลขบรรทัดภายใน block และภาษา", () => {
    const e = bodyExcerpt(body, ["compose"])!;
    expect(e).toMatchObject({ kind: "code", line: 2, lang: "bash" });
    expect(joined(e.segments)).toBe("docker compose up -d");
  });
  it("เลขบรรทัดนับใหม่ทุก block", () => {
    const b = "```js\nfoo()\n```\n\n```py\nx=1\nbar()\n```";
    expect(bodyExcerpt(b, ["bar"])).toMatchObject({ kind: "code", line: 2, lang: "py" });
  });
  it("fence ที่ยาวกว่าไม่ปิดด้วย fence ที่สั้นกว่า", () => {
    const b = "````md\n```\ninner needle\n```\n````";
    expect(bodyExcerpt(b, ["needle"])).toMatchObject({ kind: "code", lang: "md" });
  });
  it("identifier: ค้น 'user by id' เจอ getUserById ใน code", () => {
    const e = bodyExcerpt("```ts\nfunction getUserById(id) {}\n```", ["user", "by", "id"])!;
    expect(e).toMatchObject({ kind: "code", line: 1 });
    expect(e.segments.filter((s) => s.m).map((s) => s.t)).toEqual(["getUserById"]);
  });
  it("ไม่เจอ = null", () => expect(bodyExcerpt("hello", ["zzz"])).toBeNull());
  it("บรรทัดยาวถูกตัดเหลือรอบคำที่เจอ พร้อม …", () => {
    const e = bodyExcerpt("a".repeat(300) + " needle " + "b".repeat(300), ["needle"])!;
    const text = joined(e.segments);
    expect(text.length).toBeLessThan(200);
    expect(text.startsWith("…") && text.endsWith("…")).toBe(true);
    expect(e.segments.some((s) => s.m && s.t === "needle")).toBe(true);
  });
});

describe("buildResultSnippet", () => {
  it("ชื่อถูกไฮไลต์เสมอ", () => {
    expect(buildResultSnippet({ title: "Docker setup", summary: null, body: null }, ["docker"]).title[0]).toEqual({ t: "Docker", m: true });
  });
  it("ใช้คำอธิบายสั้นก่อนถ้าเจอคำ", () => {
    const r = buildResultSnippet({ title: "t", summary: "ติดตั้ง docker", body: "docker ใน body" }, ["docker"]);
    expect(joined(r.excerpt!.segments)).toBe("ติดตั้ง docker");
  });
  it("ไม่เจอใน summary → ไปเนื้อหา", () => {
    const r = buildResultSnippet({ title: "t", summary: "อธิบาย", body: "มี docker อยู่" }, ["docker"]);
    expect(joined(r.excerpt!.segments)).toBe("มี docker อยู่");
  });
  it("เจอจาก tag เท่านั้น → แสดง summary ไม่เน้น", () => {
    const r = buildResultSnippet({ title: "t", summary: "คำอธิบาย", body: "x" }, ["tagonly"]);
    expect(r.excerpt).toEqual({ kind: "text", segments: [{ t: "คำอธิบาย", m: false }] });
  });
  it("ไม่มีอะไรเลย → excerpt เป็น null", () => expect(buildResultSnippet({ title: "t", summary: null, body: null }, ["x"]).excerpt).toBeNull());
});
