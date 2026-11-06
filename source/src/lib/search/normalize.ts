// การสร้าง search_text และ parser ไวยากรณ์ค้นหา — design.md §8.2–8.3

/** เนื้อหา (รวมโค้ดใน Markdown) ที่ใส่ใน search_text ไม่เกิน 200 KB */
const MAX_BODY_CHARS = 200 * 1024;

/** NFC, lowercase, ตัด zero-width space, รวม whitespace */
export function normalize(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[​﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** แตก camelCase / snake_case / kebab-case เป็นคำแยก เช่น getUserById → "get user by id" */
export function expandIdentifiers(input: string): string {
  const tokens = input.match(/[A-Za-z0-9_$.-]*[A-Za-z][A-Za-z0-9_$.-]*/g) ?? [];
  const out = new Set<string>();
  for (const tok of tokens) {
    const parts = tok
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/[_\-.$\s]+/)
      .filter(Boolean);
    if (parts.length > 1) out.add(parts.join(" ").toLowerCase());
  }
  return [...out].join(" ");
}

/** ตัด syntax Markdown แบบเบา ๆ ให้เหลือข้อความ */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\w-]*\n?/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+\s]+/gm, "")
    .replace(/[*_`~]/g, "");
}

export type SearchSource = {
  title: string;
  summary?: string | null;
  /** Markdown ทั้งหมด รวม code fence (D22: โค้ด/ลิงก์/วิธีรันอยู่ใน body) */
  body?: string | null;
  attachmentNames?: string[];
  tagNames?: string[];
};

export function buildSearchText(s: SearchSource): string {
  let body = stripMarkdown(s.body ?? "");
  if (body.length > MAX_BODY_CHARS) body = body.slice(0, MAX_BODY_CHARS);
  const parts = [
    s.title,
    s.summary ?? "",
    body,
    (s.attachmentNames ?? []).join(" "),
    (s.tagNames ?? []).join(" "),
    expandIdentifiers(`${body} ${s.title}`),
  ];
  return normalize(parts.join(" "));
}

// ---------- query parser ----------

export type ParsedQuery = {
  terms: string[];
  phrases: string[];
  excluded: string[];
  tags: string[];
  types: string[];
  langs: string[];
  collections: string[];
  ownerMe: boolean;
  isPrivate: boolean;
};

export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = {
    terms: [], phrases: [], excluded: [], tags: [], types: [], langs: [],
    collections: [], ownerMe: false, isPrivate: false,
  };
  const re = /(-?)(?:(tag|type|kind|lang|in|owner|is):)?(?:"([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const neg = m[1] === "-";
    const key = m[2];
    const value = normalize(m[3] ?? m[4] ?? "");
    if (!value) continue;
    if (key === "tag") q.tags.push(value);
    else if (key === "type" || key === "kind") q.types.push(value); // kind: = ชื่อใหม่ของ type: (D22)
    else if (key === "lang") q.langs.push(value);
    else if (key === "in") q.collections.push(value);
    else if (key === "owner") { if (value === "me") q.ownerMe = true; }
    else if (key === "is") { if (value === "private") q.isPrivate = true; }
    else if (neg) q.excluded.push(value);
    else if (m[3] !== undefined) q.phrases.push(value);
    else q.terms.push(value);
  }
  return q;
}

/** escape อักขระพิเศษของ LIKE เพื่อใช้ '%term%' อย่างปลอดภัย */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}
