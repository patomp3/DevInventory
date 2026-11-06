import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { MarkdownAsync, type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { ShikiTransformer } from "shiki";
import { CodePre } from "@/components/CodePre";
import { getHighlighter, THEME_NAME } from "@/lib/highlight";

// ใส่ภาษาและจำนวนบรรทัดไว้ที่ <pre> ให้ CodePre แสดงในแถบบน
const meta: ShikiTransformer = {
  pre(node) {
    node.properties["data-language"] = this.options.lang;
    node.properties["data-lines"] = this.source.replace(/\n$/, "").split("\n").length;
  },
};

// ไม่ส่ง node (hast) ไปยัง client component
const components: Components = {
  pre: ({ node: _node, ...p }) => <CodePre {...(p as React.ComponentProps<"pre"> & { "data-language"?: string; "data-lines"?: number })} />,
};

/**
 * Markdown (server component) — ลำดับสำคัญ: rehype-sanitize ก่อน (ไม่อนุญาต raw HTML, design.md §14)
 * แล้วจึง highlight code fence ด้วย Shiki (ผลลัพธ์ของ Shiki escape เนื้อหาแล้ว)
 */
export async function MarkdownView({ source }: { source: string }) {
  const highlighter = await getHighlighter();
  return (
    <div className="space-y-3 leading-7 [&_a]:text-accent [&_a]:underline [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-code [&_:not(pre)>code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_table]:block [&_table]:overflow-x-auto [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1">
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSanitize,
          [rehypeShikiFromHighlighter, highlighter, {
            theme: THEME_NAME, lazy: true, fallbackLanguage: "text", defaultLanguage: "text",
            transformers: [meta],
          }],
        ]}
        components={components}
      >
        {source}
      </MarkdownAsync>
    </div>
  );
}
