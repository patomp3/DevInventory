import { describe, expect, it } from "vitest";
import { checkPassword } from "@/lib/auth/password-policy";

describe("checkPassword (design.md §14)", () => {
  it("สั้นเกินไป", () => expect(checkPassword("Abc1234").lengthOk).toBe(false));
  it("ครบ 10 ตัวอักษร", () => expect(checkPassword("Abcdefg123").ok).toBe(true));
  it("รหัสยอดนิยม (ไม่สนตัวพิมพ์)", () => {
    expect(checkPassword("Password123").notCommon).toBe(false);
    expect(checkPassword("QWERTYUIOP").ok).toBe(false);
  });
  it("ตัวอักษรซ้ำล้วน", () => expect(checkPassword("zzzzzzzzzzzz").ok).toBe(false));
  it("นับตัวอักษรไทยเป็นตัวอักษร", () => expect(checkPassword("รหัสผ่านทดสอบ").lengthOk).toBe(true));
});
