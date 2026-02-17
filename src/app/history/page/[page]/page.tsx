import { redirect } from "next/navigation";
import HistoryClient from "../../client";

export default async function HistoryPageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/history");
  if (page === 1) redirect("/history");
  return <HistoryClient page={page} />;
}
