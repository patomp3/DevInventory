/** error ที่ service โยนขึ้นมา → route แปลงเป็น HTTP status */
export class AppError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}
export const notFound = () => new AppError(404, "not_found"); // ไม่มีสิทธิ์ดู = 404 (design.md §12)
