import type { Seg } from "@/lib/search/snippet";

/** ข้อความที่ไฮไลต์ (ui-design `Highlight`): <mark> พื้น accent-soft ตัวอักษร accent radius 3 — เนื้อหาเป็น text ล้วน React escape ให้เอง */
export function Marked({ segs }: { segs: Seg[] }) {
  return <>{segs.map((s, i) => (s.m ? <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-accent">{s.t}</mark> : <span key={i}>{s.t}</span>))}</>;
}
