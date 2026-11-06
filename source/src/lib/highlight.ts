// Syntax highlight ฝั่ง server ด้วย Shiki (design.md §5) — ธีมเองตามสี ui-design §3.1
// ใช้ JavaScript regex engine (ไม่ต้องโหลด WASM) และโหลดภาษาตามที่ใช้จริงเท่านั้น (lazy ผ่าน @shikijs/rehype)
import { createHighlighter, type Highlighter, type ThemeRegistration } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const C = { key: "#7cb7ff", str: "#a5d6a7", comment: "#7d8797", text: "#c3cad6", bright: "#e7eaf0", bg: "#0b0d10" };

export const THEME_NAME = "dev-inventory";

const theme: ThemeRegistration = {
  name: THEME_NAME,
  type: "dark",
  colors: { "editor.background": C.bg, "editor.foreground": C.text },
  fg: C.text,
  bg: C.bg,
  settings: [
    { settings: { foreground: C.text, background: C.bg } },
    { scope: ["comment", "punctuation.definition.comment", "string.comment"], settings: { foreground: C.comment, fontStyle: "italic" } },
    {
      scope: [
        "keyword", "storage", "storage.type", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.operator.expression",
        "entity.name.tag", "support.type.property-name", "meta.object-literal.key", "entity.other.attribute-name",
        "support.function.builtin", "constant.language", "variable.language", "markup.heading", "entity.name.section",
      ],
      settings: { foreground: C.key },
    },
    { scope: ["string", "string.quoted", "string.template", "punctuation.definition.string", "markup.inline.raw", "markup.fenced_code", "string.unquoted"], settings: { foreground: C.str } },
    { scope: ["entity.name.function", "support.function", "entity.name.type", "entity.name.class"], settings: { foreground: C.bright } },
    { scope: ["markup.inserted"], settings: { foreground: C.str } },
    { scope: ["markup.deleted"], settings: { foreground: "#f28b82" } },
    { scope: ["markup.bold"], settings: { fontStyle: "bold" } },
    { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
  ],
};

let hl: Promise<Highlighter> | undefined;
/** highlighter ตัวเดียวทั้ง process (ภาษาโหลดเพิ่มตามที่เจอใน code fence) */
export const getHighlighter = () =>
  (hl ??= createHighlighter({ themes: [theme], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) }));
