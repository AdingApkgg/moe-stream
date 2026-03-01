import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "初始配置",
  description: "首次使用需要完成初始配置",
  robots: { index: false, follow: false },
};

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
