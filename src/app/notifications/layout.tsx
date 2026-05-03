import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "通知",
  description: "查看您的通知消息",
  robots: {
    index: false, // 私人页面不索引
    follow: false,
  },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
