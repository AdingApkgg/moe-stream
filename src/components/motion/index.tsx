"use client";

import { type CSSProperties, type ReactNode, Children, isValidElement, cloneElement } from "react";
import { m, LazyMotion, domAnimation, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import ReactCountUp from "react-countup";
import { cn } from "@/lib/utils";
import { useAnimationConfig } from "@/hooks/use-animation-config";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// ============================================================================
// 向后兼容：re-export hook
// ============================================================================
export { useIsMounted };

// ============================================================================
// MotionProvider — LazyMotion 容器，启用按需加载动画特性
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
// PageTransition — 路由切换淡入淡出
// 说明：这是全局唯一使用 AnimatePresence 的场景，跨路由需要 React 中间态
// ============================================================================

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const config = useAnimationConfig();

  // 后台使用 fixed 全屏布局，无需页面过渡；用稳定 key 避免重挂载导致闪烁
  const transitionKey = pathname.startsWith("/dashboard") ? "/dashboard" : pathname;

  if (!config.enabled || !config.pageTransition) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <m.div
        key={transitionKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: config.duration.fast, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

// ============================================================================
// MotionPage — 页面入场动画（纯 CSS 实现，零运行时开销）
// ============================================================================

interface MotionPageProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
}

const DIRECTION_CLASS: Record<NonNullable<MotionPageProps["direction"]>, string> = {
  up: "slide-in-from-bottom-4",
  down: "slide-in-from-top-4",
  left: "slide-in-from-right-4",
  right: "slide-in-from-left-4",
  none: "",
};

export function MotionPage({ children, className, direction = "up" }: MotionPageProps) {
  const config = useAnimationConfig();

  if (!config.enabled || !config.pageTransition || direction === "none") {
    return <div className={className}>{children}</div>;
  }

  const durationMs = Math.round(config.duration.normal * 1000);
  const slideClass = DIRECTION_CLASS[direction];

  return (
    <div
      className={cn("animate-in fade-in", slideClass, className)}
      style={{
        animationDuration: `${durationMs}ms`,
        animationFillMode: "both",
        animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// MotionList / MotionItem — 列表交错入场（纯 CSS stagger）
// 父容器注入 --stagger-delay 与 --stagger-duration，子项按索引自增延迟
// ============================================================================

interface MotionListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function MotionList({ children, className, staggerDelay }: MotionListProps) {
  const config = useAnimationConfig();

  if (!config.enabled || !config.stagger) {
    return <div className={className}>{children}</div>;
  }

  const delay = staggerDelay ?? config.staggerDelay;
  const delayMs = Math.round(delay * 1000);
  const durationMs = Math.round(config.duration.normal * 1000);

  const items = Children.toArray(children).map((child, index) => {
    if (!isValidElement<{ style?: CSSProperties }>(child)) return child;
    const prevStyle = child.props.style ?? {};
    return cloneElement(child, {
      style: {
        ...prevStyle,
        ["--stagger-index" as string]: index,
      } as CSSProperties,
    });
  });

  return (
    <div
      className={className}
      style={
        {
          ["--stagger-delay" as string]: `${delayMs}ms`,
          ["--stagger-duration" as string]: `${durationMs}ms`,
        } as CSSProperties
      }
    >
      {items}
    </div>
  );
}

interface MotionItemProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function MotionItem({ children, className, style }: MotionItemProps) {
  const config = useAnimationConfig();

  if (!config.enabled || !config.stagger) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  // 索引由父组件 MotionList 通过 cloneElement 注入到 style 中
  const index = (style as (CSSProperties & { ["--stagger-index"]?: number }) | undefined)?.["--stagger-index"] ?? 0;

  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-2", className)}
      style={{
        ...style,
        animationDuration: "var(--stagger-duration, 300ms)",
        animationDelay: `calc(var(--stagger-delay, 40ms) * ${index})`,
        animationFillMode: "both",
        animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// CountUp — 数字滚动动画（基于 react-countup，非 framer-motion）
// ============================================================================

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
// 导出 framer-motion 基元（供少数需要精细控制的场景，如 file-uploader）
// ============================================================================

export { m, AnimatePresence };
