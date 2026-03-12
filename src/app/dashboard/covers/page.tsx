import { redirect } from "next/navigation";

export default function CoversPageRedirect() {
  redirect("/dashboard/videos");
}
