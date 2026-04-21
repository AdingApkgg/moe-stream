/**
 * Telegram Mini App (TMA) 适配工具
 *
 * 仅包含最小类型和运行时探测，不依赖官方 SDK 的 npm 包（通过 <script> 全局注入）。
 * 官方文档：https://core.telegram.org/bots/webapps
 */

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    setText(text: string): void;
    setParams(params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  ready(): void;
  expand(): void;
  close(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  setHeaderColor(color: string | `#${string}`): void;
  setBackgroundColor(color: string | `#${string}`): void;
  onEvent(event: string, cb: (...args: unknown[]) => void): void;
  offEvent(event: string, cb: (...args: unknown[]) => void): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * 判断当前是否在 Telegram Mini App 环境内。
 * 仅依赖 window.Telegram.WebApp.initData 非空，比单纯检查 SDK 存在更可靠
 * （PC 浏览器打开也会注入空的 WebApp 对象）。
 *
 * 必须在客户端调用，SSR 下总是返回 false。
 */
export function isTmaEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return false;
  // initData 为空串时也视为非 TMA（避免桌面端 Telegram 的误判）
  return typeof webApp.initData === "string" && webApp.initData.length > 0;
}

/**
 * 获取 Telegram WebApp 实例，未加载则返回 null。
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * 统一的外链打开方法。
 * - TMA 环境下 telegram.me/t.me 走 openTelegramLink，其他走 openLink（默认在外部浏览器打开）
 * - 非 TMA 环境走 window.open
 *
 * 站内相对路径不应调用此函数，应使用 next/link 或 router.push。
 */
export function openExternalLink(url: string): void {
  if (!url) return;
  const tg = getTelegramWebApp();
  if (tg && isTmaEnvironment()) {
    try {
      if (/^https?:\/\/(t\.me|telegram\.me|telegram\.dog)\//i.test(url)) {
        tg.openTelegramLink(url);
      } else {
        tg.openLink(url);
      }
      return;
    } catch {
      // fallthrough
    }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
