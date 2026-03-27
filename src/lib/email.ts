import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import Handlebars from "handlebars";
import { prisma } from "./prisma";
import { nanoid } from "nanoid";
import { getServerConfig } from "./server-config";
import { safeFetch } from "./cloud-providers/ssrf-guard";

async function createTransporter(): Promise<{ transporter: Transporter; from: string } | null> {
  const config = await getServerConfig();
  if (!config.smtp) return null;
  const { host, port, user, password, from } = config.smtp;
  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    }),
    from,
  };
}

export async function sendMail(to: string, subject: string, html: string, siteName: string): Promise<void> {
  const config = await getServerConfig();

  if (config.mailSendMode === "http_api" && config.httpEmailApi) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.httpEmailApi.headers,
    };

    const hasAuthorization = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
    if (config.httpEmailApi.key && !hasAuthorization) {
      headers.Authorization = `Bearer ${config.httpEmailApi.key}`;
    }

    const resp = await safeFetch(config.httpEmailApi.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: `"${siteName}" <${config.httpEmailApi.from}>`,
        to,
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const text = (await resp.text()).slice(0, 300);
      throw new Error(`HTTP API 邮件发送失败: ${resp.status} ${text}`);
    }
    return;
  }

  const mail = await createTransporter();
  if (!mail) {
    throw new Error("邮件服务未配置");
  }

  await mail.transporter.sendMail({
    from: `"${siteName}" <${mail.from}>`,
    to,
    subject,
    html,
  });
}

// 邮件模板
const templates = {
  verificationCode: Handlebars.compile(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>验证码</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">{{siteName}}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">{{title}}</h2>
              <p style="margin: 0 0 30px; color: #52525b; font-size: 16px; line-height: 1.6;">
                {{description}}
              </p>
              <!-- Verification Code Box -->
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 30px;">
                <p style="margin: 0 0 10px; color: #71717a; font-size: 14px;">您的验证码是</p>
                <div style="font-size: 36px; font-weight: 700; color: #6366f1; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  {{code}}
                </div>
                <p style="margin: 10px 0 0; color: #a1a1aa; font-size: 12px;">验证码 {{expireMinutes}} 分钟内有效</p>
              </div>
              <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                如果您没有请求此验证码，请忽略此邮件。
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
                此邮件由系统自动发送，请勿直接回复。
              </p>
              <p style="margin: 10px 0 0; color: #a1a1aa; font-size: 12px;">
                © {{year}} {{siteName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `),
};

// 验证码类型
export type VerificationType = "REGISTER" | "LOGIN" | "RESET_PASSWORD" | "CHANGE_EMAIL";

// 生成6位数字验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 发送验证码邮件
export async function sendVerificationCode(
  email: string,
  type: VerificationType,
): Promise<{ success: boolean; message: string }> {
  try {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分钟后过期

    // 删除该邮箱之前的同类型验证码
    await prisma.verificationCode.deleteMany({
      where: { email, type },
    });

    // 创建新验证码
    await prisma.verificationCode.create({
      data: {
        id: nanoid(),
        email,
        code,
        type,
        expiresAt,
      },
    });

    // 根据类型设置邮件内容
    const typeConfig: Record<VerificationType, { title: string; description: string }> = {
      REGISTER: {
        title: "注册验证",
        description: "感谢您注册我们的服务！请使用以下验证码完成注册。",
      },
      LOGIN: {
        title: "登录验证",
        description: "您正在尝试登录账户，请使用以下验证码完成登录。",
      },
      RESET_PASSWORD: {
        title: "重置密码",
        description: "您正在重置密码，请使用以下验证码继续操作。",
      },
      CHANGE_EMAIL: {
        title: "更换邮箱",
        description: "您正在更换绑定邮箱，请使用以下验证码验证新邮箱。",
      },
    };

    const config = typeConfig[type];
    const { getPublicSiteConfig } = await import("@/lib/site-config");
    const siteConfig = await getPublicSiteConfig();
    const siteName = siteConfig.siteName;

    const html = templates.verificationCode({
      siteName,
      title: config.title,
      description: config.description,
      code,
      expireMinutes: 10,
      year: new Date().getFullYear(),
    });

    await sendMail(email, `【${siteName}】${config.title} - 验证码: ${code}`, html, siteName);

    return { success: true, message: "验证码已发送" };
  } catch (error) {
    console.error("Send verification code error:", error);
    if (error instanceof Error && error.message.includes("邮件服务未配置")) {
      return { success: false, message: "邮件服务未配置，请在后台设置 SMTP 或 HTTP API" };
    }
    return { success: false, message: "发送验证码失败，请稍后重试" };
  }
}

// 验证验证码
export async function verifyCode(
  email: string,
  code: string,
  type: VerificationType,
): Promise<{ valid: boolean; message: string }> {
  try {
    const record = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type,
        expiresAt: { gt: new Date() },
        used: false,
      },
    });

    if (!record) {
      return { valid: false, message: "验证码无效或已过期" };
    }

    // 标记为已使用
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    });

    return { valid: true, message: "验证成功" };
  } catch (error) {
    console.error("Verify code error:", error);
    return { valid: false, message: "验证失败" };
  }
}

// 检查邮件发送频率限制（1分钟内只能发送1次）
export async function checkRateLimit(email: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      createdAt: { gt: oneMinuteAgo },
    },
  });
  return !recentCode;
}

/**
 * 发送 2FA OTP 验证码邮件（供 better-auth twoFactor 插件调用）
 */
export async function send2faOtpEmail(email: string, otp: string): Promise<void> {
  const { getPublicSiteConfig } = await import("@/lib/site-config");
  const siteConfig = await getPublicSiteConfig();
  const siteName = siteConfig.siteName;

  const html = templates.verificationCode({
    siteName,
    title: "两步验证",
    description: "您正在登录账户，请使用以下验证码完成两步验证。",
    code: otp,
    expireMinutes: 5,
    year: new Date().getFullYear(),
  });

  await sendMail(email, `【${siteName}】两步验证 - 验证码: ${otp}`, html, siteName);
}
