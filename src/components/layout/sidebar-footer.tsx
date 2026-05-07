"use client";

import Link from "next/link";
import { useSiteConfig } from "@/contexts/site-config";
import { useRedirectOptions } from "@/hooks/use-redirect-options";
import { getRedirectUrl } from "@/lib/utils";

/**
 * 紧凑版 footer：参考抖音 / YouTube 的左侧底部布局。
 * 链接小字 flex-wrap 排版，备案号 + 版权放最下方。仅在 sidebar 展开态显示。
 */
export function SidebarFooter() {
  const config = useSiteConfig();
  const redirectOpts = useRedirectOptions();

  const siteName = config?.siteName || "ACGN Site";
  const footerLinks = config?.footerLinks || [];
  const footerText = config?.footerText;
  const icpBeian = config?.icpBeian;
  const publicSecurityBeian = config?.publicSecurityBeian;
  const githubUrl = config?.githubUrl;

  const internalLinks: { href: string; label: string }[] = [];
  if (config?.privacyPolicy) internalLinks.push({ href: "/privacy", label: "隐私政策" });
  if (config?.termsOfService) internalLinks.push({ href: "/terms", label: "服务条款" });
  if (config?.aboutPage) internalLinks.push({ href: "/about", label: "关于" });
  internalLinks.push({ href: "/rss", label: "RSS" });
  internalLinks.push({ href: "/llms", label: "llms.txt" });
  internalLinks.push({ href: "/api-docs", label: "API" });
  internalLinks.push({ href: "/sitemap", label: "Sitemap" });

  return (
    <div className="px-3 py-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground/80">
      {/* 链接列表：紧凑 flex-wrap 排版 */}
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {internalLinks.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors whitespace-nowrap">
            {l.label}
          </Link>
        ))}
        {githubUrl && (
          <a
            href={getRedirectUrl(githubUrl, redirectOpts)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors whitespace-nowrap"
          >
            GitHub
          </a>
        )}
        {footerLinks.map((link, i) => (
          <a
            key={`${link.label}-${i}`}
            href={getRedirectUrl(link.url, redirectOpts)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors whitespace-nowrap"
          >
            {link.label}
          </a>
        ))}
      </div>

      {/* 备案号 */}
      {(icpBeian || publicSecurityBeian) && (
        <div className="space-y-0.5">
          {icpBeian && (
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:text-foreground transition-colors"
            >
              {icpBeian}
            </a>
          )}
          {publicSecurityBeian && (
            <a
              href="https://www.beian.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:text-foreground transition-colors"
            >
              {publicSecurityBeian}
            </a>
          )}
        </div>
      )}

      {/* 版权 */}
      <p className="opacity-70">
        © {new Date().getFullYear()} {siteName}
      </p>

      {/* 自定义页脚文本 (HTML)：管理员在站点配置里填写的备注/联系方式等 */}
      {footerText && (
        <div
          className="opacity-70 [&_a]:underline [&_a]:hover:text-foreground [&_a]:transition-colors"
          dangerouslySetInnerHTML={{ __html: footerText }}
        />
      )}
    </div>
  );
}
