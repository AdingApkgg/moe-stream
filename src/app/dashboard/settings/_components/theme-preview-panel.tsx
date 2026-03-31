"use client";

export function ThemePreviewPanel({
  hue,
  colorTemp,
  borderRadius,
  glassOpacity,
  animations,
}: {
  hue: number;
  colorTemp: number;
  borderRadius: number;
  glassOpacity: number;
  animations: boolean;
}) {
  const accentHue = (hue + 45) % 360;
  let neutralHue = hue;
  if (colorTemp > 0) neutralHue = hue + (50 - hue) * (colorTemp / 100);
  else if (colorTemp < 0) neutralHue = hue + (220 - hue) * (-colorTemp / 100);

  const p = `oklch(0.55 0.24 ${hue})`;
  const pDark = `oklch(0.7 0.2 ${hue})`;
  const bg = `oklch(0.99 0.005 ${neutralHue})`;
  const bgDark = `oklch(0.13 0.02 ${neutralHue})`;
  const cardDarkAlpha = (a: number) => `oklch(0.18 0.025 ${hue} / ${a}%)`;
  const mutedFg = `oklch(0.5 0.03 ${hue})`;
  const mutedFgDark = `oklch(0.65 0.03 ${hue})`;
  const accent = `oklch(0.92 0.05 ${accentHue})`;
  const border = `oklch(0.9 0.02 ${hue})`;
  const borderDark = `oklch(1 0 0 / 12%)`;
  const r = `${borderRadius}rem`;
  const rSm = `${Math.max(0, borderRadius - 0.25)}rem`;

  return (
    <div className="sticky top-6 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">实时预览</p>

      {/* Light mode preview */}
      <div
        className="overflow-hidden border shadow-sm"
        style={{ background: bg, borderRadius: r, borderColor: border }}
      >
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full" style={{ background: p }} />
            <span className="text-xs font-medium" style={{ color: `oklch(0.15 0.02 ${hue})` }}>
              浅色模式
            </span>
          </div>
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#eab308" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e" }} />
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex gap-2">
            <div
              className={`px-3 py-1.5 text-[10px] text-white font-medium ${animations ? "transition-all" : ""}`}
              style={{ background: p, borderRadius: rSm }}
            >
              主要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px] font-medium"
              style={{ background: accent, borderRadius: rSm, color: `oklch(0.25 0.1 ${accentHue})` }}
            >
              次要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px]"
              style={{ border: `1px solid ${border}`, borderRadius: rSm, color: mutedFg }}
            >
              描边按钮
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-7 px-2 flex items-center text-[10px]"
              style={{
                border: `1px solid ${border}`,
                borderRadius: rSm,
                color: mutedFg,
                background: `oklch(0.92 0.02 ${hue})`,
              }}
            >
              输入框...
            </div>
            <div className="h-4 w-8 rounded-full" style={{ background: p }} />
          </div>
          <div
            className="p-2.5"
            style={{
              background: `oklch(1 0 0 / ${Math.round(glassOpacity * 100)}%)`,
              borderRadius: rSm,
              border: `1px solid ${border}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="h-2 w-3/4 rounded-full mb-1.5"
              style={{ background: `oklch(0.15 0.02 ${hue})`, opacity: 0.7 }}
            />
            <div className="h-2 w-1/2 rounded-full" style={{ background: mutedFg, opacity: 0.4 }} />
          </div>
          <div className="flex gap-1.5">
            {[hue, accentHue, (hue + 85) % 360, (hue + 135) % 360].map((ch, i) => (
              <div
                key={i}
                className="flex-1 h-6 rounded-sm"
                style={{ background: `oklch(0.65 0.2 ${ch})`, borderRadius: rSm, opacity: 0.8 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Dark mode preview */}
      <div
        className="overflow-hidden border shadow-sm"
        style={{ background: bgDark, borderRadius: r, borderColor: borderDark }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${borderDark}` }}
        >
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full" style={{ background: pDark }} />
            <span className="text-xs font-medium" style={{ color: `oklch(0.95 0.01 ${hue})` }}>
              深色模式
            </span>
          </div>
          <div className="flex gap-1">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#eab308" }} />
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e" }} />
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="flex gap-2">
            <div
              className={`px-3 py-1.5 text-[10px] font-medium ${animations ? "transition-all" : ""}`}
              style={{ background: pDark, borderRadius: rSm, color: `oklch(0.13 0.02 ${hue})` }}
            >
              主要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px] font-medium"
              style={{
                background: `oklch(0.35 0.1 ${accentHue})`,
                borderRadius: rSm,
                color: `oklch(0.92 0.05 ${accentHue})`,
              }}
            >
              次要按钮
            </div>
            <div
              className="px-3 py-1.5 text-[10px]"
              style={{ border: `1px solid ${borderDark}`, borderRadius: rSm, color: mutedFgDark }}
            >
              描边按钮
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-7 px-2 flex items-center text-[10px]"
              style={{
                border: `1px solid ${borderDark}`,
                borderRadius: rSm,
                color: mutedFgDark,
                background: `oklch(1 0 0 / 15%)`,
              }}
            >
              输入框...
            </div>
            <div className="h-4 w-8 rounded-full" style={{ background: pDark }} />
          </div>
          <div
            className="p-2.5"
            style={{
              background: cardDarkAlpha(Math.round(glassOpacity * 100)),
              borderRadius: rSm,
              border: `1px solid ${borderDark}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="h-2 w-3/4 rounded-full mb-1.5"
              style={{ background: `oklch(0.95 0.01 ${hue})`, opacity: 0.7 }}
            />
            <div className="h-2 w-1/2 rounded-full" style={{ background: mutedFgDark, opacity: 0.4 }} />
          </div>
          <div className="flex gap-1.5">
            {[hue, accentHue, (hue + 85) % 360, (hue + 135) % 360].map((ch, i) => (
              <div
                key={i}
                className="flex-1 h-6 rounded-sm"
                style={{ background: `oklch(0.7 0.2 ${ch})`, borderRadius: rSm, opacity: 0.8 }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">保存后全站生效，刷新页面查看完整效果</p>
    </div>
  );
}
