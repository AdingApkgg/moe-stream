import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/wasm-hash";

async function hashVisitor(ip: string, ua: string): Promise<string> {
  return sha256(`${ip}|${ua}`);
}

function extractIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const siteConfig = await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select: { referralEnabled: true },
  }).catch(() => null);

  if (!siteConfig?.referralEnabled) {
    return NextResponse.redirect(siteUrl);
  }

  const link = await prisma.referralLink.findUnique({
    where: { code },
    select: { id: true, userId: true, isActive: true, targetUrl: true },
  });

  if (!link || !link.isActive) {
    return NextResponse.redirect(siteUrl);
  }

  const ip = extractIp(request);
  const ua = request.headers.get("user-agent") || "";
  const referer = request.headers.get("referer") || null;
  const visitorHash = await hashVisitor(ip, ua);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try to record unique click — unique constraint (linkId, visitorHash, date)
  // handles dedup atomically
  let isUnique = false;
  try {
    await prisma.referralClick.create({
      data: {
        referralLinkId: link.id,
        visitorHash,
        ip: ip !== "unknown" ? ip : null,
        referer: referer?.slice(0, 500) || null,
        date: today,
      },
    });
    isUnique = true;
  } catch {
    // Unique constraint violation → same visitor already clicked today
  }

  // Always increment total clicks; only increment uniqueClicks for new visitors
  await Promise.all([
    prisma.referralLink.update({
      where: { id: link.id },
      data: {
        clicks: { increment: 1 },
        ...(isUnique ? { uniqueClicks: { increment: 1 } } : {}),
      },
    }),
    prisma.referralDailyStat.upsert({
      where: { referralLinkId_date: { referralLinkId: link.id, date: today } },
      create: {
        referralLinkId: link.id,
        userId: link.userId,
        date: today,
        clicks: 1,
        uniqueClicks: isUnique ? 1 : 0,
      },
      update: {
        clicks: { increment: 1 },
        ...(isUnique ? { uniqueClicks: { increment: 1 } } : {}),
      },
    }),
  ]);

  const targetUrl = link.targetUrl || siteUrl;
  const response = NextResponse.redirect(targetUrl);

  response.cookies.set("ref_code", code, {
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}
