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

function generateSliderSvg(target: number): string {
  const W = 300;
  const H = 40;
  const targetX = (target / 100) * (W - 40) + 20;

  const r = () => Math.random();
  const ri = (min: number, max: number) => Math.floor(r() * (max - min) + min);

  const noiseBg = Array.from({ length: ri(25, 40) }, () => {
    const x = ri(0, W);
    const y = ri(0, H);
    const gray = ri(200, 240);
    const radius = r() * 3 + 1;
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="rgb(${gray},${gray},${gray})" opacity="${(r() * 0.4 + 0.2).toFixed(2)}"/>`;
  }).join("");

  const noiseLines = Array.from({ length: ri(4, 8) }, () => {
    const x1 = ri(0, W), y1 = ri(0, H), x2 = ri(0, W), y2 = ri(0, H);
    const gray = ri(180, 220);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgb(${gray},${gray},${gray})" stroke-width="${(r() * 1.5 + 0.5).toFixed(1)}" opacity="${(r() * 0.3 + 0.15).toFixed(2)}"/>`;
  }).join("");

  const decoyCount = ri(2, 5);
  const decoys = Array.from({ length: decoyCount }, () => {
    let dx = ri(10, W - 10);
    while (Math.abs(dx - targetX) < 30) dx = ri(10, W - 10);
    const gray = ri(190, 215);
    const w = r() * 1.5 + 0.5;
    return `<line x1="${dx}" y1="${ri(2, 10)}" x2="${dx}" y2="${ri(H - 10, H - 2)}" stroke="rgb(${gray},${gray},${gray})" stroke-width="${w.toFixed(1)}" opacity="${(r() * 0.25 + 0.15).toFixed(2)}"/>`;
  }).join("");

  const jitter = r() * 2 - 1;
  const markerX = targetX + jitter;
  const colors = ["#6366f1", "#3b82f6", "#8b5cf6", "#0ea5e9", "#7c3aed"];
  const markerColor = colors[ri(0, colors.length)];

  const marker = `
    <line x1="${markerX}" y1="3" x2="${markerX}" y2="${H - 3}" stroke="${markerColor}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
    <polygon points="${markerX - 5},3 ${markerX + 5},3 ${markerX},10" fill="${markerColor}" opacity="0.65"/>
    <polygon points="${markerX - 5},${H - 3} ${markerX + 5},${H - 3} ${markerX},${H - 10}" fill="${markerColor}" opacity="0.65"/>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="20" fill="#f3f4f6"/>
  ${noiseBg}${noiseLines}${decoys}${marker}
</svg>`;
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
      return new NextResponse(generateSliderSvg(target), {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
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
    const { captcha, type = "math", turnstileToken, consume } = body as {
      captcha?: string;
      type?: CaptchaType;
      turnstileToken?: string;
      consume?: boolean;
    };

    if (type === "turnstile" || type === "recaptcha" || type === "hcaptcha") {
      const result = await verifyCaptcha(type, turnstileToken, undefined);
      return NextResponse.json(result);
    }

    if (type === "slider") {
      const cookieStore = await cookies();
      const storedCaptcha = cookieStore.get("captcha")?.value;
      const result = await verifyCaptcha("slider", captcha, storedCaptcha);
      if (result.valid && consume !== false) {
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
