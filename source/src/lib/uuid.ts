// id ที่ผู้ใช้ส่งมาต้องเป็น UUID ก่อนถึงฐานข้อมูล — ไม่งั้น Postgres โยน "invalid input syntax for type uuid" แล้วกลายเป็น 500
// (design §12: ไม่พบ/ไม่มีสิทธิ์ = 404) ใช้ที่ตัวครอบ route และจุดโหลดทรัพยากรใน service
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
