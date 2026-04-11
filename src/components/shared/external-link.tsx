import { getRedirectUrl } from "@/lib/utils";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
}

/**
 * 外链组件：自动将外部链接通过中转页跳转。
 * 站内链接（同域名 / 相对路径）不走中转。
 */
export function ExternalLink({ href, children, ...props }: ExternalLinkProps) {
  return (
    <a href={getRedirectUrl(href)} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}
