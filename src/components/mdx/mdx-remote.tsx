import { MDXRemote } from "next-mdx-remote/rsc";
import type { MDXComponents } from "mdx/types";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { getMDXComponents, mdxProseClasses } from "./mdx-components";

interface MdxContentProps {
  source: string;
  className?: string;
  components?: MDXComponents;
}

/** Server Component MDX 渲染器 - 用于渲染数据库中的 MDX 字符串 */
export function MdxContent({ source, className, components }: MdxContentProps) {
  return (
    <div className={cn(mdxProseClasses, className)}>
      <MDXRemote
        source={source}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
          },
        }}
        components={getMDXComponents(components)}
      />
    </div>
  );
}
