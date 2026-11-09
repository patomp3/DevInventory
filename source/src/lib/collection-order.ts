/** จัดลำดับ Collection ให้เป็น "แม่ → ลูก" ต่อเนื่องกัน (depth-first) และคำนวณ path สำหรับแสดงปลายทาง (pure) */
export type OrderNode = { id: string; name: string; parentId: string | null };

/**
 * ลำดับของ input ใช้เป็นลำดับพี่น้อง (listTree เรียงตาม sortOrder, ชื่อ แล้ว)
 * โหนดที่แม่ไม่อยู่ในรายการ (เช่น แม่ที่ผู้ใช้เพิ่มรายการไม่ได้) จะถูกนับเป็นระดับบนสุด — path ไม่เอ่ยชื่อแม่ที่ไม่อยู่ในรายการ
 */
export function orderCollections<T extends OrderNode>(nodes: T[]): (T & { level: number; path: string })[] {
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string | null, T[]>();
  for (const n of nodes) {
    const key = n.parentId && ids.has(n.parentId) ? n.parentId : null;
    (kids.get(key) ?? kids.set(key, []).get(key)!).push(n);
  }
  const out: (T & { level: number; path: string })[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, level: number, prefix: string) => {
    for (const n of kids.get(parent) ?? []) {
      if (seen.has(n.id)) continue; // กันวงวนถ้าข้อมูลผิดปกติ
      seen.add(n.id);
      const path = prefix ? `${prefix} › ${n.name}` : n.name;
      out.push({ ...n, level, path });
      walk(n.id, level + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}
