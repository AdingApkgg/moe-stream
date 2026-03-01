import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "浏览历史",
  description: "查看您的浏览历史记录",
  robots: {
    index: false, // 私人页面不索引
    follow: false,
  },
};

export default function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
