// ประวัติเวอร์ชัน (design.md §10.1): แปลง snapshot → เนื้อหาปัจจุบัน และสร้าง diff แบบ side-by-side — pure (ไม่ import db)
import { diffLines } from "diff";
import { isKind, type Kind } from "@/lib/item-content";

export type SnapshotView = { title: string; summary: string | null; body: string | null; kinds: Kind[]; tags: string[] };

type Rec = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** fence ต้องยาวกว่า backtick ติดกันยาวที่สุดในเนื้อหา (เหมือน migration 0003) */
export function fenceFor(content: string): string {
  const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((m) => m.length));
  return "`".repeat(Math.max(3, longest + 1));
}

const cell = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

/**
 * snapshot ก่อน D22 (url / scriptMeta / codeBlocks แยกฟิลด์) → Markdown ใน body + ป้าย
 * ใช้รูปแบบเดียวกับที่ migration 0003 ทำกับรายการปัจจุบัน
 */
function legacyToView(s: Rec): SnapshotView {
  const url = str(s.url);
  const blocks = Array.isArray(s.codeBlocks) ? (s.codeBlocks as Rec[]) : [];
  const meta = s.scriptMeta && typeof s.scriptMeta === "object" ? (s.scriptMeta as Rec) : null;
  const parts: string[] = [];
  const kinds: Kind[] = [];

  if (url) { parts.push(`<${url}>`); kinds.push("link"); }
  if (meta) {
    kinds.push("script");
    const run = str(meta.run_example);
    const os = Array.isArray(meta.os) ? (meta.os as string[]) : [];
    const params = Array.isArray(meta.params) ? (meta.params as Rec[]) : [];
    const lines = ["## วิธีรัน"];
    if (run) { const f = fenceFor(run); lines.push("", `${f}sh\n${run}\n${f}`); }
    lines.push("", `Shell: \`${str(meta.shell) ?? "bash"}\`${os.length ? ` · OS: ${os.join(", ")}` : ""}`);
    if (params.length) {
      lines.push("", "| Parameter | คำอธิบาย | จำเป็น | ค่าเริ่มต้น |", "|---|---|---|---|");
      for (const p of params) lines.push(`| \`${cell(p.name)}\` | ${cell(p.desc)} | ${p.required ? "ใช่" : "—"} | ${cell(p.default)} |`);
    }
    parts.push(lines.join("\n"));
  }
  if (blocks.length) {
    if (!meta) kinds.push("snippet");
    parts.push(blocks.map((b) => {
      const content = String(b.content ?? "").replace(/[\r\n]+$/, "");
      const f = fenceFor(content);
      const lang = b.language && b.language !== "text" ? String(b.language) : "";
      return `${b.filename ? `**${b.filename}**\n\n` : ""}${f}${lang}\n${content}\n${f}`;
    }).join("\n\n"));
  }
  const body = str(s.body);
  if (body) parts.push(parts.length && blocks.length ? `## วิธีใช้\n\n${body}` : body);

  return {
    title: String(s.title ?? ""), summary: str(s.summary), body: parts.length ? parts.join("\n\n") : null,
    kinds: kinds.length ? kinds : ["note"], tags: Array.isArray(s.tags) ? (s.tags as unknown[]).map(String) : [],
  };
}

/** snapshot รูปแบบใดก็ได้ (ใหม่หลัง D22 หรือเก่า) → SnapshotView เดียวกัน */
export function snapshotToView(raw: unknown): SnapshotView {
  const s = (raw && typeof raw === "object" ? raw : {}) as Rec;
  if (Array.isArray(s.kinds)) {
    const kinds = (s.kinds as unknown[]).filter((k): k is Kind => typeof k === "string" && isKind(k));
    return {
      title: String(s.title ?? ""), summary: str(s.summary), body: str(s.body), kinds: kinds.length ? kinds : ["note"],
      tags: Array.isArray(s.tags) ? (s.tags as unknown[]).map(String) : [],
    };
  }
  return legacyToView(s);
}

// ---------- diff แบบ side-by-side ----------

export type DiffCell = { text: string; kind: "same" | "removed" | "added" } | null;
export type DiffRow = { left: DiffCell; right: DiffCell };

const splitLines = (v: string) => (v === "" ? [] : v.replace(/\n$/, "").split("\n"));

/** เทียบข้อความทีละบรรทัด: บรรทัดที่เปลี่ยนวางคู่กัน (ซ้าย = เดิม, ขวา = ใหม่) ส่วนที่ไม่มีคู่ปล่อยช่องว่าง */
export function sideBySide(before: string | null, after: string | null): DiffRow[] {
  const rows: DiffRow[] = [];
  let removed: string[] = [];
  const flush = (added: string[]) => {
    const n = Math.max(removed.length, added.length);
    for (let i = 0; i < n; i++) {
      rows.push({
        left: i < removed.length ? { text: removed[i]!, kind: "removed" } : null,
        right: i < added.length ? { text: added[i]!, kind: "added" } : null,
      });
    }
    removed = [];
  };
  for (const part of diffLines(before ?? "", after ?? "")) {
    const lines = splitLines(part.value);
    if (part.removed) removed.push(...lines);
    else if (part.added) flush(lines);
    else {
      flush([]);
      for (const l of lines) rows.push({ left: { text: l, kind: "same" }, right: { text: l, kind: "same" } });
    }
  }
  flush([]);
  return rows;
}

export type FieldChange = { field: "title" | "summary" | "kinds" | "tags"; before: string; after: string };

/** ฟิลด์สั้นที่เปลี่ยน (ชื่อ, คำอธิบาย, ป้าย, tag) — body เทียบด้วย sideBySide */
export function changedFields(prev: SnapshotView | null, cur: SnapshotView): FieldChange[] {
  const out: FieldChange[] = [];
  const p = prev ?? { title: "", summary: null, body: null, kinds: [], tags: [] };
  const add = (field: FieldChange["field"], a: string, b: string) => { if (a !== b) out.push({ field, before: a, after: b }); };
  add("title", p.title, cur.title);
  add("summary", p.summary ?? "", cur.summary ?? "");
  add("kinds", p.kinds.join(", "), cur.kinds.join(", "));
  add("tags", [...p.tags].sort().join(", "), [...cur.tags].sort().join(", "));
  return out;
}
