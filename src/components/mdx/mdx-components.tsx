import type { MDXComponents } from "mdx/types";
import { CodeBlock } from "./code-block";
import { getRedirectUrl } from "@/lib/utils";

/** prose 样式类（供各 MDX 渲染器共享） */
export const mdxProseClasses = [
  "prose prose-sm dark:prose-invert max-w-none",
  "prose-headings:font-semibold prose-headings:tracking-tight",
  "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
  "prose-p:leading-relaxed prose-p:text-muted-foreground",
  "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
  "prose-strong:text-foreground prose-strong:font-semibold",
  "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0",
  "prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r",
  "prose-ul:list-disc prose-ol:list-decimal",
  "prose-li:text-muted-foreground",
  "prose-hr:border-border",
  "prose-table:border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border",
].join(" ");

/** 共享 MDX 组件映射 */
export function getMDXComponents(overrides: MDXComponents = {}): MDXComponents {
  return {
    pre: (props) => <CodeBlock {...props} />,
    a: ({ href, children, ...props }) => {
      const isExternal = href?.startsWith("http");
      return (
        <a
          href={isExternal && href ? getRedirectUrl(href) : href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt, ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt || ""} className="rounded-lg max-w-full h-auto" loading="lazy" {...props} />
    ),
    ...overrides,
  };
}
