import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "我的文件",
  description: "管理您上传的文件",
  robots: {
    index: false, // 私人页面不索引
    follow: false,
  },
};

export default function MyFilesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
