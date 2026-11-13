"use client";
import { useEffect, useRef } from "react";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, HighlightStyle, indentOnInput, LanguageDescription, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder as placeholderExt,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { markdown } from "@codemirror/lang-markdown";

// ธีมเดียวกับ CodeBlock (ui-design §3.1) — สีมาจาก CSS variable --syn-* จึงเปลี่ยนตามธีม light/dark
const theme = EditorView.theme({
  "&": { backgroundColor: "var(--code-bg)", color: "var(--syn-text)", fontSize: "13px", borderRadius: "10px", border: "1px solid var(--border)" },
  "&.cm-focused": { outline: "2px solid var(--accent)", outlineOffset: "1px" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7" },
  ".cm-content": { padding: "10px 0", caretColor: "var(--accent)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  ".cm-gutters": { backgroundColor: "var(--code-bg)", color: "var(--syn-comment)", border: "none", borderRadius: "10px 0 0 10px" },
  ".cm-activeLine": { backgroundColor: "var(--editor-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--editor-line)", color: "var(--syn-text)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-select)" },
  ".cm-placeholder": { color: "var(--syn-comment)" },
  ".cm-panels": { backgroundColor: "var(--sidebar)", color: "var(--text)" },
}, { dark: true });

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.modifier, t.operatorKeyword, t.tagName, t.propertyName, t.attributeName, t.bool, t.null, t.self, t.heading], color: "var(--syn-key)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.monospace, t.inserted], color: "var(--syn-str)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.meta], color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.typeName, t.className], color: "var(--syn-bright)" },
  { tag: t.deleted, color: "var(--syn-del)" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.link, color: "var(--syn-link)", textDecoration: "underline" },
  // เครื่องหมาย Markdown (```, **, #, -) ให้เห็นชัดแต่ไม่แย่งสายตา
  { tag: [t.processingInstruction, t.contentSeparator, t.labelName], color: "var(--syn-mark)" },
]);

async function loadLanguage(id: string) {
  // Markdown: highlight code fence ตามภาษาที่ระบุหลัง ``` ด้วย
  if (id === "markdown") return [markdown({ codeLanguages: languages })];
  const desc = LanguageDescription.matchLanguageName(languages, id, true);
  return desc ? [await desc.load()] : [];
}

/** CodeMirror 6 (ui-design §6 `CodeEditor`) — controlled แบบหลวม: รับ value เริ่มต้น, ส่งค่าใหม่ผ่าน onChange */
export function CodeEditor({ value, onChange, language, label, placeholder, minHeight = 220 }: {
  value: string; onChange: (v: string) => void; language: string; label: string; placeholder?: string; minHeight?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const lang = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), history(), drawSelection(),
          indentOnInput(), bracketMatching(), closeBrackets(), highlightSelectionMatches(),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
          syntaxHighlighting(highlightStyle), theme, lang.current.of([]),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.theme({ ".cm-content, .cm-gutter": { minHeight: `${minHeight}px` } }),
          placeholder ? placeholderExt(placeholder) : [],
          EditorView.updateListener.of((u) => { if (u.docChanged) onChangeRef.current(u.state.doc.toString()); }),
        ],
      }),
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
  }, []); // สร้าง editor ครั้งเดียวต่อ instance (ใช้ key ภายนอกเมื่อต้องการสร้างใหม่)

  // ค่าเปลี่ยนจากภายนอก (เช่น โหลดเวอร์ชันล่าสุดหลัง 409)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    loadLanguage(language).then((ext) => {
      if (!cancelled) view.current?.dispatch({ effects: lang.current.reconfigure(ext) });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [language]);

  return <div ref={host} />;
}
