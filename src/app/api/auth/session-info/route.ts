import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDeviceInfo } from "@/lib/device-info";
import { getIpLocation } from "@/lib/ip-location";

// 记录/更新登录会话信息（Better Auth 使用数据库 session，此处仅做设备/IP 记录到 LoginSession 供「会话管理」展示）
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id || !session.session?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    await request.json().catch(() => ({}));
    const userAgent = request.headers.get("user-agent") || "";
    const deviceInfo = parseDeviceInfo(userAgent);
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";
    let ipv4Address: string | null = null;
    let ipv6Address: string | null = null;
    if (clientIp.includes(":")) {
      ipv6Address = clientIp;
    } else {
      ipv4Address = clientIp;
    }
    const ipv4Location = await getIpLocation(ipv4Address);
    const ipv6Location = await getIpLocation(ipv6Address);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const loginSession = await prisma.loginSession.upsert({
      where: { jti: session.session.token },
      create: {
        userId: session.user.id,
        jti: session.session.token,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        osVersion: deviceInfo.osVersion,
        browser: deviceInfo.browser,
        browserVersion: deviceInfo.browserVersion,
        brand: deviceInfo.brand,
        model: deviceInfo.model,
        userAgent,
        ipv4Address,
        ipv4Location,
        ipv6Address,
        ipv6Location,
        expiresAt,
      },
      update: {
        lastActiveAt: new Date(),
        ipv4Address,
        ipv4Location,
        ipv6Address,
        ipv6Location,
      },
    });

    return NextResponse.json({ success: true, sessionId: loginSession.id });
  } catch (error) {
    console.error("Session info error:", error);
    return NextResponse.json({ error: "记录会话失败" }, { status: 500 });
  }
}

// 获取当前会话信息
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id || !session.session?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const loginSession = await prisma.loginSession.findUnique({
      where: { jti: session.session.token },
      select: {
        id: true,
        deviceType: true,
        os: true,
        browser: true,
        ipv4Location: true,
        ipv6Location: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    return NextResponse.json({
      session: loginSession,
      sessionId: session.session.id,
    });
  } catch (error) {
    console.error("Get session info error:", error);
    return NextResponse.json({ error: "获取会话失败" }, { status: 500 });
  }
}
