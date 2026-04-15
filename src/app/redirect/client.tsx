"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MotionPage } from "@/components/motion";
import { ExternalLink, ShieldAlert, ArrowLeft, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface RedirectClientProps {
  url?: string;
  redirectEnabled: boolean;
  countdown: number;
  whitelist: string[];
  title: string | null;
  description: string | null;
  disclaimer: string | null;
}

function isWhitelistedDomain(hostname: string, whitelist: string[]): boolean {
  const h = hostname.toLowerCase();
  for (const domain of whitelist) {
    const d = domain.toLowerCase();
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

export function RedirectClient({
  url,
  redirectEnabled,
  countdown: countdownSeconds,
  whitelist,
  title,
  description,
  disclaimer,
}: RedirectClientProps) {
  const decodedUrl = url ? decodeURIComponent(url) : null;

  const isValidUrl = useCallback((u: string) => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, []);

  const targetHost = decodedUrl && isValidUrl(decodedUrl) ? new URL(decodedUrl).hostname : null;

  const shouldSkip = useMemo(() => {
    if (!decodedUrl || !isValidUrl(decodedUrl)) return false;
    if (!redirectEnabled) return true;
    if (targetHost && whitelist.length > 0 && isWhitelistedDomain(targetHost, whitelist)) return true;
    return false;
  }, [decodedUrl, isValidUrl, redirectEnabled, targetHost, whitelist]);

  const [countdown, setCountdown] = useState(countdownSeconds);
  const [autoRedirect, setAutoRedirect] = useState(true);

  useEffect(() => {
    if (shouldSkip && decodedUrl) {
      window.location.replace(decodedUrl);
    }
  }, [shouldSkip, decodedUrl]);

  useEffect(() => {
    if (!decodedUrl || !isValidUrl(decodedUrl) || !autoRedirect || shouldSkip) return;
    if (countdown <= 0) {
      window.location.href = decodedUrl;
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, decodedUrl, isValidUrl, autoRedirect, shouldSkip]);

  const handleStop = () => setAutoRedirect(false);

  const handleGo = () => {
    if (decodedUrl && isValidUrl(decodedUrl)) {
      window.location.href = decodedUrl;
    }
  };

  if (shouldSkip) {
    return (
      <div className="container max-w-lg py-20">
        <div className="flex items-center justify-center h-[200px] text-muted-foreground">正在跳转…</div>
      </div>
    );
  }

  if (!decodedUrl || !isValidUrl(decodedUrl)) {
    return (
      <div className="container max-w-lg py-20">
        <MotionPage>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <ShieldAlert className="h-12 w-12 text-destructive" />
              <h1 className="text-xl font-bold">无效的链接</h1>
              <p className="text-sm text-muted-foreground">提供的链接无效或格式不正确。</p>
              <Button asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回首页
                </Link>
              </Button>
            </CardContent>
          </Card>
        </MotionPage>
      </div>
    );
  }

  const displayTitle = title || "即将离开本站";
  const displayDesc = description || "你即将访问一个外部网站，请确认该链接的安全性。";
  const displayDisclaimer = disclaimer || "本站对外部链接的内容不承担任何责任";

  return (
    <div className="container max-w-lg py-20">
      <MotionPage>
        <Card>
          <CardContent className="flex flex-col items-center gap-5 p-6 sm:p-8 text-center">
            <div className="rounded-full bg-amber-500/10 p-3">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold">{displayTitle}</h1>
              <p className="text-sm text-muted-foreground">{displayDesc}</p>
            </div>

            <div className="w-full rounded-lg bg-muted p-3 text-left">
              <p className="text-[10px] text-muted-foreground mb-1">目标地址</p>
              <p className="text-xs font-mono break-all text-foreground/80 leading-relaxed">{decodedUrl}</p>
              {targetHost && (
                <div className="mt-2 flex items-center gap-1.5">
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{targetHost}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {autoRedirect ? (
                <span>
                  <span className="font-bold tabular-nums text-foreground">{countdown}</span> 秒后自动跳转
                </span>
              ) : (
                <span>自动跳转已取消</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回本站
                </Link>
              </Button>
              {autoRedirect ? (
                <Button variant="secondary" className="flex-1" onClick={handleStop}>
                  取消自动跳转
                </Button>
              ) : (
                <Button className="flex-1 gap-2" onClick={handleGo}>
                  <ExternalLink className="h-4 w-4" />
                  继续访问
                </Button>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground/60">{displayDisclaimer}</p>

            {autoRedirect && (
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full bg-primary rounded-full transition-all duration-1000 ease-linear")}
                  style={{ width: `${((countdownSeconds - countdown) / countdownSeconds) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </MotionPage>
    </div>
  );
}
