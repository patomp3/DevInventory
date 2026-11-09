import { describe, expect, it } from "vitest";
import { orderCollections } from "@/lib/collection-order";

const n = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });

describe("orderCollections", () => {
  it("เรียงแม่ตามด้วยลูกของแม่นั้นทันที (ไม่ใช่เรียงรวมกันตามชื่อ)", () => {
    const r = orderCollections([n("a", "A"), n("b", "B"), n("a1", "A-1", "a"), n("b1", "B-1", "b"), n("a1x", "A-1-x", "a1")]);
    expect(r.map((x) => x.id)).toEqual(["a", "a1", "a1x", "b", "b1"]);
    expect(r.map((x) => x.level)).toEqual([0, 1, 2, 0, 1]);
    expect(r.find((x) => x.id === "a1x")!.path).toBe("A › A-1 › A-1-x");
  });
  it("คงลำดับพี่น้องตามที่ส่งเข้ามา", () => {
    expect(orderCollections([n("z", "Z"), n("a", "A")]).map((x) => x.id)).toEqual(["z", "a"]);
  });
  it("โหนดที่แม่ไม่อยู่ในรายการถูกนับเป็นระดับบนสุด", () => {
    const r = orderCollections([n("c", "C", "hidden")]);
    expect(r[0]).toMatchObject({ level: 0, path: "C" });
  });
  it("ไม่วนซ้ำเมื่อข้อมูลเป็นวง", () => {
    const r = orderCollections([n("x", "X", "y"), n("y", "Y", "x")]);
    expect(r.length).toBeLessThanOrEqual(2);
  });
});
