import { describe, expect, it } from "vitest";
import { isTheme, toTheme } from "@/lib/theme";

describe("theme", () => {
  it("รับเฉพาะ light/dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("auto")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
  it("ค่าไม่รู้จัก = dark", () => {
    expect(toTheme("sepia")).toBe("dark");
    expect(toTheme(null)).toBe("dark");
    expect(toTheme("light")).toBe("light");
  });
});
