import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyCaptcha, signMathAnswer, signSliderAnswer, type CaptchaType } from "@/lib/captcha";

function generateMathCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ["+", "-", "×"];
  const opIndex = Math.floor(Math.random() * 3);
  const operator = operators[opIndex];

  let answer: number;
  switch (opIndex) {
    case 0:
      answer = num1 + num2;
      break;
    case 1:
      answer = num1 - num2;
      break;
    case 2:
      answer = num1 * num2;
      break;
    default:
      answer = num1 + num2;
  }

  const text = `${num1} ${operator} ${num2} = ?`;

  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f39c12"];
  const bgColor = "#f5f5f5";
  const textColor = colors[Math.floor(Math.random() * colors.length)];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0 0 150 50">
      <rect width="150" height="50" fill="${bgColor}"/>
      <line x1="${Math.random() * 150}" y1="${Math.random() * 50}" x2="${Math.random() * 150}" y2="${Math.random() * 50}" stroke="#ddd" stroke-width="1"/>
      <line x1="${Math.random() * 150}" y1="${Math.random() * 50}" x2="${Math.random() * 150}" y2="${Math.random() * 50}" stroke="#ddd" stroke-width="1"/>
      <line x1="${Math.random() * 150}" y1="${Math.random() * 50}" x2="${Math.random() * 150}" y2="${Math.random() * 50}" stroke="#ddd" stroke-width="1"/>
      <text x="75" y="35" font-size="22" font-family="Arial, sans-serif" font-weight="bold" fill="${textColor}" text-anchor="middle">${text}</text>
    </svg>
  `.trim();

  return { svg, answer: answer.toString() };
}

function generateSliderTarget(): number {
  return 20 + Math.floor(Math.random() * 60); // 20–80%
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "slider") {
    try {
      const target = generateSliderTarget();
      const cookieStore = await cookies();
      cookieStore.set("captcha", await signSliderAnswer(target), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 5,
        path: "/",
      });
      return NextResponse.json(
        { target },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    } catch (error) {
      console.error("Slider captcha generation error:", error);
      return NextResponse.json({ error: "Failed to generate slider" }, { status: 500 });
    }
  }

  try {
    const { svg, answer } = generateMathCaptcha();

    const cookieStore = await cookies();
    cookieStore.set("captcha", await signMathAnswer(answer), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 5,
      path: "/",
    });

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Captcha generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate captcha" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { captcha, type = "math", turnstileToken } = body as {
      captcha?: string;
      type?: CaptchaType;
      turnstileToken?: string;
    };

    if (type === "turnstile" || type === "recaptcha" || type === "hcaptcha") {
      const result = await verifyCaptcha(type, turnstileToken, undefined);
      return NextResponse.json(result);
    }

    if (type === "slider") {
      const cookieStore = await cookies();
      const storedCaptcha = cookieStore.get("captcha")?.value;
      const result = await verifyCaptcha("slider", captcha, storedCaptcha);
      if (result.valid) {
        cookieStore.delete("captcha");
      }
      return NextResponse.json(result);
    }

    const cookieStore = await cookies();
    const storedCaptcha = cookieStore.get("captcha")?.value;

    const result = await verifyCaptcha("math", captcha, storedCaptcha);

    if (result.valid) {
      cookieStore.delete("captcha");
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, message: "验证失败" },
      { status: 500 }
    );
  }
}
