import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "评论动态",
  description: "查看全站最新评论与留言",
};

export default function CommentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
