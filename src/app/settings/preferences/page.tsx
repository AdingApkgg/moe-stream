"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/stores/user";
import { playSound, type SoundType } from "@/lib/audio";
import { Volume2, VolumeX, Play } from "lucide-react";

const TEST_SOUNDS: { type: SoundType; label: string }[] = [
  { type: "click", label: "点击" },
  { type: "success", label: "成功" },
  { type: "like", label: "点赞" },
  { type: "favorite", label: "收藏" },
  { type: "navigate", label: "导航" },
  { type: "error", label: "错误" },
];

export default function PreferencesPage() {
  const { soundEnabled, soundVolume } = useUserStore((s) => s.preferences);
  const setPreference = useUserStore((s) => s.setPreference);
  const [volumeDisplay, setVolumeDisplay] = useState(soundVolume);

  const handleVolumeChange = (v: number[]) => {
    const next = v[0] / 100;
    setVolumeDisplay(next);
    setPreference("soundVolume", next);
  };

  const handleVolumeCommit = (v: number[]) => {
    const next = v[0] / 100;
    if (soundEnabled) playSound("click", next);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">偏好设置</h2>
        <p className="text-sm text-muted-foreground mt-1">界面音效与交互偏好</p>
      </div>

      <section className="space-y-6 pb-8 border-b">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1 flex-1">
            <Label htmlFor="sound-enabled" className="text-base font-medium flex items-center gap-2">
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              界面音效
            </Label>
            <p className="text-sm text-muted-foreground">
              点赞、收藏、按下快捷键等操作时播放轻量提示音，使用浏览器内置 Web Audio 生成，无需下载音频
            </p>
          </div>
          <Switch
            id="sound-enabled"
            checked={soundEnabled}
            onCheckedChange={(checked) => {
              setPreference("soundEnabled", checked);
              if (checked) playSound("success", soundVolume);
            }}
          />
        </div>

        <div className={soundEnabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sound-volume" className="text-sm">
                音量
              </Label>
              <span className="text-sm text-muted-foreground tabular-nums">{Math.round(volumeDisplay * 100)}%</span>
            </div>
            <Slider
              id="sound-volume"
              value={[Math.round(volumeDisplay * 100)]}
              onValueChange={handleVolumeChange}
              onValueCommit={handleVolumeCommit}
              min={0}
              max={100}
              step={5}
              className="max-w-md"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">试听</Label>
            <div className="flex flex-wrap gap-2">
              {TEST_SOUNDS.map((s) => (
                <Button
                  key={s.type}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => playSound(s.type, volumeDisplay)}
                  className="gap-1.5"
                >
                  <Play className="h-3 w-3" />
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium">键盘快捷键</h3>
        <p className="text-sm text-muted-foreground">
          全站启用键盘快捷键，按{" "}
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 text-xs font-mono">
            ?
          </kbd>{" "}
          查看当前页面可用的快捷键
        </p>
      </section>
    </div>
  );
}
