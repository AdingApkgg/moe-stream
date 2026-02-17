import { redirect } from "next/navigation";
import AdminCommentsClient from "../../client";

export default async function AdminCommentsPageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/dashboard/comments");
  if (page === 1) redirect("/dashboard/comments");
  return <AdminCommentsClient page={page} />;
}
