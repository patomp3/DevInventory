// zod schema ของ body ที่ API รายการรับ (POST /items, PUT /items/:id)
import { z } from "zod";
import { KINDS, LIMITS } from "@/lib/item-content";

export const contentFields = {
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(500).nullish(),
  body: z.string().max(LIMITS.bodyChars).nullish(),
  kinds: z.array(z.enum(KINDS)).min(1).max(KINDS.length).optional(), // ไม่ส่ง = ["note"]
  tags: z.array(z.string().max(100)).max(50).optional(), // จำนวนจริงตรวจหลัง normalize (LIMITS.tags)
};

export const createItemBody = z.object({
  ...contentFields,
  collectionId: z.string().uuid().nullish(),
  visibility: z.enum(["inherit", "private", "workspace_view", "workspace_edit"]).optional(),
});

export const updateItemBody = z.object({ version: z.number().int().positive(), ...contentFields });
