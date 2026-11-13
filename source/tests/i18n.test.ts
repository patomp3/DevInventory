import { describe, expect, it } from "vitest";
import { isLocale, toLocale } from "@/lib/i18n/locales";
import { MESSAGES, translate } from "@/lib/i18n/messages";

describe("i18n", () => {
  it("th และ en มี key ชุดเดียวกัน และไม่มีข้อความว่าง", () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.th).sort());
    for (const l of ["th", "en"] as const) for (const [k, v] of Object.entries(MESSAGES[l])) expect(v.trim(), `${l}:${k}`).not.toBe("");
  });
  it("พารามิเตอร์ {name} ใน en ตรงกับ th ทุก key", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(MESSAGES.th) as (keyof typeof MESSAGES.th)[]) expect(ph(MESSAGES.en[k]), k).toBe(ph(MESSAGES.th[k]));
  });
  it("ข้อความภาษาอังกฤษไม่มีตัวอักษรไทยปน", () => {
    const thai = /[฀-๿]/;
    for (const [k, v] of Object.entries(MESSAGES.en)) expect(thai.test(v), `en:${k} = ${v}`).toBe(false);
  });
  it("ข้อความไทยทุก key มีตัวอักษรไทยหรือเป็นคำอังกฤษที่ตั้งใจคงไว้", () => {
    const keepEnglish = new Set(["common.copy", "common.collectionLabel", "common.inbox", "nav.inbox", "nav.collections", "nav.admin.audit", "diff.tags"]);
    for (const [k, v] of Object.entries(MESSAGES.th)) if (!/[฀-๿]/.test(v) && !keepEnglish.has(k)) expect.soft(v, `th:${k} ไม่มีภาษาไทย`).toMatch(/[฀-๿]/);
  });
  it("แทนที่พารามิเตอร์", () => {
    expect(translate("en", "login.remaining", { n: 3 })).toContain("3");
    expect(translate("th", "picker.none", { q: "abc" })).toContain("abc");
  });
  it("toLocale/isLocale: ค่าที่ไม่รู้จัก = ไทย", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(toLocale("fr")).toBe("th");
    expect(toLocale(undefined)).toBe("th");
    expect(toLocale("en")).toBe("en");
  });
});
