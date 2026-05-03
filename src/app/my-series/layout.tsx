import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的合集",
  description: "管理您创建的合集",
  robots: {
    index: false, // 私人页面不索引
    follow: false,
  },
};

export default function MySeriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
