import { describe, expect, it } from "vitest";
import { highlightTerms, isEmptyQuery, mergeQuery } from "@/lib/search/query";

describe("mergeQuery (คำค้น + ตัวกรองจาก UI)", () => {
  it("kind: และ type: เป็นตัวกรองป้ายเดียวกัน", () => {
    expect(mergeQuery({ q: "kind:script docker" }).types).toEqual(["script"]);
    expect(mergeQuery({ q: "type:snippet" }).types).toEqual(["snippet"]);
  });
  it("ตัวกรองจาก UI ถูกรวมเข้าไวยากรณ์เดียวกัน", () => {
    const p = mergeQuery({ q: "docker", kind: "script", tag: "Docker Compose", lang: "bash" });
    expect(p).toMatchObject({ terms: ["docker"], types: ["script"], tags: ["docker-compose"], langs: ["bash"] });
  });
  it("kind ที่ไม่รู้จักจาก UI ถูกเมินแต่ไม่พัง", () => expect(mergeQuery({ q: "x", kind: "file" }).types).toEqual([]));
  it("วลี, คำที่ตัดออก, in:, owner:, is:", () => {
    const p = mergeQuery({ q: '"docker compose" -test in:"Project X" owner:me is:private' });
    expect(p).toMatchObject({ phrases: ["docker compose"], excluded: ["test"], collections: ["project x"], ownerMe: true, isPrivate: true, terms: [] });
  });
  it("จำกัดความยาวและจำนวนคำ (กัน query ใหญ่เกิน)", () => {
    const p = mergeQuery({ q: Array.from({ length: 50 }, (_, i) => `w${i}`).join(" ") });
    expect(p.terms.length).toBeLessThanOrEqual(12);
    expect(mergeQuery({ q: "a".repeat(5000) }).terms[0]!.length).toBeLessThanOrEqual(200);
  });
});

describe("isEmptyQuery / highlightTerms", () => {
  it("ว่างเมื่อไม่มีทั้งคำและตัวกรอง", () => {
    expect(isEmptyQuery(mergeQuery({ q: "   " }))).toBe(true);
    expect(isEmptyQuery(mergeQuery({ q: "-test" }))).toBe(false); // มีแต่คำที่ตัดออก = ยังค้นได้ (ทุกอย่างที่ไม่มีคำนี้)
    expect(isEmptyQuery(mergeQuery({ q: "", tag: "docker" }))).toBe(false);
    expect(isEmptyQuery(mergeQuery({ q: "owner:me" }))).toBe(false);
  });
  it("ไฮไลต์เฉพาะคำปกติและวลี ไม่รวมคำที่ตัดออก", () => {
    expect(highlightTerms(mergeQuery({ q: 'docker "up -d" -test' }))).toEqual(["up -d", "docker"]);
  });
});
