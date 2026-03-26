import type { Metadata } from "next";
import { mdxProseClasses } from "@/components/mdx/mdx-components";
import { DocsSidebar } from "./_components/docs-sidebar";

export const metadata: Metadata = {
  title: "API 文档",
  description: "MoeStream 平台 API 接口文档，通过 HTTP 接口以编程方式发布和管理内容",
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container py-6 max-w-6xl">
      <div className="flex flex-col lg:flex-row gap-8">
        <DocsSidebar />
        <main className="flex-1 min-w-0">
          <article className={mdxProseClasses}>{children}</article>
        </main>
      </div>
    </div>
  );
}
