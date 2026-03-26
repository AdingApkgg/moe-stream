"use client";

import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Endpoint({
  method = "POST",
  path,
  auth = "protected",
  scope,
}: {
  method?: string;
  path: string;
  auth?: "public" | "protected" | "admin" | "owner";
  scope?: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  const authLabels: Record<string, { text: string; cls: string }> = {
    public: { text: "公开", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
    protected: { text: "需登录", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400" },
    admin: { text: "管理员", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
    owner: { text: "站长", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400" },
  };
  const a = authLabels[auth];

  return (
    <div className="not-prose flex items-center gap-2 flex-wrap rounded-lg border bg-muted/30 px-3 py-2 my-3">
      <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-bold", methodColors[method])}>{method}</span>
      <code className="text-sm font-mono">/api/trpc/{path}</code>
      <span className={cn("ml-auto inline-block rounded px-2 py-0.5 text-[11px] font-medium", a.cls)}>{a.text}</span>
      {scope && (
        <span className="inline-block rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 px-2 py-0.5 text-[11px] font-medium">
          {scope}
        </span>
      )}
    </div>
  );
}

export function CopyBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="not-prose relative group my-3">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 h-7 w-7 flex items-center justify-center rounded-md bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      <pre className="rounded-lg bg-muted border p-4 text-xs overflow-x-auto leading-relaxed">
        <code className={`language-${lang}`}>{children.trim()}</code>
      </pre>
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
