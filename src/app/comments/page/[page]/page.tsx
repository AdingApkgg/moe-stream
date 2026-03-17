import { redirect } from "next/navigation";
import CommentsClient from "../../client";

export default async function CommentsPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { page: pageStr } = await params;
  const { tab } = await searchParams;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/comments");
  if (page === 1) redirect("/comments");
  return <CommentsClient page={page} tab={tab} />;
}
