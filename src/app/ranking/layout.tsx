import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "热门排行",
  description: "内容排名和投稿者排行",
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
