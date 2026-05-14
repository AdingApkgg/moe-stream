"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CommentEditor, type CommentEditorRef } from "@/components/editor/comment-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, ArrowUpDown, User, LogIn } from "lucide-react";
import { toast, showPointsToast } from "@/lib/toast-with-sound";
import { GameCommentItem } from "./game-comment-item";
import { EmojiStickerPicker } from "./emoji-sticker-picker";
import { parseDeviceInfo, getHighEntropyDeviceInfo, mergeDeviceInfo, type DeviceInfo } from "@/lib/device-info";
import { useFingerprint } from "@/hooks/use-fingerprint";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useSiteConfig } from "@/contexts/site-config";
import { UnifiedCaptcha, type CaptchaType } from "@/components/ui/unified-captcha";

interface GameCommentSectionProps {
  gameId: string;
}

type SortType = "newest" | "oldest" | "popular";

export function GameCommentSection({ gameId }: GameCommentSectionProps) {
  const { data: session } = useSession();
  const siteConfig = useSiteConfig();
  const [sort, setSort] = useState<SortType>("newest");
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMounted = useIsMounted();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const { getVisitorId } = useFingerprint();

  const requireLogin = siteConfig?.requireLoginToComment ?? false;
  const turnstileSiteKey = siteConfig?.turnstileSiteKey;
  const recaptchaSiteKey = siteConfig?.recaptchaSiteKey;
  const hcaptchaSiteKey = siteConfig?.hcaptchaSiteKey;
  const rawCaptchaType = (siteConfig?.captchaComment as CaptchaType) || "none";
  const captchaType = (() => {
    if (rawCaptchaType === "turnstile" && !turnstileSiteKey) return "math" as CaptchaType;
    if (rawCaptchaType === "recaptcha" && !recaptchaSiteKey) return "math" as CaptchaType;
    if (rawCaptchaType === "hcaptcha" && !hcaptchaSiteKey) return "math" as CaptchaType;
    return rawCaptchaType;
  })();
  const isTokenCaptcha = captchaType === "turnstile" || captchaType === "recaptcha" || captchaType === "hcaptcha";
  const [captchaKey, setCaptchaKey] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");
  const [sliderValue, setSliderValue] = useState<number | null>(null);
  const editorRef = useRef<CommentEditorRef>(null);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken("");
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    editorRef.current?.insertText(text);
  }, []);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestWebsite, setGuestWebsite] = useState("");

  const utils = trpc.useUtils();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const init = async () => {
      const baseInfo = parseDeviceInfo(navigator.userAgent, {
        platform: navigator.platform || null,
        language: navigator.language || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        screen: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio || null,
      });
      const highEntropyInfo = await getHighEntropyDeviceInfo();
      const mergedInfo = mergeDeviceInfo(baseInfo, highEntropyInfo);
      setDeviceInfo(mergedInfo);
    };
    init();
  }, []);

  const { data: commentCount } = trpc.gameComment.getCount.useQuery({ gameId });

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.gameComment.list.useInfiniteQuery(
    { gameId, sort, limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const createMutation = trpc.gameComment.create.useMutation({
    onSuccess: (data) => {
      setNewComment("");
      utils.gameComment.list.invalidate({ gameId });
      utils.gameComment.getCount.invalidate({ gameId });
      toast.success("评论发表成功");
      showPointsToast(data?.pointsAwarded);
    },
    onError: (error) => {
      toast.error(error.message || "发表失败");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim() || isSubmitting) return;

    if (!session && !guestName.trim()) {
      toast.error("请填写昵称");
      return;
    }

    setIsSubmitting(true);

    if (captchaType !== "none") {
      try {
        let captchaBody: Record<string, unknown>;
        if (isTokenCaptcha) {
          captchaBody = { type: captchaType, turnstileToken };
        } else if (captchaType === "slider") {
          captchaBody = { type: "slider", captcha: String(sliderValue ?? 0) };
        } else {
          captchaBody = { type: "math", captcha: captchaValue };
        }
        const captchaRes = await fetch("/api/captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(captchaBody),
        });
        const captchaResult = await captchaRes.json();
        if (!captchaResult.valid) {
          toast.error(captchaResult.message || "验证失败");
          setCaptchaKey((k) => k + 1);
          setTurnstileToken("");
          setCaptchaValue("");
          setSliderValue(null);
          setIsSubmitting(false);
          return;
        }
      } catch {
        toast.error("验证失败");
        setIsSubmitting(false);
        return;
      }
    }

    let currentDeviceInfo = deviceInfo;
    if (!currentDeviceInfo || currentDeviceInfo.osVersion === "10.15.7") {
      const baseInfo = parseDeviceInfo(navigator.userAgent, {
        platform: navigator.platform || null,
        language: navigator.language || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        screen: `${window.screen.width}x${window.screen.height}`,
        pixelRatio: window.devicePixelRatio || null,
      });
      const highEntropyInfo = await getHighEntropyDeviceInfo();
      currentDeviceInfo = mergeDeviceInfo(baseInfo, highEntropyInfo);
      setDeviceInfo(currentDeviceInfo);
    }

    const visitorId = await getVisitorId().catch(() => undefined);

    createMutation.mutate({
      gameId,
      content: newComment.trim(),
      deviceInfo: currentDeviceInfo ? { ...currentDeviceInfo, visitorId } : undefined,
      ...(session
        ? {}
        : {
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim() || undefined,
            guestWebsite: guestWebsite.trim() || undefined,
          }),
    });

    setCaptchaKey((k) => k + 1);
    setTurnstileToken("");
    setCaptchaValue("");
    setSliderValue(null);
  }, [
    newComment,
    isSubmitting,
    createMutation,
    gameId,
    deviceInfo,
    session,
    guestName,
    guestEmail,
    guestWebsite,
    captchaType,
    isTokenCaptcha,
    turnstileToken,
    captchaValue,
    sliderValue,
    getVisitorId,
  ]);

  const comments = data?.pages.flatMap((page) => page.comments) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="text-lg font-semibold">{commentCount !== undefined ? `${commentCount} 条评论` : "评论"}</h3>
        </div>
        {isMounted ? (
          <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
            <SelectTrigger className="w-32">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">最新</SelectItem>
              <SelectItem value="oldest">最早</SelectItem>
              <SelectItem value="popular">最热</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Skeleton className="h-9 w-32" />
        )}
      </div>

      {isMounted && requireLogin && !session ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground">
          <LogIn className="h-4 w-4" />
          <span>
            请
            <a href="/login" className="text-primary underline underline-offset-4 mx-0.5">
              登录
            </a>
            后发表评论
          </span>
        </div>
      ) : (
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {!isMounted ? (
              <AvatarFallback>U</AvatarFallback>
            ) : session ? (
              <>
                <AvatarImage src={session.user?.image || undefined} />
                <AvatarFallback>{(session.user?.name?.trim() || "").charAt(0).toUpperCase() || "U"}</AvatarFallback>
              </>
            ) : (
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 space-y-3">
            {isMounted && !session && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="game-guest-name" className="text-xs">
                    昵称 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="game-guest-name"
                    placeholder="必填"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={50}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="game-guest-email" className="text-xs">
                    邮箱
                  </Label>
                  <Input
                    id="game-guest-email"
                    type="email"
                    placeholder="可选，用于显示头像"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="game-guest-website" className="text-xs">
                    网址
                  </Label>
                  <Input
                    id="game-guest-website"
                    type="url"
                    placeholder="可选，https://..."
                    value={guestWebsite}
                    onChange={(e) => setGuestWebsite(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            )}
            <CommentEditor
              ref={editorRef}
              value={newComment}
              onChange={setNewComment}
              placeholder="添加评论..."
              maxLength={2000}
              minHeight="80px"
              disableMention={!session}
            />
            {captchaType !== "none" && (
              <UnifiedCaptcha
                type={captchaType}
                turnstileSiteKey={turnstileSiteKey}
                recaptchaSiteKey={recaptchaSiteKey}
                hcaptchaSiteKey={hcaptchaSiteKey}
                mathValue={captchaValue}
                onMathChange={setCaptchaValue}
                onTurnstileVerify={setTurnstileToken}
                onTurnstileExpire={handleTurnstileExpire}
                onSliderVerify={(p) => setSliderValue(p)}
                refreshKey={captchaKey}
              />
            )}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <EmojiStickerPicker
                  onEmojiSelect={(emoji) => insertAtCursor(emoji)}
                  onStickerSelect={(markup) => insertAtCursor(markup)}
                />
                <span className="text-xs text-muted-foreground">{newComment.length}/2000</span>
              </div>
              <div className="flex gap-2">
                {newComment && (
                  <Button variant="ghost" size="sm" onClick={() => setNewComment("")}>
                    取消
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={
                    !newComment.trim() ||
                    isSubmitting ||
                    (!session && !guestName.trim()) ||
                    (captchaType === "math" && !captchaValue.trim()) ||
                    (isTokenCaptcha && !turnstileToken) ||
                    (captchaType === "slider" && sliderValue === null)
                  }
                >
                  {isSubmitting ? "发表中..." : "发表评论"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">暂无评论，来发表第一条评论吧</div>
        ) : (
          <>
            {comments.map((comment) => (
              <GameCommentItem key={comment.id} comment={comment} gameId={gameId} />
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? "加载中..." : "加载更多评论"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
