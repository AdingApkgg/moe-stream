"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { useSiteConfig } from "@/contexts/site-config";

export type AnimationPreset = "minimal" | "standard" | "rich";

export interface AnimationConfig {
  /** 总开关（themeAnimations） */
  enabled: boolean;
  /** 速度倍率（影响 duration） */
  speed: number;
  /** 各类别开关 */
  pageTransition: boolean;
  stagger: boolean;
  hover: boolean;
  dialog: boolean;
  tab: boolean;
  /** 预设方案 */
  preset: AnimationPreset;
  /** 经速度倍率计算后的时长（秒） */
  duration: { fast: number; normal: number; slow: number };
  /** 交错延迟（秒） */
  staggerDelay: number;
  /** 位移量（px） */
  displacement: { small: number; medium: number; large: number };
  /** 弹性配置 */
  spring: { stiffness: number; damping: number; mass: number };
}

const PRESET_PARAMS: Record<
  AnimationPreset,
  {
    durationBase: { fast: number; normal: number; slow: number };
    staggerDelay: number;
    displacement: { small: number; medium: number; large: number };
    spring: { stiffness: number; damping: number; mass: number };
  }
> = {
  minimal: {
    durationBase: { fast: 0.12, normal: 0.2, slow: 0.3 },
    staggerDelay: 0.02,
    displacement: { small: 4, medium: 8, large: 12 },
    spring: { stiffness: 500, damping: 35, mass: 0.5 },
  },
  standard: {
    durationBase: { fast: 0.15, normal: 0.3, slow: 0.45 },
    staggerDelay: 0.04,
    displacement: { small: 8, medium: 16, large: 24 },
    spring: { stiffness: 400, damping: 28, mass: 0.8 },
  },
  rich: {
    durationBase: { fast: 0.2, normal: 0.4, slow: 0.6 },
    staggerDelay: 0.06,
    displacement: { small: 12, medium: 20, large: 32 },
    spring: { stiffness: 300, damping: 22, mass: 1.0 },
  },
};

const DISABLED_CONFIG: AnimationConfig = {
  enabled: false,
  speed: 1,
  pageTransition: false,
  stagger: false,
  hover: false,
  dialog: false,
  tab: false,
  preset: "standard",
  duration: { fast: 0, normal: 0, slow: 0 },
  staggerDelay: 0,
  displacement: { small: 0, medium: 0, large: 0 },
  spring: { stiffness: 500, damping: 35, mass: 0.5 },
};

export function useAnimationConfig(): AnimationConfig {
  const siteConfig = useSiteConfig();
  const prefersReduced = useReducedMotion();

  return useMemo(() => {
    const globalEnabled = siteConfig?.themeAnimations ?? true;

    if (!globalEnabled || prefersReduced) {
      return DISABLED_CONFIG;
    }

    const speed = siteConfig?.animationSpeed ?? 1.0;
    const preset = (siteConfig?.animationPreset ?? "standard") as AnimationPreset;
    const params = PRESET_PARAMS[preset] || PRESET_PARAMS.standard;

    const speedFactor = 1 / Math.max(0.1, speed);

    return {
      enabled: true,
      speed,
      pageTransition: siteConfig?.animationPageTransition ?? true,
      stagger: siteConfig?.animationStagger ?? true,
      hover: siteConfig?.animationHover ?? true,
      dialog: siteConfig?.animationDialog ?? true,
      tab: siteConfig?.animationTab ?? true,
      preset,
      duration: {
        fast: params.durationBase.fast * speedFactor,
        normal: params.durationBase.normal * speedFactor,
        slow: params.durationBase.slow * speedFactor,
      },
      staggerDelay: params.staggerDelay * speedFactor,
      displacement: params.displacement,
      spring: params.spring,
    };
  }, [siteConfig, prefersReduced]);
}
