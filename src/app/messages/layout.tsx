import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "私信",
  description: "查看您的私信消息",
  robots: {
    index: false, // 私人页面不索引
    follow: false,
  },
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
