"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useSiteConfig } from "@/contexts/site-config";
import { trpc } from "@/lib/trpc";
import {
  type AdRuntimeContext,
  type AdDevice,
  type AdLoginState,
  detectDevice,
  pickWeightedRandomAds,
  parseSponsorAds,
} from "@/lib/ads";

/**
 * 站点配置：优先 Context（SSR），Context 为空时用 tRPC 拉取（生产环境兜底）。
 * 供 useAds 与 AdGate 等广告相关组件使用。
 */
export function useSiteConfigForAds() {
  const fromContext = useSiteConfig();
  const { data: fromApi } = trpc.site.getConfig.useQuery(undefined, {
    enabled: fromContext == null,
    staleTime: 5 * 60 * 1000,
  });
  return fromContext ?? fromApi ?? null;
}

function useDevice(): AdDevice | undefined {
  const [device, setDevice] = useState<AdDevice | undefined>(undefined);
  useEffect(() => {
    // 客户端环境探测，仅挂载后跑一次，set 后即稳定，不会触发循环渲染
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(detectDevice());
  }, []);
  return device;
}

function useLocale(): string | undefined {
  const [locale, setLocale] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    // 同 useDevice：仅挂载后读取一次，不会循环
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(navigator.language);
  }, []);
  return locale;
}

/**
 * 构造运行上下文（设备、登录态、语言、自定义分类）。
 * @param category 当前页面的内容分类（如 video/image/game），用于定向匹配
 */
export function useAdRuntimeContext(category?: string): AdRuntimeContext {
  const { data: session, status } = useSession();
  const device = useDevice();
  const locale = useLocale();

  return useMemo<AdRuntimeContext>(() => {
    let loginState: AdLoginState | undefined;
    if (status !== "loading") {
      loginState = session?.user ? "user" : "guest";
    }
    return {
      device,
      loginState,
      locale,
      category,
    };
  }, [device, locale, status, session, category]);
}

/**
 * 获取可用广告列表和展示权限判断。
 * 优先从 SiteConfigContext（服务端预取、零延迟）读取；
 * 若生产环境 Context 为空则回退到 tRPC site.getConfig 拉取配置，保证广告可加载。
 */
export function useAds() {
  const { data: session, status } = useSession();
  const siteConfig = useSiteConfigForAds();

  const siteAdsOn = siteConfig?.adsEnabled === true;
  const userAllowsAds =
    status === "loading"
      ? true
      : session === null
        ? true
        : (session.user as { adsEnabled?: boolean })?.adsEnabled !== false;

  const showAds = siteAdsOn && userAllowsAds;

  const allAds = useMemo(() => parseSponsorAds(siteConfig?.sponsorAds), [siteConfig?.sponsorAds]);
  const enabledAds = useMemo(() => allAds.filter((a) => a.enabled), [allAds]);

  return { showAds, allAds, enabledAds, siteConfig };
}

/**
 * 按权重随机选取 N 条广告（客户端每次 mount 时重新选取）
 * 自动注入设备/登录状态/语言上下文，使定向投放生效。
 */
export function useRandomAds(count: number, seed?: string | number, slotPosition?: string, category?: string) {
  const { showAds, enabledAds } = useAds();
  const ctx = useAdRuntimeContext(category);

  const picked = useMemo(
    () => (showAds ? pickWeightedRandomAds(enabledAds, count, slotPosition, ctx) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAds, enabledAds, count, seed, slotPosition, ctx.device, ctx.loginState, ctx.locale, ctx.category],
  );

  return { ads: picked, showAds };
}
