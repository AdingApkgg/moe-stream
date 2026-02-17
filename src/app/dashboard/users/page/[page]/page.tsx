import { redirect } from "next/navigation";
import AdminUsersClient from "../../client";

export default async function AdminUsersPageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/dashboard/users");
  if (page === 1) redirect("/dashboard/users");
  return <AdminUsersClient page={page} />;
}
