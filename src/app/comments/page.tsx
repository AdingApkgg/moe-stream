import CommentsClient from "./client";

export default async function CommentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CommentsClient page={1} tab={tab} />;
}
