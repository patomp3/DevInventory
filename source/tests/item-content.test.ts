import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { LIMITS, normalizeKinds, normalizeTag, normalizeTags, prepareContent } from "@/lib/item-content";
import { buildSearchText } from "@/lib/search/normalize";

const errCode = (fn: () => unknown) => { try { fn(); } catch (e) { return e instanceof AppError ? e.code : String(e); } return "no-error"; };

describe("normalizeTag", () => {
  it("lowercase + ช่องว่างเป็น -", () => expect(normalizeTag("  Docker Compose ")).toBe("docker-compose"));
  it("คงสระ/วรรณยุกต์ไทย", () => expect(normalizeTag("ติดตั้ง ระบบ")).toBe("ติดตั้ง-ระบบ"));
  it("ตัดอักขระพิเศษ แต่คง . + # _", () => expect(normalizeTag("C#/.NET+ <b>x</b>")).toBe("c#.net+-bxb"));
  it("ว่างเมื่อมีแต่สัญลักษณ์", () => expect(normalizeTag("!!! ///")).toBe(""));
  it("ไม่เกิน 40 ตัว และไม่ลงท้ายด้วย -", () => {
    const s = normalizeTag(`${"a".repeat(39)} b`);
    expect(s.length).toBeLessThanOrEqual(LIMITS.tagChars);
    expect(s.endsWith("-")).toBe(false);
  });
  it("ตัด zero-width space", () => expect(normalizeTag("do​cker")).toBe("docker"));
});

describe("normalizeTags", () => {
  it("ไม่ซ้ำตาม slug และคงชื่อแรกที่พิมพ์", () =>
    expect(normalizeTags(["Docker", "docker", " DOCKER ", "k8s", ""])).toEqual([{ name: "Docker", slug: "docker" }, { name: "k8s", slug: "k8s" }]));
  it(`เกิน ${LIMITS.tags} tag → 422`, () =>
    expect(errCode(() => normalizeTags(Array.from({ length: LIMITS.tags + 1 }, (_, i) => `t${i}`)))).toBe("too_many_tags"));
});

describe("normalizeKinds (ป้าย D22)", () => {
  it("ไม่ซ้ำ และเรียงตามลำดับมาตรฐาน", () => expect(normalizeKinds(["link", "snippet", "link"])).toEqual(["snippet", "link"]));
  it("ต้องมีอย่างน้อย 1 ป้าย", () => expect(errCode(() => normalizeKinds([]))).toBe("kind_required"));
  it("ป้ายที่ไม่รู้จัก → 422", () => expect(errCode(() => normalizeKinds(["note", "file"]))).toBe("invalid_kind"));
});

describe("prepareContent", () => {
  it("ไม่ส่ง kinds = note", () => expect(prepareContent({ title: "x" }).kinds).toEqual(["note"]));
  it("ตัดช่องว่าง ชื่อเรื่องว่างไม่ได้", () => {
    expect(prepareContent({ title: " t ", summary: "  " })).toMatchObject({ title: "t", summary: null, body: null });
    expect(errCode(() => prepareContent({ title: "   " }))).toBe("title_required");
  });
  it("เนื้อหายาวเกิน → 422", () =>
    expect(errCode(() => prepareContent({ title: "x", body: "a".repeat(LIMITS.bodyChars + 1) }))).toBe("body_too_large"));
  it("หลายป้าย + tag", () => {
    const p = prepareContent({ title: "x", body: "```bash\nls\n```", kinds: ["script", "snippet"], tags: ["Bash"] });
    expect(p.kinds).toEqual(["snippet", "script"]);
    expect(p.tags).toEqual([{ name: "Bash", slug: "bash" }]);
  });
});

describe("buildSearchText กับโค้ดใน Markdown", () => {
  it("ค้นเจอชื่อไฟล์ โค้ด identifier และ tag", () => {
    const s = buildSearchText({ title: "สคริปต์", body: "**deploy.sh**\n\n```bash\ngetUserById()\n```", tagNames: ["Docker", "docker"] });
    expect(s).toContain("deploy.sh");
    expect(s).toContain("get user by id");
    expect(s).toContain("docker");
    expect(s).not.toContain("```");
  });
});
