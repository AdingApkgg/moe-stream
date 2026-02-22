import type { Metadata } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  return {
    title: "注册",
    description: `注册 ${config.siteName} 账户，开始分享和发现 ACGN 内容`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
