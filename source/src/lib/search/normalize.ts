// การสร้าง search_text และ parser ไวยากรณ์ค้นหา — design.md §8.2–8.3

const MAX_CODE_CHARS = 200 * 1024;

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
  body?: string | null;
  url?: string | null;
  codeBlocks?: { filename?: string | null; content: string }[];
  attachmentNames?: string[];
  tagNames?: string[];
};

export function buildSearchText(s: SearchSource): string {
  let code = (s.codeBlocks ?? []).map((b) => `${b.filename ?? ""} ${b.content}`).join(" ");
  if (code.length > MAX_CODE_CHARS) code = code.slice(0, MAX_CODE_CHARS);
  const parts = [
    s.title,
    s.summary ?? "",
    stripMarkdown(s.body ?? ""),
    s.url ?? "",
    code,
    (s.attachmentNames ?? []).join(" "),
    (s.tagNames ?? []).join(" "),
    expandIdentifiers(`${code} ${s.title}`),
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
  const re = /(-?)(?:(tag|type|lang|in|owner|is):)?(?:"([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const neg = m[1] === "-";
    const key = m[2];
    const value = normalize(m[3] ?? m[4] ?? "");
    if (!value) continue;
    if (key === "tag") q.tags.push(value);
    else if (key === "type") q.types.push(value);
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
