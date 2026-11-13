// สะท้อน drizzle/*.sql (0000_init, 0001_auth, 0002_code_tags, 0003_note_kinds) — แก้ที่ไฟล์ SQL ก่อนเสมอ แล้วปรับไฟล์นี้ให้ตรง
import { sql } from "drizzle-orm";
import {
  bigint, bigserial, boolean, customType, index, integer, jsonb, pgEnum, pgTable,
  primaryKey, smallint, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

const citext = customType<{ data: string }>({ dataType: () => "citext" });
const ts = (name: string) => timestamp(name, { withTimezone: true });
const id = () => uuid("id").primaryKey().$defaultFn(() => uuidv7());
const stamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};

export const visibilitySetting = pgEnum("visibility_setting", ["inherit", "private", "workspace_view", "workspace_edit"]);
export const visibilityEffective = pgEnum("visibility_effective", ["private", "workspace_view", "workspace_edit"]);
export const workspaceRole = pgEnum("workspace_role", ["admin", "member"]);

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  defaultVisibility: visibilityEffective("default_visibility").notNull().default("workspace_view"),
  loginMethods: text("login_methods").array().notNull().default(sql`'{password}'`),
  allowedEmailDomains: text("allowed_email_domains").array().notNull().default(sql`'{}'`),
  status: text("status").notNull().default("active"),
  ...stamps,
});

export const users = pgTable("users", {
  id: id(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  email: citext("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: workspaceRole("role").notNull().default("member"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  status: text("status").notNull().default("active"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  locale: text("locale").notNull().default("th"), // th | en (migration 0005)
  theme: text("theme").notNull().default("dark"), // dark | light (migration 0006)
  lastLoginAt: ts("last_login_at"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...stamps,
});

export const invites = pgTable("invites", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  email: citext("email").notNull(),
  role: workspaceRole("role").notNull().default("member"),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  ...stamps,
}, (t) => [uniqueIndex("invites_pending_email").on(t.email).where(sql`${t.usedAt} IS NULL`)]);

export const collections = pgTable("collections", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  parentId: uuid("parent_id"),
  depth: smallint("depth").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  visibility: visibilitySetting("visibility").notNull(),
  effectiveVisibility: visibilityEffective("effective_visibility").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  deletedAt: ts("deleted_at"),
  ...stamps,
});

export const items = pgTable("items", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  collectionId: uuid("collection_id").references(() => collections.id),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body"),
  kinds: text("kinds").array().notNull().default(sql`'{note}'`), // ป้าย note/snippet/script/link (D22, CHECK ใน 0003)
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  visibility: visibilitySetting("visibility").notNull().default("inherit"),
  effectiveVisibility: visibilityEffective("effective_visibility").notNull(),
  version: integer("version").notNull().default(1),
  searchText: text("search_text").notNull().default(""),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: ts("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id),
  ...stamps,
}, (t) => [
  index("items_collection").on(t.collectionId).where(sql`${t.deletedAt} IS NULL`),
  index("items_kinds").using("gin", t.kinds).where(sql`${t.deletedAt} IS NULL`),
]);

export const attachments = pgTable("attachments", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  itemId: uuid("item_id").notNull().references(() => items.id),
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  deletedAt: ts("deleted_at"),
  ...stamps,
});

export const tags = pgTable("tags", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...stamps,
}, (t) => [uniqueIndex("tags_workspace_slug").on(t.workspaceId, t.slug)]); // CHECK tags_slug_format อยู่ใน 0002

export const itemTags = pgTable("item_tags", {
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.itemId, t.tagId] }), index("item_tags_tag").on(t.tagId)]);

export const itemVersions = pgTable("item_versions", {
  id: id(),
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  editedBy: uuid("edited_by").notNull().references(() => users.id),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("item_versions_item_version").on(t.itemId, t.version)]);

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---- Better Auth (ชื่อ export = model name ที่ Better Auth ใช้) ----
export const session = pgTable("session", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...stamps,
});

export const account = pgTable("account", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  ...stamps,
});

export const verification = pgTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  ...stamps,
});

export const loginAttempts = pgTable("login_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: citext("email").notNull(),
  ip: text("ip").notNull(),
  attemptedAt: ts("attempted_at").notNull().defaultNow(),
});
