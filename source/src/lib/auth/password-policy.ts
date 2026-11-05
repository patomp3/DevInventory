// กฎรหัสผ่าน (design.md §14): ≥ 10 ตัวอักษร และไม่ใช่รหัสยอดนิยม — ใช้ร่วมกันทั้ง server และ checklist ใน UI
export const MIN_PASSWORD_LENGTH = 10;

const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd123", "qwerty1234", "qwertyuiop", "1234567890",
  "12345678910", "123456789012", "1q2w3e4r5t", "1qaz2wsx3edc", "abcd123456", "abc1234567", "iloveyou12",
  "welcome123", "welcome1234", "admin12345", "administrator", "letmein1234", "changeme123", "change-me-now-please",
  "p@ssw0rd123", "p@ssword123", "monkey12345", "dragon12345", "football123", "baseball123", "superman123",
  "internet123", "trustno1234", "sunshine123", "princess123", "starwars123", "master12345", "login12345",
  "0123456789", "9876543210", "1111111111", "0000000000", "aaaaaaaaaa", "qazwsxedcrfv", "zaq12wsxcde3",
]);

export type PasswordCheck = { lengthOk: boolean; notCommon: boolean; ok: boolean };

export function checkPassword(pw: string): PasswordCheck {
  const lengthOk = [...pw].length >= MIN_PASSWORD_LENGTH;
  const lower = pw.toLowerCase();
  const allSame = pw.length > 0 && /^(.)\1*$/.test(pw);
  const notCommon = pw.length > 0 && !COMMON.has(lower) && !allSame;
  return { lengthOk, notCommon, ok: lengthOk && notCommon };
}
