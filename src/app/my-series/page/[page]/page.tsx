import { redirect } from "next/navigation";
import MySeriesClient from "../../client";

export default async function MySeriesPageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);
  if (isNaN(page) || page < 1) redirect("/my-series");
  if (page === 1) redirect("/my-series");
  return <MySeriesClient page={page} />;
}
