import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "发布内容",
  description: "发布并分享您的 ACGN 相关内容",
  robots: {
    index: false, // 功能页面不索引
    follow: false,
  },
};

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
