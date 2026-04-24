/**
 * 根据 SiteConfig 中的主题设置生成动态 CSS 变量覆盖，
 * 由服务端组件渲染为 <style> 标签，避免客户端 FOUC。
 */

interface ThemeConfig {
  themeHue: number;
  themeColorTemp: number;
  themeBorderRadius: number;
  themeGlassOpacity: number;
  themeAnimations: boolean;
  animationSpeed?: number;
}

const DEFAULTS: ThemeConfig = {
  themeHue: 350,
  themeColorTemp: 0,
  themeBorderRadius: 0.625,
  themeGlassOpacity: 0.7,
  themeAnimations: true,
  animationSpeed: 1.0,
};

function isDefault(config: ThemeConfig): boolean {
  return (
    config.themeHue === DEFAULTS.themeHue &&
    config.themeColorTemp === DEFAULTS.themeColorTemp &&
    config.themeBorderRadius === DEFAULTS.themeBorderRadius &&
    config.themeGlassOpacity === DEFAULTS.themeGlassOpacity &&
    config.themeAnimations === DEFAULTS.themeAnimations &&
    (config.animationSpeed ?? 1.0) === 1.0
  );
}

export function generateThemeCSS(config: Partial<ThemeConfig>): string {
  const resolved: ThemeConfig = {
    themeHue: config.themeHue ?? DEFAULTS.themeHue,
    themeColorTemp: config.themeColorTemp ?? DEFAULTS.themeColorTemp,
    themeBorderRadius: config.themeBorderRadius ?? DEFAULTS.themeBorderRadius,
    themeGlassOpacity: config.themeGlassOpacity ?? DEFAULTS.themeGlassOpacity,
    themeAnimations: config.themeAnimations ?? DEFAULTS.themeAnimations,
    animationSpeed: config.animationSpeed ?? DEFAULTS.animationSpeed,
  };

  if (isDefault(resolved)) return "";

  const {
    themeHue: h,
    themeColorTemp: temp,
    themeBorderRadius: r,
    themeGlassOpacity: glassOp,
    themeAnimations,
  } = resolved;

  const accentHue = (h + 45) % 360;

  // 色温：偏移中性表面色相，temp>0 偏暖(hue→50)，temp<0 偏冷(hue→220)
  let neutralHue = h;
  let neutralChromaLight = 0.005;
  let neutralChromaDark = 0.02;
  if (temp > 0) {
    const t = temp / 100;
    neutralHue = h + (50 - h) * t;
    neutralChromaLight = 0.005 + t * 0.012;
    neutralChromaDark = 0.02 + t * 0.01;
  } else if (temp < 0) {
    const t = -temp / 100;
    neutralHue = h + (220 - h) * t;
    neutralChromaLight = 0.005 + t * 0.012;
    neutralChromaDark = 0.02 + t * 0.01;
  }

  const nh = neutralHue.toFixed(1);
  const ncl = neutralChromaLight.toFixed(4);
  const ncd = neutralChromaDark.toFixed(4);

  const parts: string[] = [];

  parts.push(`:root {
  --radius: ${r}rem;
  --background: oklch(0.99 ${ncl} ${nh});
  --foreground: oklch(0.15 0.02 ${h});
  --card-foreground: oklch(0.15 0.02 ${h});
  --popover-foreground: oklch(0.15 0.02 ${h});
  --primary: oklch(0.55 0.24 ${h});
  --secondary: oklch(0.95 0.02 ${h});
  --secondary-foreground: oklch(0.25 0.05 ${h});
  --muted: oklch(0.96 0.01 ${h});
  --muted-foreground: oklch(0.5 0.03 ${h});
  --accent: oklch(0.92 0.05 ${accentHue});
  --accent-foreground: oklch(0.25 0.1 ${accentHue});
  --border: oklch(0.9 0.02 ${h});
  --input: oklch(0.92 0.02 ${h});
  --ring: oklch(0.55 0.24 ${h});
  --chart-1: oklch(0.55 0.24 ${h});
  --chart-2: oklch(0.65 0.22 ${accentHue});
  --chart-3: oklch(0.6 0.2 ${(h + 85) % 360});
  --chart-4: oklch(0.7 0.18 ${(h + 135) % 360});
  --chart-5: oklch(0.6 0.25 ${(h + 275) % 360});
  --sidebar: oklch(0.985 0.01 ${h});
  --sidebar-foreground: oklch(0.15 0.02 ${h});
  --sidebar-primary: oklch(0.55 0.24 ${h});
  --sidebar-accent: oklch(0.95 0.02 ${h});
  --sidebar-accent-foreground: oklch(0.25 0.05 ${h});
  --sidebar-border: oklch(0.9 0.02 ${h});
  --sidebar-ring: oklch(0.55 0.24 ${h});
}`);

  parts.push(`.dark {
  --background: oklch(0.13 ${ncd} ${nh});
  --foreground: oklch(0.95 0.01 ${h});
  --card: oklch(0.18 0.025 ${h});
  --card-foreground: oklch(0.95 0.01 ${h});
  --popover: oklch(0.18 0.025 ${h});
  --popover-foreground: oklch(0.95 0.01 ${h});
  --primary: oklch(0.7 0.2 ${h});
  --primary-foreground: oklch(0.13 0.02 ${h});
  --secondary: oklch(0.25 0.04 ${h});
  --secondary-foreground: oklch(0.9 0.01 ${h});
  --muted: oklch(0.25 0.03 ${h});
  --muted-foreground: oklch(0.65 0.03 ${h});
  --accent: oklch(0.35 0.1 ${accentHue});
  --accent-foreground: oklch(0.92 0.05 ${accentHue});
  --ring: oklch(0.7 0.2 ${h});
  --chart-1: oklch(0.7 0.2 ${h});
  --chart-2: oklch(0.7 0.2 ${accentHue});
  --chart-3: oklch(0.65 0.18 ${(h + 85) % 360});
  --chart-4: oklch(0.75 0.15 ${(h + 135) % 360});
  --chart-5: oklch(0.65 0.22 ${(h + 275) % 360});
  --sidebar: oklch(0.16 0.025 ${h});
  --sidebar-foreground: oklch(0.95 0.01 ${h});
  --sidebar-primary: oklch(0.7 0.2 ${h});
  --sidebar-primary-foreground: oklch(0.13 0.02 ${h});
  --sidebar-accent: oklch(0.25 0.04 ${h});
  --sidebar-accent-foreground: oklch(0.9 0.01 ${h});
  --sidebar-ring: oklch(0.7 0.2 ${h});
}`);

  // 玻璃态透明度覆盖
  if (glassOp !== DEFAULTS.themeGlassOpacity) {
    const pct = Math.round(glassOp * 100);
    parts.push(`.glass { background: oklch(1 0 0 / ${pct}%); }
.dark .glass { background: oklch(0.18 0.025 ${h} / ${pct}%); }
.glass-card { background: oklch(1 0 0 / ${Math.round(glassOp * 71)}%); }
.dark .glass-card { background: oklch(0.18 0.025 ${h} / ${Math.round(glassOp * 71)}%); }`);
  }

  // 动画速度与开关
  if (!themeAnimations) {
    parts.push(`*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}`);
  } else {
    const speed = resolved.animationSpeed ?? 1.0;
    if (speed !== 1.0) {
      const factor = 1 / Math.max(0.1, speed);
      parts.push(`:root { --animation-speed: ${factor.toFixed(3)}; }`);
    }
  }

  return parts.join("\n");
}
