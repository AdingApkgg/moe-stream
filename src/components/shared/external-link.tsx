"use client";

import { getRedirectUrl } from "@/lib/utils";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
}

export function ExternalLink({ href, children, ...props }: ExternalLinkProps) {
  const redirectOpts = useRedirectOptions();

  return (
    <a href={getRedirectUrl(href, redirectOpts)} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}
