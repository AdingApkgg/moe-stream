import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ProfileDashboard } from "./client";

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  return <ProfileDashboard userId={session.user.id} />;
}
