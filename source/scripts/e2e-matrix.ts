// Permission test matrix (design.md §16.1) — ทดสอบผ่าน HTTP จริงกับเซิร์ฟเวอร์ที่รันอยู่ (ค่าเริ่ม http://localhost:3100)
// ผู้ใช้: A เจ้าของ(W1, member) · B member(W1) · D admin(W1) · F member ที่ถูกปิดบัญชีระหว่างทดสอบ · E admin ของ W2 · ANON ไม่ล็อกอิน
// สร้าง workspace/ผู้ใช้ทดสอบเองโดยตรงใน DB (ไม่ผ่านคำเชิญ) — ใช้: npm run e2e:matrix  (ต้อง npm run dev หรือ npm start รันอยู่)
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { uuidv7 } from "uuidv7";

const BASE = process.env.BASE ?? "http://localhost:3100";
const DB = process.env.DATABASE_URL;
if (!DB) throw new Error("DATABASE_URL is required");

let pass = 0, fail = 0;
const failures: string[] = [];
/** แปลงเป็นข้อความที่ไม่ขึ้นกับลำดับ key ของ object (เทียบค่า ไม่ใช่เทียบลำดับ) */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
function chk(name: string, want: unknown, got: unknown) {
  const ok = canon(want) === canon(got);
  if (ok) pass++; else { fail++; failures.push(`FAIL ${name}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`); }
}

// ---------- HTTP client ----------
type R = { status: number; json: any; headers: Headers; bytes: number };
class Client {
  cookie = "";
  constructor(readonly who: string) {}
  async login(email: string, password: string) {
    const r = await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error(`login ${this.who} failed: ${r.status}`);
    this.cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  }
  async req(method: string, path: string, body?: unknown | FormData): Promise<R> {
    const headers: Record<string, string> = { origin: BASE };
    if (this.cookie) headers.cookie = this.cookie;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const r = await fetch(`${BASE}${path}`, { method, headers, body: payload, redirect: "manual" });
    const buf = Buffer.from(await r.arrayBuffer());
    let json: any = null;
    if ((r.headers.get("content-type") ?? "").includes("json")) try { json = JSON.parse(buf.toString("utf8")); } catch { /* ไม่ใช่ JSON */ }
    return { status: r.status, json, headers: r.headers, bytes: buf.length };
  }
  get = (p: string) => this.req("GET", p);
}

// ---------- สร้างข้อมูลทดสอบ ----------
const tag = Date.now().toString(36);
const pw = `Mx-${randomBytes(9).toString("base64url")}`;
const w1 = uuidv7(), w2 = uuidv7();
const ids = { A: uuidv7(), B: uuidv7(), D: uuidv7(), F: uuidv7(), E: uuidv7() };
const email = (k: string) => `mx-${k.toLowerCase()}-${tag}@example.test`;

const c = new pg.Client({ connectionString: DB });
await c.connect();
await c.query("insert into workspaces (id,name,slug) values ($1,'mx W1',$2), ($3,'mx W2',$4)", [w1, `mx1-${tag}`, w2, `mx2-${tag}`]);
const hash = await hashPassword(pw);
for (const [k, role, ws] of [["A", "member", w1], ["B", "member", w1], ["D", "admin", w1], ["F", "member", w1], ["E", "admin", w2]] as const) {
  await c.query("insert into users (id,workspace_id,email,display_name,role) values ($1,$2,$3,$4,$5)", [ids[k], ws, email(k), `User${k}`, role]);
  await c.query("insert into account (id,user_id,account_id,provider_id,password) values ($1,$2::uuid,$2::text,'credential',$3)", [uuidv7(), ids[k], hash]);
}
await c.end();

const U: Record<string, Client> = { A: new Client("A"), B: new Client("B"), D: new Client("D"), F: new Client("F"), E: new Client("E"), ANON: new Client("ANON") };
for (const k of ["A", "B", "D", "F", "E"]) await U[k]!.login(email(k), pw);
const A = U.A!, B = U.B!, D = U.D!, E = U.E!, F = U.F!, ANON = U.ANON!;
const WHO = ["A", "B", "D", "E", "ANON"] as const;
type Who = (typeof WHO)[number];

// Collection: CP = ส่วนตัวของ A, CE = ทีมแก้ไขได้
const CP = (await A.req("POST", "/api/v1/collections", { name: `mx-private-${tag}`, visibility: "private" })).json.id as string;
const CE = (await A.req("POST", "/api/v1/collections", { name: `mx-edit-${tag}`, visibility: "workspace_edit" })).json.id as string;

// รายการ: ทุกชิ้นมี tag เฉพาะตัว + ไฟล์แนบรูป/ข้อความ
type Spec = { key: string; vis: string; col: string | null; view: Who[]; edit: Who[]; manage: Who[]; kinds: string[] };
const ALL_VIEW: Who[] = ["A", "B", "D"];
const specs: Spec[] = [
  { key: "i1", vis: "private", col: null, view: ["A"], edit: ["A"], manage: ["A"], kinds: ["note"] },
  { key: "i2", vis: "workspace_view", col: null, view: ALL_VIEW, edit: ["A", "D"], manage: ["A", "D"], kinds: ["snippet"] },
  { key: "i3", vis: "workspace_edit", col: null, view: ALL_VIEW, edit: ALL_VIEW, manage: ["A", "D"], kinds: ["script"] },
  { key: "i4", vis: "inherit", col: CP, view: ["A"], edit: ["A"], manage: ["A"], kinds: ["note"] },                    // inherit จาก Collection ส่วนตัว
  { key: "i5", vis: "inherit", col: CE, view: ALL_VIEW, edit: ALL_VIEW, manage: ["A", "D"], kinds: ["link"] },            // inherit จาก Collection ทีมแก้ไขได้
  { key: "i6", vis: "workspace_edit", col: CP, view: ALL_VIEW, edit: ALL_VIEW, manage: ["A", "D"], kinds: ["snippet"] },  // เปิดกว้างกว่า Collection แม่
  { key: "i7", vis: "workspace_view", col: null, view: [], edit: [], manage: [], kinds: ["note"] },                        // อยู่ในถังขยะ
];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
type Item = Spec & { id: string; title: string; tagName: string; atts: { id: string; name: string }[] };
const items: Item[] = [];
for (const s of specs) {
  const title = `mx7 ${s.key} ${tag}`, tagName = `tg-${s.key}-${tag}`;
  const r = await A.req("POST", "/api/v1/items", { title, body: `\`\`\`bash\necho ${s.key}\n\`\`\``, kinds: s.kinds, tags: [tagName], collectionId: s.col, visibility: s.vis });
  if (r.status !== 201) throw new Error(`create ${s.key}: ${r.status} ${JSON.stringify(r.json)}`);
  const it: Item = { ...s, id: r.json.id, title, tagName, atts: [] };
  for (const [name, data, type] of [[`img-${s.key}.png`, PNG, "image/png"], [`doc-${s.key}.txt`, Buffer.from(`secret ${s.key}`), "text/plain"]] as const) {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(data)], { type }), name);
    const u = await A.req("POST", `/api/v1/items/${it.id}/attachments`, fd);
    if (u.status !== 201) throw new Error(`upload ${name}: ${u.status}`);
    it.atts.push({ id: u.json.attachment.id, name });
  }
  items.push(it);
}
const I = Object.fromEntries(items.map((i) => [i.key, i])) as Record<string, Item>;
chk("setup-trash-i7", 200, (await A.req("DELETE", `/api/v1/items/${I.i7!.id}`)).status);

const can = (u: Who, list: Who[]) => list.includes(u);
const visible = (u: Who) => items.filter((i) => can(u, i.view));
const denied = (u: Who, ok: boolean) => (ok ? null : u === "ANON" ? 401 : 404);
const sortStr = (a: string[]) => [...a].sort();

// ---------- ช่องทาง 1,6,7,8,9: ทีละ (ผู้ใช้ × รายการ) ----------
for (const w of WHO) {
  const u = U[w]!;
  for (const it of items) {
    const v = can(w, it.view), e = can(w, it.edit), m = can(w, it.manage), tag = `${w}/${it.key}`;
    const hid = w === "ANON" ? 401 : 404;
    // 1) เปิดลิงก์ตรง
    const g = await u.get(`/api/v1/items/${it.id}`);
    chk(`open ${tag}`, v ? 200 : hid, g.status);
    if (v) chk(`open-perms ${tag}`, [e, m], [g.json.permissions.canEdit, g.json.permissions.canManage]);
    // 6) ไฟล์แนบด้วย URL ตรง + 7) รูปแสดง inline เฉพาะผู้มีสิทธิ์
    for (const a of it.atts) {
      const d = await u.get(`/api/v1/attachments/${a.id}/download`);
      chk(`attach ${tag} ${a.name}`, v ? 200 : hid, d.status);
      if (v) {
        const disp = d.headers.get("content-disposition") ?? "";
        chk(`attach-disposition ${tag} ${a.name}`, a.name.endsWith(".png") ? "inline" : "attachment", disp.split(";")[0]);
        chk(`attach-nosniff ${tag} ${a.name}`, "nosniff", d.headers.get("x-content-type-options"));
      }
    }
    chk(`attach-list ${tag}`, v ? 200 : hid, (await u.get(`/api/v1/items/${it.id}/attachments`)).status);
    // 8) ประวัติเวอร์ชัน
    chk(`history ${tag}`, v ? 200 : hid, (await u.get(`/api/v1/items/${it.id}/versions`)).status);
    chk(`history-v1 ${tag}`, v ? 200 : hid, (await u.get(`/api/v1/items/${it.id}/versions/1`)).status);
    // 9) แก้ไข (ใช้ version เก่าเกินจริง: สิทธิ์ถูกตรวจก่อน version → แก้ได้ = 409, ดูได้แต่แก้ไม่ได้ = 403, ไม่เห็น = 404)
    const put = await u.req("PUT", `/api/v1/items/${it.id}`, { version: 999999, title: "hack", body: "hack" });
    chk(`put ${tag}`, w === "ANON" ? 401 : !v ? 404 : e ? 409 : 403, put.status);
    // 9) ลบ/ย้าย/เปลี่ยนสิทธิ์ — ทดสอบเฉพาะกรณีที่ต้องถูกปฏิเสธ (ผู้ที่ทำได้ทดสอบจริงในส่วน "การเปลี่ยนแปลง")
    if (!m) {
      const want = w === "ANON" ? 401 : v ? 403 : 404;
      chk(`delete-denied ${tag}`, want, (await u.req("DELETE", `/api/v1/items/${it.id}`)).status);
      chk(`move-denied ${tag}`, want, (await u.req("PATCH", `/api/v1/items/${it.id}/move`, { collectionId: null })).status);
      chk(`visibility-denied ${tag}`, want, (await u.req("PATCH", `/api/v1/items/${it.id}/visibility`, { visibility: "private" })).status);
      // อัปโหลด/ลบไฟล์แนบ: ต้อง canEdit
      const fd = new FormData(); fd.append("file", new Blob(["x"]), "x.txt");
      chk(`attach-upload ${tag}`, w === "ANON" ? 401 : !v ? 404 : e ? 201 : 403, e && v ? 201 : (await u.req("POST", `/api/v1/items/${it.id}/attachments`, fd)).status);
    }
    // ถังขยะ: กู้/ลบถาวรของรายการที่ไม่อยู่ในถัง = 404 (ไม่ใช่ของถังขยะ) / ANON 401
    if (it.key !== "i7") chk(`restore-not-trashed ${tag}`, w === "ANON" ? 401 : 404, (await u.req("POST", `/api/v1/items/${it.id}/restore`)).status);
  }
}
// รายการ i7 อยู่ในถังขยะ: กู้/ลบถาวรได้เฉพาะเจ้าของ และ Admin (รายการไม่ส่วนตัว); B/E = 404; ANON = 401
for (const w of ["B", "E"] as const) {
  chk(`trash-restore ${w}`, 404, (await U[w]!.req("POST", `/api/v1/items/${I.i7!.id}/restore`)).status);
  chk(`trash-purge ${w}`, 404, (await U[w]!.req("DELETE", `/api/v1/trash/${I.i7!.id}`)).status);
}
chk("trash-restore ANON", 401, (await ANON.req("POST", `/api/v1/items/${I.i7!.id}/restore`)).status);
chk("trash-purge ANON", 401, (await ANON.req("DELETE", `/api/v1/trash/${I.i7!.id}`)).status);
for (const [w, want] of [["A", true], ["D", true], ["B", false], ["E", false]] as const) {
  const t = await U[w]!.get("/api/v1/trash");
  chk(`trash-list-sees-i7 ${w}`, want, (t.json?.items ?? []).some((x: { id: string }) => x.id === I.i7!.id));
}
chk("trash-list ANON", 401, (await ANON.get("/api/v1/trash")).status);

// ---------- ช่องทาง 2: list ใน Collection / Inbox / ของฉัน ----------
for (const w of WHO) {
  const u = U[w]!;
  const idsOf = (r: R) => sortStr((r.json?.items ?? []).filter((x: { title: string }) => x.title.includes(tag)).map((x: { id: string }) => x.id));
  const exp = (pred: (i: Item) => boolean) => sortStr(visible(w).filter(pred).map((i) => i.id));
  if (w === "ANON") {
    for (const p of [`?collection=${CP}`, `?collection=${CE}`, "?scope=inbox", "?scope=mine", ""]) chk(`list ANON ${p}`, 401, (await u.get(`/api/v1/items${p}`)).status);
    continue;
  }
  chk(`list-CP ${w}`, exp((i) => i.col === CP), idsOf(await u.get(`/api/v1/items?collection=${CP}`)));
  chk(`list-CE ${w}`, exp((i) => i.col === CE), idsOf(await u.get(`/api/v1/items?collection=${CE}`)));
  chk(`list-inbox ${w}`, exp((i) => i.col === null), idsOf(await u.get("/api/v1/items?scope=inbox")));
  chk(`list-recent ${w}`, exp(() => true), idsOf(await u.get("/api/v1/items?scope=recent")));
  chk(`list-mine ${w}`, w === "A" ? exp(() => true) : [], idsOf(await u.get("/api/v1/items?scope=mine")));
}

// ---------- ช่องทาง 3: ค้นหา (ชื่อ, ข้อความตัวอย่าง, total, facet) ----------
const trimHit = (h: { title: string }) => h.title;
for (const w of WHO) {
  const u = U[w]!;
  const s = await u.get(`/api/v1/search?q=mx7+${tag}`);
  if (w === "ANON") { chk("search ANON", 401, s.status); continue; }
  const vis = visible(w);
  chk(`search-total ${w}`, vis.length, s.json.total);
  chk(`search-titles ${w}`, sortStr(vis.map((i) => i.title)), sortStr(s.json.hits.map(trimHit)));
  chk(`search-facet-tags ${w}`, sortStr(vis.map((i) => i.tagName)), sortStr(s.json.facets.tags.map((t: { value: string }) => t.value).filter((t: string) => t.includes(tag))));
  const kinds: Record<string, number> = {};
  for (const i of vis) for (const k of i.kinds) kinds[k] = (kinds[k] ?? 0) + 1;
  const gotKinds: Record<string, number> = {};
  for (const f of s.json.facets.kinds) gotKinds[f.value] = f.count;
  chk(`search-facet-kinds ${w}`, kinds, gotKinds);
  chk(`search-facet-lang ${w}`, vis.length ? [`bash`] : [], s.json.facets.langs.map((l: { value: string }) => l.value));
  // ชื่อ/ข้อความตัวอย่าง/ไฟล์แนบของรายการที่มองไม่เห็นต้องไม่ปรากฏเลยทั้งก้อนคำตอบ
  const body = JSON.stringify(s.json);
  for (const i of items.filter((x) => !can(w, x.view))) {
    chk(`search-no-leak-title ${w}/${i.key}`, false, body.includes(i.title) || body.includes(i.id) || body.includes(i.tagName));
  }
  // ค้นจากชื่อไฟล์แนบ: เจอเฉพาะรายการที่มองเห็น
  for (const i of items) {
    const r = await u.get(`/api/v1/search?q=${encodeURIComponent(`doc-${i.key}`)}`);
    chk(`search-attname ${w}/${i.key}`, can(w, i.view) ? 1 : 0, r.json.total);
  }
  // ตัวกรอง tag:/is:private/owner:me ต้องไม่ทำให้เห็นของที่มองไม่เห็น
  for (const i of items) chk(`search-tagfilter ${w}/${i.key}`, can(w, i.view) ? 1 : 0, (await u.get(`/api/v1/search?tag=${encodeURIComponent(i.tagName)}`)).json.total);
  chk(`search-is-private ${w}`, w === "A" ? 2 : 0, (await u.get(`/api/v1/search?q=mx7+${tag}+is%3Aprivate`)).json.total);
  // ช่องทาง 4: quick search + autocomplete tag
  const q = await u.get(`/api/v1/search/quick?q=mx7+${tag}`);
  chk(`quick ${w}`, sortStr(vis.map((i) => i.id)), sortStr(q.json.items.map((x: { id: string }) => x.id)));
  const tg = await u.get(`/api/v1/tags?prefix=tg-i&limit=50`);
  chk(`tags-autocomplete ${w}`, sortStr(vis.map((i) => i.tagName)), sortStr(tg.json.tags.map((t: { slug: string }) => t.slug).filter((t: string) => t.endsWith(tag))));
  const qt = await u.get(`/api/v1/search/quick?q=${encodeURIComponent("tg-i")}`);
  chk(`quick-by-tag-no-leak ${w}`, [], qt.json.items.filter((x: { id: string }) => items.some((i) => i.id === x.id && !can(w, i.view))));
}
chk("quick ANON", 401, (await ANON.get("/api/v1/search/quick?q=mx7")).status);
chk("tags ANON", 401, (await ANON.get("/api/v1/tags?prefix=tg")).status);

// ---------- ช่องทาง 5: จำนวนใน sidebar ----------
const treeOf = async (w: Who) => (await U[w]!.get("/api/v1/collections/tree")).json?.tree as { id: string; count: number }[] | undefined;
const cnt = (t: { id: string; count: number }[] | undefined, id: string) => t?.find((x) => x.id === id)?.count ?? null;
chk("sidebar A", [2, 1], [cnt(await treeOf("A"), CP), cnt(await treeOf("A"), CE)]);
chk("sidebar B", [null, 1], [cnt(await treeOf("B"), CP), cnt(await treeOf("B"), CE)]);   // B ไม่เห็น CP (ส่วนตัว) แม้มี i6 ที่เปิดกว้าง
chk("sidebar D", [null, 1], [cnt(await treeOf("D"), CP), cnt(await treeOf("D"), CE)]);
chk("sidebar E", [null, null], [cnt(await treeOf("E"), CP), cnt(await treeOf("E"), CE)]);
chk("sidebar ANON", 401, (await ANON.get("/api/v1/collections/tree")).status);
chk("collection-patch B-on-CP", 404, (await B.req("PATCH", `/api/v1/collections/${CP}`, { name: "hack" })).status);
chk("collection-patch B-on-CE", 403, (await B.req("PATCH", `/api/v1/collections/${CE}`, { name: "hack" })).status);
chk("collection-patch E-on-CE", 404, (await E.req("PATCH", `/api/v1/collections/${CE}`, { name: "hack" })).status);
chk("collection-delete D-on-CP", 404, (await D.req("DELETE", `/api/v1/collections/${CP}`)).status);
chk("create-in-private-collection B", 404, (await B.req("POST", "/api/v1/items", { title: "x", collectionId: CP })).status);
chk("create-in-private-collection D", 404, (await D.req("POST", "/api/v1/items", { title: "x", collectionId: CP })).status);
chk("create-in-private-collection E", 404, (await E.req("POST", "/api/v1/items", { title: "x", collectionId: CP })).status);

// ---------- ช่องทาง 10: หน้า Admin ----------
const adminPrivate = async (w: Who) => U[w]!.get("/api/v1/admin/private-items");
const dp = await adminPrivate("D");
chk("admin-private D status", 200, dp.status);
chk("admin-private D ids", sortStr([I.i1!.id, I.i4!.id]), sortStr((dp.json.items as { id: string }[]).filter((x) => items.some((i) => i.id === x.id)).map((x) => x.id)));
chk("admin-private D metadata-only", true, (dp.json.items as Record<string, unknown>[]).every((x) => !("body" in x) && !("summary" in x) && !("searchText" in x)));
chk("admin-private D no-content", false, JSON.stringify(dp.json).includes("echo i1"));
chk("admin-private A", 404, (await adminPrivate("A")).status);
chk("admin-private B", 404, (await adminPrivate("B")).status);
chk("admin-private ANON", 401, (await adminPrivate("ANON")).status);
const ep = await adminPrivate("E");
chk("admin-private E sees-nothing-of-W1", 0, (ep.json?.items ?? []).filter((x: { id: string }) => items.some((i) => i.id === x.id)).length);
chk("admin-audit E sees-nothing-of-W1", 0, JSON.stringify((await E.get("/api/v1/admin/audit-logs")).json).split(I.i1!.id).length - 1);
chk("admin-audit D has-W1-rows", true, (await D.get("/api/v1/admin/audit-logs")).json.total > 0);
for (const w of ["A", "B"] as const) chk(`admin-audit ${w}`, 404, (await U[w]!.get("/api/v1/admin/audit-logs")).status);
chk("admin-transfer E-on-W1", 404, (await E.req("POST", `/api/v1/admin/items/${I.i2!.id}/transfer`, { newOwnerId: ids.E })).status);
chk("admin-transfer D-private-owner-active", 403, (await D.req("POST", `/api/v1/admin/items/${I.i1!.id}/transfer`, { newOwnerId: ids.B })).status);
chk("admin-settings B", 404, (await B.get("/api/v1/admin/settings")).status);
chk("admin-users B", 404, (await B.get("/api/v1/admin/users")).status);
chk("admin-users E-sees-only-W2", true, !JSON.stringify((await E.get("/api/v1/admin/users")).json).includes(email("A")));

// ---------- การเปลี่ยนแปลง (§16.1 "กรณีการเปลี่ยนแปลง") ----------
const searchTitles = async (w: Who) => sortStr((await U[w]!.get(`/api/v1/search?q=mx7+${tag}`)).json.hits.map(trimHit));
const viewTitles = (u: Who) => sortStr(visible(u).map((i) => i.title));
// (1) เปลี่ยนสิทธิ์ Collection → สิทธิ์ของรายการที่ inherit เปลี่ยนตามทันที และผลค้นหาเปลี่ยนตาม
chk("chg1 set CE private", 200, (await A.req("PATCH", `/api/v1/collections/${CE}`, { visibility: "private" })).status);
chk("chg1 B i5 hidden", 404, (await B.get(`/api/v1/items/${I.i5!.id}`)).status);
chk("chg1 B attach hidden", 404, (await B.get(`/api/v1/attachments/${I.i5!.atts[0]!.id}/download`)).status);
chk("chg1 B search drops i5", viewTitles("B").filter((t) => t !== I.i5!.title), await searchTitles("B"));
chk("chg1 D search drops i5", viewTitles("D").filter((t) => t !== I.i5!.title), await searchTitles("D"));
chk("chg1 A still sees i5", 200, (await A.get(`/api/v1/items/${I.i5!.id}`)).status);
chk("chg1 set CE back", 200, (await A.req("PATCH", `/api/v1/collections/${CE}`, { visibility: "workspace_edit" })).status);
chk("chg1 B i5 visible again", 200, (await B.get(`/api/v1/items/${I.i5!.id}`)).status);
chk("chg1 B search back", viewTitles("B"), await searchTitles("B"));
// (2) ย้ายรายการ (inherit) ไป Collection ส่วนตัว → B ไม่เห็นอีกต่อไป
chk("chg2 move i5 to CP", 200, (await A.req("PATCH", `/api/v1/items/${I.i5!.id}/move`, { collectionId: CP })).status);
chk("chg2 B i5 hidden", 404, (await B.get(`/api/v1/items/${I.i5!.id}`)).status);
chk("chg2 B search drops i5", viewTitles("B").filter((t) => t !== I.i5!.title), await searchTitles("B"));
chk("chg2 B sidebar CE count", 0, cnt(await treeOf("B"), CE));
chk("chg2 move i5 back", 200, (await A.req("PATCH", `/api/v1/items/${I.i5!.id}/move`, { collectionId: CE })).status);
chk("chg2 B i5 visible again", 200, (await B.get(`/api/v1/items/${I.i5!.id}`)).status);
// (3) ปิดบัญชี F → session หลุดและเรียก API ไม่ได้
chk("chg3 F before", 200, (await F.get(`/api/v1/items/${I.i2!.id}`)).status);
chk("chg3 disable F", 200, (await D.req("PATCH", `/api/v1/admin/users/${ids.F}`, { status: "disabled" })).status);
chk("chg3 F item", 401, (await F.get(`/api/v1/items/${I.i2!.id}`)).status);
chk("chg3 F search", 401, (await F.get("/api/v1/search?q=mx7")).status);
chk("chg3 F attachment", 401, (await F.get(`/api/v1/attachments/${I.i2!.atts[0]!.id}/download`)).status);
chk("chg3 F login", 401, await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ email: email("F"), password: pw }) }).then((r) => r.status));
// (4) B กับ A แก้รายการ workspace_edit พร้อมกัน → คนที่บันทึกทีหลังได้ 409
const cur = (await A.get(`/api/v1/items/${I.i3!.id}`)).json.item.version as number;
chk("chg4 A saves", 200, (await A.req("PUT", `/api/v1/items/${I.i3!.id}`, { version: cur, title: I.i3!.title, body: "by A", kinds: ["script"], tags: [I.i3!.tagName] })).status);
const late = await B.req("PUT", `/api/v1/items/${I.i3!.id}`, { version: cur, title: I.i3!.title, body: "by B", kinds: ["script"], tags: [I.i3!.tagName] });
chk("chg4 B late = 409", 409, late.status);
chk("chg4 409 carries latest", "by A", late.json?.current?.body);
chk("chg4 B retry with latest", 200, (await B.req("PUT", `/api/v1/items/${I.i3!.id}`, { version: late.json.current.version, title: I.i3!.title, body: "by B", kinds: ["script"], tags: [I.i3!.tagName] })).status);
// ผู้ที่มีสิทธิ์จัดการทำได้จริง (A เจ้าของ, D admin กับรายการไม่ส่วนตัว) และ D ยังเปิด/ลบ รายการส่วนตัวของ A ไม่ได้
chk("manage A visibility i2", 200, (await A.req("PATCH", `/api/v1/items/${I.i2!.id}/visibility`, { visibility: "workspace_view" })).status);
chk("manage D visibility i2", 200, (await D.req("PATCH", `/api/v1/items/${I.i2!.id}/visibility`, { visibility: "workspace_view" })).status);
chk("manage D move i3", 200, (await D.req("PATCH", `/api/v1/items/${I.i3!.id}/move`, { collectionId: CE })).status);
chk("manage D move i3 back", 200, (await D.req("PATCH", `/api/v1/items/${I.i3!.id}/move`, { collectionId: null })).status);
chk("manage D private i1 still 404", 404, (await D.req("PATCH", `/api/v1/items/${I.i1!.id}/visibility`, { visibility: "workspace_view" })).status);
chk("manage D private i4 delete 404", 404, (await D.req("DELETE", `/api/v1/items/${I.i4!.id}`)).status);
// ผู้ใช้ที่ไม่มีสิทธิ์ยังถูกปฏิเสธเหมือนเดิมหลังการเปลี่ยนแปลงทั้งหมด (รายการไม่ถูกแก้โดยการทดสอบปฏิเสธ)
chk("final i1 intact", I.i1!.title, (await A.get(`/api/v1/items/${I.i1!.id}`)).json.item.title);
chk("final i2 intact", I.i2!.title, (await A.get(`/api/v1/items/${I.i2!.id}`)).json.item.title);
chk("final i4 still private", "private", (await A.get(`/api/v1/items/${I.i4!.id}`)).json.item.effectiveVisibility);
// Outsider E ทำอะไรกับ W1 ไม่ได้เลย (ไฟล์แนบ/ประวัติ/กู้/โอน)
for (const i of items) {
  const fd = new FormData(); fd.append("file", new Blob(["x"]), "x.txt");
  chk(`E-upload ${i.key}`, 404, (await E.req("POST", `/api/v1/items/${i.id}/attachments`, fd)).status);
  chk(`E-delete-attachment ${i.key}`, 404, (await E.req("DELETE", `/api/v1/attachments/${i.atts[0]!.id}`)).status);
  chk(`E-restore-version ${i.key}`, 404, (await E.req("POST", `/api/v1/items/${i.id}/versions/1/restore`, { version: 1 })).status);
}

// ---------- สรุป E2E §16.3 (flow หลักตั้งแต่ต้นจนจบ) ----------
const f1 = (await A.req("POST", "/api/v1/collections", { name: `flow-${tag}`, visibility: "workspace_view" })).json.id as string;
const fs = await A.req("POST", "/api/v1/items", { title: `flow snippet ${tag}`, kinds: ["snippet"], collectionId: f1, tags: ["flow"], body: "```ts\nconst x = 1;\n```" });
const fid = fs.json.id as string;
const fd2 = new FormData(); fd2.append("file", new Blob([new Uint8Array(PNG)], { type: "image/png" }), "shot.png");
chk("flow attach", 201, (await A.req("POST", `/api/v1/items/${fid}/attachments`, fd2)).status);
chk("flow search finds", 1, (await A.get(`/api/v1/search?q=${encodeURIComponent(`flow snippet ${tag}`)}`)).json.total);
const bView = await B.get(`/api/v1/items/${fid}`);
chk("flow B can view not edit", [200, false], [bView.status, bView.json.permissions.canEdit]);
chk("flow B edit refused", 403, (await B.req("PUT", `/api/v1/items/${fid}`, { version: 1, title: "b", body: "b" })).status);
chk("flow A set workspace_edit", 200, (await A.req("PATCH", `/api/v1/items/${fid}/visibility`, { visibility: "workspace_edit" })).status);
chk("flow B can edit now", 200, (await B.req("PUT", `/api/v1/items/${fid}`, { version: 1, title: `flow snippet ${tag}`, kinds: ["snippet"], tags: ["flow"], body: "edited by B" })).status);
const hist = await A.get(`/api/v1/items/${fid}/versions`);
chk("flow history 2 versions", 2, hist.json.versions.length);
chk("flow restore v1", 200, (await A.req("POST", `/api/v1/items/${fid}/versions/1/restore`, { version: 2 })).status);
chk("flow restored content", "```ts\nconst x = 1;\n```", (await A.get(`/api/v1/items/${fid}`)).json.item.body);
chk("flow delete", 200, (await A.req("DELETE", `/api/v1/items/${fid}`)).status);
chk("flow gone from search", 0, (await A.get(`/api/v1/search?q=${encodeURIComponent(`flow snippet ${tag}`)}`)).json.total);
chk("flow in trash", true, (await A.get("/api/v1/trash")).json.items.some((x: { id: string }) => x.id === fid));
chk("flow restore from trash", 200, (await A.req("POST", `/api/v1/items/${fid}/restore`)).status);
chk("flow back in search", 1, (await A.get(`/api/v1/search?q=${encodeURIComponent(`flow snippet ${tag}`)}`)).json.total);
chk("flow attachment survives", 200, (await B.get(`/api/v1/attachments/${(await A.get(`/api/v1/items/${fid}/attachments`)).json.attachments[0].id}/download`)).status);

console.log(failures.join("\n"));
console.log(`passed=${pass} failed=${fail}`);
process.exit(fail ? 1 : 0);
