import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";
import type { ReactNode } from "react";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const AUTH_LABELS: Record<string, { text: string; cls: string }> = {
  public: { text: "公开", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  protected: { text: "需登录", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400" },
  admin: { text: "管理员", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  owner: { text: "站长", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" },
  apiKey: { text: "API 密钥", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" },
};

export function Endpoint({
  method = "POST",
  path,
  auth = "protected",
  scope,
}: {
  method?: string;
  path: string;
  auth?: string;
  scope?: string;
}) {
  const isScope = auth.includes(":");
  const a = AUTH_LABELS[auth] ?? AUTH_LABELS.apiKey;
  const displayScope = scope ?? (isScope ? auth : undefined);

  return (
    <div className="not-prose flex items-center gap-2 flex-wrap rounded-lg border bg-muted/30 px-3 py-2 my-3">
      <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-bold", METHOD_COLORS[method])}>{method}</span>
      <code className="text-sm font-mono">/api/trpc/{path}</code>
      <span className={cn("ml-auto inline-block rounded px-2 py-0.5 text-[11px] font-medium", a.cls)}>{a.text}</span>
      {displayScope && (
        <span className="inline-block rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-2 py-0.5 text-[11px] font-medium">
          {displayScope}
        </span>
      )}
    </div>
  );
}

export async function CopyBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  const code = children.trim();
  const html = await codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark-dimmed" },
    defaultColor: false,
  });

  return (
    <div className="not-prose mdx-code-block group relative my-3">
      <CopyButton code={code} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function ParamTable({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left py-2 px-3 font-medium text-xs">参数</th>
            <th className="text-left py-2 px-3 font-medium text-xs">类型</th>
            <th className="text-left py-2 px-3 font-medium text-xs w-14">必填</th>
            <th className="text-left py-2 px-3 font-medium text-xs">说明</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function P({
  name,
  type,
  required = false,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 px-3">
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{name}</code>
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground font-mono">{type}</td>
      <td className="py-2 px-3">
        {required ? (
          <span className="inline-block rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
            是
          </span>
        ) : (
          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">否</span>
        )}
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground">{children}</td>
    </tr>
  );
}

export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="not-prose rounded-lg border bg-muted/30 p-4 my-6">
      <p className="text-sm font-medium mb-2">目录</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="text-sm text-primary hover:underline underline-offset-2">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
