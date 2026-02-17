"use client";

import { useCallback } from "react";
import { useUserStore } from "@/stores/user";
import { playSound, type SoundType } from "@/lib/audio";

export function useSound() {
  const soundEnabled = useUserStore((s) => s.preferences.soundEnabled);
  const soundVolume = useUserStore((s) => s.preferences.soundVolume);

  const play = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return;
      playSound(type, soundVolume);
    },
    [soundEnabled, soundVolume],
  );

  return { play };
}
