import { redirect } from "next/navigation";
import FavoritesClient from "../../client";

export default async function FavoritesPageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/favorites");
  if (page === 1) redirect("/favorites");
  return <FavoritesClient page={page} />;
}
