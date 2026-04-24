"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  lazy,
  Suspense,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { useRouter } from "next/navigation";
import { useUIStore, type ContentMode } from "@/stores/app";
import { useSiteConfig } from "@/contexts/site-config";
import { Play, Gamepad2, ImageIcon, Loader2, Sparkles, Zap, Palette, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/use-sound";
import { DEFAULT_HOME_LAYOUT, LANDING_CARD_META, type LandingCardConfig, type LandingCardId } from "@/lib/home-layout";

const LandingScene = lazy(() => import("@/components/effects/landing-scene"));

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[LandingScene] 3D scene failed to render:", error, info);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const MODE_ROUTES: Record<ContentMode, string> = { video: "/video", image: "/image", game: "/game" };

interface CardStyle {
  borderIdle: string;
  borderHover: string;
  shadow: string;
  ring: string;
  iconBg: string;
  iconTint: string;
  iconShadow: string;
  icon: ReactNode;
  accent: ReactNode;
  hoverText: string;
  overlay: string;
}

const CARD_STYLE: Record<LandingCardId, CardStyle> = {
  video: {
    borderIdle: "border-purple-500/20 dark:border-purple-400/15",
    borderHover: "hover:border-purple-500/50 dark:hover:border-purple-400/40",
    shadow: "hover:shadow-[0_0_40px_-8px] hover:shadow-purple-500/25",
    ring: "focus-visible:ring-purple-500",
    iconBg: "bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-violet-500/20",
    iconTint: "text-purple-500 dark:text-purple-400",
    iconShadow: "group-hover:shadow-purple-500/30",
    icon: (
      <Play className="h-7 w-7 transition-transform duration-300 ease-out sm:h-10 sm:w-10 sm:group-hover:scale-110" />
    ),
    accent: (
      <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-purple-400 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 group-hover:-translate-y-1" />
    ),
    hoverText: "group-hover:text-purple-500 dark:group-hover:text-purple-400",
    overlay: "from-purple-500/5 via-transparent to-blue-500/5",
  },
  image: {
    borderIdle: "border-pink-500/20 dark:border-pink-400/15",
    borderHover: "hover:border-pink-500/50 dark:hover:border-pink-400/40",
    shadow: "hover:shadow-[0_0_40px_-8px] hover:shadow-pink-500/25",
    ring: "focus-visible:ring-pink-500",
    iconBg: "bg-gradient-to-br from-rose-500/20 via-pink-500/15 to-fuchsia-500/20",
    iconTint: "text-pink-500 dark:text-pink-400",
    iconShadow: "group-hover:shadow-pink-500/30",
    icon: (
      <ImageIcon className="h-7 w-7 transition-transform duration-300 ease-out sm:h-10 sm:w-10 sm:group-hover:scale-110" />
    ),
    accent: (
      <Palette className="absolute -top-2 -right-2 h-4 w-4 text-pink-400 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 group-hover:-translate-y-1" />
    ),
    hoverText: "group-hover:text-pink-500 dark:group-hover:text-pink-400",
    overlay: "from-pink-500/5 via-transparent to-rose-500/5",
  },
  game: {
    borderIdle: "border-emerald-500/20 dark:border-emerald-400/15",
    borderHover: "hover:border-emerald-500/50 dark:hover:border-emerald-400/40",
    shadow: "hover:shadow-[0_0_40px_-8px] hover:shadow-emerald-500/25",
    ring: "focus-visible:ring-emerald-500",
    iconBg: "bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-teal-500/20",
    iconTint: "text-emerald-500 dark:text-emerald-400",
    iconShadow: "group-hover:shadow-emerald-500/30",
    icon: (
      <Gamepad2 className="h-7 w-7 transition-transform duration-300 ease-out sm:h-10 sm:w-10 sm:group-hover:scale-110" />
    ),
    accent: (
      <Zap className="absolute -top-2 -right-2 h-4 w-4 text-emerald-400 opacity-0 transition-[opacity,transform] duration-300 ease-out group-hover:opacity-100 group-hover:-translate-y-1" />
    ),
    hoverText: "group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
    overlay: "from-emerald-500/5 via-transparent to-green-500/5",
  },
};

export default function LandingClient() {
  const router = useRouter();
  const contentMode = useUIStore((s) => s.contentMode);
  const isContentModeChosen = useUIStore((s) => s.isContentModeChosen);
  const chooseContentMode = useUIStore((s) => s.chooseContentMode);
  const { play } = useSound();
  const config = useSiteConfig();

  const layout = config?.homeLayout ?? DEFAULT_HOME_LAYOUT;

  const visibleCards: LandingCardConfig[] = useMemo(() => {
    return layout.landing.cards.filter((c) => {
      if (!c.enabled) return false;
      if (c.id === "video") return config?.sectionVideoEnabled !== false;
      if (c.id === "image") return config?.sectionImageEnabled !== false;
      if (c.id === "game") return config?.sectionGameEnabled !== false;
      return true;
    });
  }, [layout.landing.cards, config?.sectionVideoEnabled, config?.sectionImageEnabled, config?.sectionGameEnabled]);

  const enabledModes = useMemo(() => visibleCards.map((c) => c.id), [visibleCards]);

  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [hoveredMode, setHoveredMode] = useState<"video" | "image" | "game" | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mounted || enabledModes.length === 0) return;
    if (enabledModes.length === 1) {
      chooseContentMode(enabledModes[0]);
      router.replace(MODE_ROUTES[enabledModes[0]]);
      return;
    }
    if (isContentModeChosen) {
      const target = enabledModes.includes(contentMode) ? contentMode : enabledModes[0];
      router.replace(MODE_ROUTES[target]);
    }
  }, [mounted, isContentModeChosen, contentMode, router, enabledModes, chooseContentMode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  if (!mounted || isContentModeChosen || enabledModes.length <= 1) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleChoose = (mode: ContentMode) => {
    play("navigate");
    chooseContentMode(mode);
    router.replace(MODE_ROUTES[mode]);
  };

  const gridColsClass = visibleCards.length === 2 ? "sm:grid-cols-2 max-w-2xl mx-auto" : "sm:grid-cols-3";

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] items-center justify-center overflow-hidden px-4 py-6 pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] md:pb-6">
      <SceneErrorBoundary>
        <Suspense fallback={null}>
          <LandingScene hoveredMode={hoveredMode} mouse={mouseRef} />
        </Suspense>
      </SceneErrorBoundary>

      <div className="relative z-10 w-full max-w-4xl space-y-6 text-center sm:space-y-8">
        <div className="space-y-2 sm:space-y-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            <span className="text-gradient-acgn">{layout.landing.title || DEFAULT_HOME_LAYOUT.landing.title}</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base">
            {layout.landing.subtitle || DEFAULT_HOME_LAYOUT.landing.subtitle}
          </p>
        </div>

        <div className={cn("grid grid-cols-1 gap-3 sm:gap-5", gridColsClass)}>
          {visibleCards.map((card) => {
            const style = CARD_STYLE[card.id];
            const meta = LANDING_CARD_META[card.id];
            const title = card.title || meta.defaultTitle;
            const subtitle = card.subtitle || meta.defaultSubtitle;
            return (
              <button
                key={card.id}
                onClick={() => handleChoose(card.id)}
                onMouseEnter={() => setHoveredMode(card.id)}
                onMouseLeave={() => setHoveredMode(null)}
                className={cn(
                  "group relative flex flex-row items-center gap-4 rounded-2xl p-4",
                  "sm:flex-col sm:gap-5 sm:p-8 md:p-10",
                  "glass-card",
                  "border",
                  style.borderIdle,
                  style.borderHover,
                  style.shadow,
                  "transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:duration-500",
                  "active:scale-[0.98] sm:active:scale-100",
                  "sm:hover:-translate-y-2 sm:hover:scale-[1.02]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  style.ring,
                )}
              >
                <div
                  className={cn(
                    "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl",
                    "sm:h-20 sm:w-20 sm:rounded-2xl",
                    style.iconBg,
                    style.iconTint,
                    "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:group-hover:scale-110",
                    "sm:group-hover:shadow-[0_0_30px_-5px]",
                    style.iconShadow,
                  )}
                >
                  {style.icon}
                  {style.accent}
                </div>
                <div className="flex-1 space-y-0.5 text-left sm:flex-initial sm:space-y-1.5 sm:text-center">
                  <h2 className={cn("text-base font-semibold transition-colors sm:text-xl", style.hoverText)}>
                    {title}
                  </h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-active:translate-x-0.5 sm:hidden",
                  )}
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity duration-500 sm:group-hover:opacity-100",
                    style.overlay,
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
