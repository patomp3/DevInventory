// ข้อความตัวอย่างและไฮไลต์ของผลค้นหา (design.md §8.5) — pure ไม่ import db
// ส่งกลับเป็นส่วน {t, m} (m = ถูกเน้น) ให้ UI ครอบ <mark> เอง: ไม่มี HTML ดิบจากเนื้อหาผู้ใช้เลย จึง escape ไม่ได้พลาด
import { expandIdentifiers, normalize } from "@/lib/search/normalize";

export type Seg = { t: string; m: boolean };
export type Excerpt =
  | { kind: "text"; segments: Seg[] }
  | { kind: "code"; segments: Seg[]; line: number; lang: string | null };
export type ResultSnippet = { title: Seg[]; excerpt: Excerpt | null };

const WINDOW = 80; // ± ตัวอักษรรอบคำที่เจอ (§8.5)
const MAX_LINE = 200;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** แบ่งข้อความเป็นส่วนที่ถูกเน้น/ไม่ถูกเน้น (ไม่สนตัวพิมพ์เล็กใหญ่ คำยาวสุดก่อน) */
export function highlight(text: string, terms: readonly string[]): Seg[] {
  const ts = [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!text) return [];
  if (!ts.length) return [{ t: text, m: false }];
  const re = new RegExp(ts.map(escapeRe).join("|"), "giu");
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m[0] === "") continue;
    if (m.index! > last) out.push({ t: text.slice(last, m.index), m: false });
    out.push({ t: m[0], m: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), m: false });
  return out;
}

const hasMark = (segs: Seg[]) => segs.some((s) => s.m);

/** ถ้าคำค้นไม่ตรงตัวอักษร (เช่น "user by id" ↔ getUserById) ให้เน้นทั้ง identifier ที่แตกคำแล้วตรง */
function highlightIdentifiers(line: string, terms: readonly string[]): Seg[] {
  const wanted = terms.map((t) => normalize(t)).filter(Boolean);
  if (!wanted.length) return [{ t: line, m: false }];
  const out: Seg[] = [];
  let last = 0;
  for (const m of line.matchAll(/[A-Za-z0-9_$.-]*[A-Za-z][A-Za-z0-9_$.-]*/g)) {
    const words = expandIdentifiers(m[0]);
    if (!words) continue;
    const phrase = wanted.join(" ");
    if (words.includes(phrase) || wanted.every((w) => words.includes(w))) {
      if (m.index! > last) out.push({ t: line.slice(last, m.index), m: false });
      out.push({ t: m[0], m: true });
      last = m.index! + m[0].length;
    }
  }
  if (last < line.length) out.push({ t: line.slice(last), m: false });
  return out;
}

/** ตัดข้อความยาวให้เหลือ ±WINDOW ตัวอักษรรอบการเน้นแรก */
function windowAround(segs: Seg[]): Seg[] {
  const text = segs.map((s) => s.t).join("");
  if (text.length <= WINDOW * 2 + 20) return segs;
  let pos = 0, first = 0;
  for (const s of segs) { if (s.m) { first = pos; break; } pos += s.t.length; }
  const from = Math.max(0, first - WINDOW), to = Math.min(text.length, first + WINDOW);
  const out: Seg[] = [];
  let at = 0;
  for (const s of segs) {
    const a = Math.max(from, at), b = Math.min(to, at + s.t.length);
    if (b > a) out.push({ t: s.t.slice(a - at, b - at), m: s.m });
    at += s.t.length;
  }
  if (from > 0 && out[0]) out[0] = { ...out[0], t: "…" + out[0].t };
  if (to < text.length && out.length) out[out.length - 1] = { ...out[out.length - 1]!, t: out[out.length - 1]!.t + "…" };
  return out;
}

/** หาบรรทัดแรกของเนื้อหาที่มีคำค้น: ถ้าอยู่ใน code fence คืนเลขบรรทัดภายใน block ถ้าเป็นข้อความธรรมดาคืนช่วง ±80 ตัวอักษร */
export function bodyExcerpt(body: string, terms: readonly string[]): Excerpt | null {
  if (!body || !terms.length) return null;
  const lines = body.split(/\r?\n/);
  let inFence = false, fenceLen = 0, lang: string | null = null, n = 0;
  let identifierHit: Excerpt | null = null;
  for (const raw of lines) {
    const fence = /^\s{0,3}(`{3,})\s*([\w+#.-]*)/.exec(raw);
    if (fence) {
      if (!inFence) { inFence = true; fenceLen = fence[1]!.length; lang = fence[2] || null; n = 0; continue; }
      if (fence[1]!.length >= fenceLen && !fence[2]) { inFence = false; lang = null; continue; }
    }
    if (inFence) n++;
    const line = raw.length > MAX_LINE * 3 ? raw.slice(0, MAX_LINE * 3) : raw;
    // ในโค้ด คำค้นหลายคำ ("user by id") ให้เน้นทั้ง identifier ที่แตกคำแล้วตรง (getUserById) ก่อน ไม่ใช่ตัวอักษรย่อยกระจาย
    const idFirst = inFence && terms.length > 1 ? highlightIdentifiers(line, terms) : null;
    if (idFirst && hasMark(idFirst)) return { kind: "code", segments: windowAround(idFirst), line: n, lang };
    const segs = highlight(line, terms);
    if (hasMark(segs)) {
      return inFence
        ? { kind: "code", segments: windowAround(segs), line: n, lang }
        : { kind: "text", segments: windowAround(segs) };
    }
    if (inFence && !identifierHit) {
      const idSegs = highlightIdentifiers(line, terms);
      if (hasMark(idSegs)) identifierHit = { kind: "code", segments: windowAround(idSegs), line: n, lang };
    }
  }
  return identifierHit;
}

/** ผลค้นหาหนึ่งรายการ: ชื่อที่ไฮไลต์ + ข้อความตัวอย่างจากคำอธิบายสั้นหรือเนื้อหา (อันแรกที่เจอคำ) */
export function buildResultSnippet(src: { title: string; summary: string | null; body: string | null }, terms: readonly string[]): ResultSnippet {
  const title = highlight(src.title, terms);
  if (src.summary) {
    const s = highlight(src.summary, terms);
    if (hasMark(s)) return { title, excerpt: { kind: "text", segments: windowAround(s) } };
  }
  const fromBody = src.body ? bodyExcerpt(src.body, terms) : null;
  if (fromBody) return { title, excerpt: fromBody };
  // เจอจาก tag / ชื่อไฟล์แนบ / ชื่อเรื่อง: แสดงคำอธิบายสั้นโดยไม่เน้น
  if (src.summary) return { title, excerpt: { kind: "text", segments: [{ t: src.summary.slice(0, WINDOW * 2), m: false }] } };
  return { title, excerpt: null };
}
