import { redirect } from "next/navigation";

export default function SeriesPageRedirect() {
  redirect("/dashboard/videos");
}
