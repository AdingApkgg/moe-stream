"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { mdxProseClasses } from "@/components/mdx/mdx-components";

interface MarkdownProps {
  content: string;
  className?: string;
}

/** 客户端 Markdown 渲染器 - 用于客户端组件中渲染 Markdown/MDX 字符串 */
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn(mdxProseClasses, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              className="rounded-lg max-w-full h-auto"
              loading="lazy"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
