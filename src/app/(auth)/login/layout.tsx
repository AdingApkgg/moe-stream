import type { Metadata } from "next";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();
  return {
    title: "登录",
    description: `登录 ${config.siteName} 账户`,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
