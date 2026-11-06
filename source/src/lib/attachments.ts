// ไฟล์แนบใต้ Note (design.md §9, D22) — ไม่มีสิทธิ์ของตัวเอง ใช้สิทธิ์ของรายการแม่เสมอ (§4.4.7)
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { audit } from "@/lib/audit";
import { cleanFilename, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_ITEM, sniffMime } from "@/lib/attachment-meta";
import { db } from "@/lib/db";
import { attachments, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { AppError, notFound } from "@/lib/errors";
import { isUuid } from "@/lib/uuid";
import { loadItem, refreshSearchText } from "@/lib/items";
import { canEdit, type Ctx } from "@/lib/permissions";

export type AttachmentInfo = { id: string; name: string; mime: string; size: number; createdAt: Date; uploadedByName: string };

/** ที่เก็บไฟล์บนดิสก์: {FILES_DIR}/{workspace_id}/{uuid} (ไม่มีชื่อจริงใน path, ไม่ serve เป็น static) */
export function storagePath(workspaceId: string, storageKey: string): string {
  return join(resolve(env().FILES_DIR), workspaceId, storageKey);
}

const info = {
  id: attachments.id, name: attachments.originalName, mime: attachments.mimeType, size: attachments.sizeBytes,
  createdAt: attachments.createdAt, uploadedByName: users.displayName,
};

/** รายการไฟล์แนบของรายการที่ผู้ใช้มองเห็น (ไม่มีสิทธิ์ดูรายการ = 404) */
export async function listAttachments(ctx: Ctx, itemId: string): Promise<AttachmentInfo[]> {
  await loadItem(db(), ctx, itemId);
  return db().select(info).from(attachments).innerJoin(users, eq(users.id, attachments.uploadedBy))
    .where(and(eq(attachments.itemId, itemId), eq(attachments.workspaceId, ctx.workspaceId), isNull(attachments.deletedAt)))
    .orderBy(asc(attachments.createdAt));
}

export async function uploadAttachment(ctx: Ctx, itemId: string, file: File, req: Request | null): Promise<AttachmentInfo> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new AppError(413, "file_too_large");
  if (file.size === 0) throw new AppError(422, "file_empty");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_ATTACHMENT_BYTES) throw new AppError(413, "file_too_large");

  const id = uuidv7();
  const storageKey = uuidv7();
  const path = storagePath(ctx.workspaceId, storageKey);
  const meta = {
    name: cleanFilename(file.name), mime: sniffMime(bytes.subarray(0, 16)),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };

  let written = false;
  try {
    const out = await db().transaction(async (tx) => {
      const item = await loadItem(tx, ctx, itemId);
      if (!canEdit(ctx, item)) throw new AppError(403, "forbidden");
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(attachments)
        .where(and(eq(attachments.itemId, itemId), isNull(attachments.deletedAt)));
      if (n >= MAX_ATTACHMENTS_PER_ITEM) throw new AppError(422, "too_many_attachments");

      await mkdir(join(resolve(env().FILES_DIR), ctx.workspaceId), { recursive: true });
      await writeFile(path, bytes, { flag: "wx" });
      written = true;

      await tx.insert(attachments).values({
        id, workspaceId: ctx.workspaceId, itemId, storageKey, originalName: meta.name, mimeType: meta.mime,
        sizeBytes: bytes.length, sha256: meta.sha256, uploadedBy: ctx.userId,
      });
      await refreshSearchText(tx, itemId);
      await audit(tx, req, {
        workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "attachment.uploaded", targetType: "item", targetId: itemId,
        after: { attachmentId: id, name: meta.name, size: bytes.length, mime: meta.mime },
      });
      return { id, name: meta.name, mime: meta.mime, size: bytes.length, createdAt: new Date(), uploadedByName: "" };
    });
    const [u] = await db().select({ n: users.displayName }).from(users).where(eq(users.id, ctx.userId));
    return { ...out, uploadedByName: u?.n ?? "—" };
  } catch (e) {
    if (written) await rm(path, { force: true }); // transaction ล้ม → ไม่ทิ้งไฟล์กำพร้า
    throw e;
  }
}

/** โหลดไฟล์แนบสำหรับดาวน์โหลด: attachment → รายการแม่ → canView (ไม่ผ่าน/ไม่มี/ถูกลบ = 404 เหมือนกันหมด) */
export async function getAttachmentForDownload(ctx: Ctx, id: string) {
  if (!isUuid(id)) throw notFound();
  const [a] = await db().select().from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.workspaceId, ctx.workspaceId), isNull(attachments.deletedAt)));
  if (!a) throw notFound();
  await loadItem(db(), ctx, a.itemId);
  return { row: a, path: storagePath(a.workspaceId, a.storageKey) };
}

/** ลบแบบ soft delete (ไฟล์จริงลบตอน purge จากถังขยะ สัปดาห์ 7) — ต้อง canEdit รายการแม่ */
export async function deleteAttachment(ctx: Ctx, id: string, req: Request | null) {
  if (!isUuid(id)) throw notFound();
  await db().transaction(async (tx) => {
    const [a] = await tx.select().from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.workspaceId, ctx.workspaceId), isNull(attachments.deletedAt)));
    if (!a) throw notFound();
    const item = await loadItem(tx, ctx, a.itemId);
    if (!canEdit(ctx, item)) throw new AppError(403, "forbidden");
    await tx.update(attachments).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(attachments.id, id));
    await refreshSearchText(tx, a.itemId);
    await audit(tx, req, {
      workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "attachment.deleted", targetType: "item", targetId: a.itemId,
      before: { attachmentId: id, name: a.originalName },
    });
  });
}
