import { redirect } from "next/navigation";
import AdminTagsClient from "../../client";

export default async function AdminTagsPageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/dashboard/tags");
  if (page === 1) redirect("/dashboard/tags");
  return <AdminTagsClient page={page} />;
}
