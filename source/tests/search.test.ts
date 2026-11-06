import { describe, expect, it } from "vitest";
import { buildSearchText, expandIdentifiers, likePattern, normalize, parseQuery } from "@/lib/search/normalize";

describe("normalize", () => {
  it("ตัด zero-width space และรวม whitespace", () => {
    expect(normalize("วิธี​ติดตั้ง  \n ระบบ")).toBe("วิธีติดตั้ง ระบบ");
  });
  it("lowercase และ NFC", () => {
    expect(normalize("Docker-Compose")).toBe("docker-compose");
    expect(normalize("é")).toBe("é");
  });
});

describe("expandIdentifiers", () => {
  it("camelCase", () => expect(expandIdentifiers("getUserById")).toContain("get user by id"));
  it("snake_case", () => expect(expandIdentifiers("snake_case_name")).toContain("snake case name"));
  it("acronym", () => expect(expandIdentifiers("parseHTTPResponse")).toContain("parse http response"));
  it("คำเดี่ยวไม่เพิ่ม", () => expect(expandIdentifiers("docker")).toBe(""));
});

describe("buildSearchText", () => {
  const text = buildSearchText({
    title: "วิธีติดตั้งระบบ",
    body: "# หัวข้อ\nดู [คู่มือ](http://x)\n\n**docker-compose.yml**\n\n```js\nfunction getUserById() {}\n```",
    tagNames: ["Docker"],
  });
  it("ค้นไทยแบบไม่มีช่องว่างได้", () => expect(text).toContain("ติดตั้ง"));
  it("ค้นชื่อไฟล์และ identifier", () => {
    expect(text).toContain("docker-compose.yml");
    expect(text).toContain("get user by id");
  });
  it("ตัด syntax markdown", () => {
    expect(text).not.toContain("](");
    expect(text).toContain("คู่มือ");
  });
  it("จำกัดขนาดเนื้อหา 200 KB", () => {
    const big = buildSearchText({ title: "t", body: "a".repeat(500_000) });
    expect(big.length).toBeLessThan(210_000);
  });
});

describe("parseQuery (§8.3)", () => {
  it("AND terms", () => expect(parseQuery("docker deploy").terms).toEqual(["docker", "deploy"]));
  it("phrase", () => expect(parseQuery('"docker compose up"').phrases).toEqual(["docker compose up"]));
  it("exclude", () => expect(parseQuery("docker -test").excluded).toEqual(["test"]));
  it("filters", () => {
    const q = parseQuery('tag:docker tag:ci type:script lang:bash in:"Project X" owner:me is:private');
    expect(q.tags).toEqual(["docker", "ci"]);
    expect(q.types).toEqual(["script"]);
    expect(q.langs).toEqual(["bash"]);
    expect(q.collections).toEqual(["project x"]);
    expect(q.ownerMe).toBe(true);
    expect(q.isPrivate).toBe(true);
    expect(q.terms).toEqual([]);
  });
  it("ไทย", () => expect(parseQuery("ติดตั้ง").terms).toEqual(["ติดตั้ง"]));
});

describe("likePattern", () => {
  it("escape % _ \\", () => expect(likePattern("a_b%c")).toBe("%a\\_b\\%c%"));
});
