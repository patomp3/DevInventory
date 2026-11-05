import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/** Markdown ผ่าน rehype-sanitize ไม่อนุญาต raw HTML (design.md §14) */
export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="space-y-3 leading-7 [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-code [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-code [&_pre]:p-3 [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted [&_table]:text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{source}</ReactMarkdown>
    </div>
  );
}
