import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("better-auth.session_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "未找到 Token" }, { status: 404 });
  }

  return NextResponse.json({ token });
}
