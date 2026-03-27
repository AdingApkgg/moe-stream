"use client";

import { type ReactNode, useId } from "react";
import {
  m,
  LazyMotion,
  domAnimation,
  AnimatePresence,
  type Variants,
  type HTMLMotionProps,
  useReducedMotion,
} from "framer-motion";
import { usePathname } from "next/navigation";
import { useIsMounted as useIsMountedFn } from "usehooks-ts";
import ReactCountUp from "react-countup";
import { cn } from "@/lib/utils";
import { useAnimationConfig, type AnimationConfig } from "@/hooks/use-animation-config";

/**
 * 客户端挂载检测 Hook
 */
export function useIsMounted(): boolean {
  const isMountedFn = useIsMountedFn();
  return isMountedFn();
}

// ============================================================================
// 缓动曲线
// ============================================================================

export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
export const EASE_IN_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ============================================================================
// 变体工厂（config-aware）
// ============================================================================

export function createFadeIn(config: AnimationConfig): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: config.duration.normal, ease: EASE_OUT } },
    exit: { opacity: 0, transition: { duration: config.duration.fast } },
  };
}

export function createSlideUp(config: AnimationConfig): Variants {
  return {
    hidden: { opacity: 0, y: config.displacement.medium },
    visible: { opacity: 1, y: 0, transition: { duration: config.duration.normal, ease: EASE_OUT_EXPO } },
    exit: {
      opacity: 0,
      y: config.displacement.small,
      transition: { duration: config.duration.fast, ease: EASE_IN_OUT },
    },
  };
}

export function createSlideDown(config: AnimationConfig): Variants {
  return {
    hidden: { opacity: 0, y: -config.displacement.medium },
    visible: { opacity: 1, y: 0, transition: { duration: config.duration.normal, ease: EASE_OUT_EXPO } },
    exit: {
      opacity: 0,
      y: -config.displacement.small,
      transition: { duration: config.duration.fast, ease: EASE_IN_OUT },
    },
  };
}

export function createScaleIn(config: AnimationConfig): Variants {
  return {
    hidden: { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1, transition: { duration: config.duration.normal, ease: EASE_OUT_EXPO } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: config.duration.fast } },
  };
}

export function createStaggerContainer(config: AnimationConfig): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: config.staggerDelay,
        delayChildren: config.staggerDelay * 1.5,
      },
    },
  };
}

export function createStaggerItem(config: AnimationConfig): Variants {
  return {
    hidden: { opacity: 0, y: config.displacement.small },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: config.duration.normal, ease: EASE_OUT_EXPO },
    },
  };
}

// 静态变体（向后兼容）
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15, ease: EASE_IN_OUT } },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: EASE_IN_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

export const springScale: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 25, mass: 0.8 },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
};

export const cardHover: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -3,
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
  tap: {
    scale: 0.98,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

export const buttonTap = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 500, damping: 25, mass: 0.5 },
};

// ============================================================================
// MotionProvider
// ============================================================================

interface MotionProviderProps {
  children: ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

// ============================================================================
// PageTransition — 路由切换淡入淡出（消除白屏闪烁）
// ============================================================================

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const config = useAnimationConfig();

  if (!config.enabled || !config.pageTransition) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <m.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: config.duration.fast, ease: EASE_OUT }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

// ============================================================================
// MotionPage — 页面过渡（替代 PageWrapper + FadeIn）
// ============================================================================

interface MotionPageProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}

export function MotionPage({ children, className, direction = "up" }: MotionPageProps) {
  const config = useAnimationConfig();
  const mounted = useIsMounted();

  if (!mounted || !config.enabled || !config.pageTransition) {
    return <div className={className}>{children}</div>;
  }

  if (direction === "none") {
    return <div className={className}>{children}</div>;
  }

  const directionMap = {
    up: { y: config.displacement.medium },
    down: { y: -config.displacement.medium },
    left: { x: config.displacement.medium },
    right: { x: -config.displacement.medium },
  };

  return (
    <m.div
      className={className}
      initial={directionMap[direction]}
      animate={{ x: 0, y: 0 }}
      transition={{ duration: config.duration.normal, ease: EASE_OUT_EXPO }}
    >
      {children}
    </m.div>
  );
}

// ============================================================================
// MotionList / MotionItem — 列表交错动画
// ============================================================================

interface MotionListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function MotionList({ children, className, staggerDelay }: MotionListProps) {
  const config = useAnimationConfig();
  const mounted = useIsMounted();

  if (!mounted || !config.enabled || !config.stagger) {
    return <div className={className}>{children}</div>;
  }

  const delay = staggerDelay ?? config.staggerDelay;

  return (
    <m.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
            delayChildren: delay * 1.5,
          },
        },
      }}
    >
      {children}
    </m.div>
  );
}

interface MotionItemProps {
  children: ReactNode;
  className?: string;
}

export function MotionItem({ children, className }: MotionItemProps) {
  const config = useAnimationConfig();

  if (!config.enabled || !config.stagger) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: config.displacement.small },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: config.duration.normal, ease: EASE_OUT_EXPO },
        },
      }}
    >
      {children}
    </m.div>
  );
}

// ============================================================================
// MotionCard — 卡片悬停动画
// ============================================================================

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  scale?: number;
  yOffset?: number;
}

export function MotionCard({ children, className, scale = 1.02, yOffset = -3 }: MotionCardProps) {
  const config = useAnimationConfig();

  if (!config.enabled || !config.hover) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={{
        rest: { scale: 1, y: 0 },
        hover: {
          scale,
          y: yOffset,
          transition: { type: "spring", ...config.spring },
        },
        tap: {
          scale: 0.98,
          transition: { type: "spring", stiffness: 500, damping: 30 },
        },
      }}
    >
      {children}
    </m.div>
  );
}

// ============================================================================
// MotionTabContent — Tab 切换动画
// ============================================================================

interface MotionTabContentProps {
  children: ReactNode;
  activeKey: string;
  className?: string;
}

export function MotionTabContent({ children, activeKey, className }: MotionTabContentProps) {
  const config = useAnimationConfig();
  const id = useId();

  if (!config.enabled || !config.tab) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={`${id}-${activeKey}`}
        className={className}
        initial={{ opacity: 0, y: config.displacement.small }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -config.displacement.small }}
        transition={{ duration: config.duration.fast, ease: EASE_OUT }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

// ============================================================================
// MotionDialog — 弹窗动画包装器
// ============================================================================

interface MotionDialogProps {
  children: ReactNode;
  className?: string;
  isOpen?: boolean;
}

export function MotionDialog({ children, className, isOpen }: MotionDialogProps) {
  const config = useAnimationConfig();

  if (!config.enabled || !config.dialog) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          className={className}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{
            type: "spring",
            stiffness: config.spring.stiffness,
            damping: config.spring.damping,
            mass: config.spring.mass,
          }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// 客户端安全的动画 div（通用）
// ============================================================================

interface ClientOnlyMotionProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
}

export function MotionDiv({ children, className, ...props }: ClientOnlyMotionProps) {
  const mounted = useIsMounted();
  const config = useAnimationConfig();

  if (!mounted || !config.enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div className={className} {...props}>
      {children}
    </m.div>
  );
}

// ============================================================================
// 纯 CSS 入场动画组件（SSR 安全，向后兼容）
// ============================================================================

const SLIDE_CLASSES: Record<string, string> = {
  up: "slide-in-from-bottom-4",
  down: "slide-in-from-top-4",
  left: "slide-in-from-right-4",
  right: "slide-in-from-left-4",
  none: "",
};

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export function FadeIn({ children, className, delay = 0, duration = 0.4, direction = "up" }: FadeInProps) {
  const slideClass = SLIDE_CLASSES[direction] || "";

  return (
    <div
      className={cn("animate-in fade-in", slideClass, className)}
      style={{
        animationDuration: `${Math.round(duration * 1000)}ms`,
        animationDelay: delay > 0 ? `${Math.round(delay * 1000)}ms` : undefined,
        animationFillMode: "both",
        animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </div>
  );
}

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div
      className={cn("animate-in fade-in", className)}
      style={{
        animationDuration: "300ms",
        animationFillMode: "both",
        animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Framer Motion 高级动画组件
// ============================================================================

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerList({ children, className, staggerDelay = 0.04 }: StaggerListProps) {
  const mounted = useIsMounted();
  const shouldReduce = useReducedMotion();

  if (!mounted) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: shouldReduce ? 0 : staggerDelay,
            delayChildren: shouldReduce ? 0 : 0.06,
          },
        },
      }}
    >
      {children}
    </m.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const shouldReduce = useReducedMotion();
  return (
    <m.div className={className} variants={shouldReduce ? fadeIn : staggerItem}>
      {children}
    </m.div>
  );
}

interface ScaleOnHoverProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function ScaleOnHover({ children, className, scale = 1.03 }: ScaleOnHoverProps) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 25, mass: 0.5 }}
    >
      {children}
    </m.div>
  );
}

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (value: number) => string;
}

export function CountUp({
  value,
  duration = 0.8,
  className,
  formatter = (v) => Math.round(v).toString(),
}: CountUpProps) {
  const mounted = useIsMounted();
  const shouldReduce = useReducedMotion();

  if (!mounted || shouldReduce) {
    return <span className={className}>{formatter(value)}</span>;
  }

  return (
    <ReactCountUp
      end={value}
      duration={duration}
      formattingFn={(v) => formatter(v)}
      className={className}
      preserveValue
    />
  );
}

// ============================================================================
// 导出
// ============================================================================

export { m, AnimatePresence, useReducedMotion };
export type { Variants, HTMLMotionProps };
