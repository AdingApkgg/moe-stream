"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { playSound, type SoundType } from "@/lib/audio";
import { useUserStore } from "@/stores/user";

export interface ShortcutDef {
  /** 组合键字符串，如 "l"、"mod+s"、"shift+?"、"ArrowLeft"。mod 在 Mac 上为 ⌘，其他平台为 Ctrl */
  combo: string;
  /** 中文描述，会出现在帮助弹窗 */
  description: string;
  /** 分组名，如 "导航"、"视频"、"互动" */
  group: string;
  /** 触发时自动播放的音效；默认 "click"，传 null 关闭 */
  sound?: SoundType | null;
}

interface RegisteredShortcut extends ShortcutDef {
  id: string;
}

interface ShortcutActions {
  register: (id: string, def: ShortcutDef) => void;
  unregister: (id: string) => void;
}

const ShortcutActionsContext = createContext<ShortcutActions | null>(null);
const ShortcutListContext = createContext<RegisteredShortcut[]>([]);

export function ShortcutRegistryProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<RegisteredShortcut[]>([]);

  const register = useCallback((id: string, def: ShortcutDef) => {
    setShortcuts((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      return [...filtered, { id, ...def }];
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // actions value 永远稳定，避免 useShortcut 消费者在 list 变化时被牵连重渲染
  const actions = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <ShortcutActionsContext.Provider value={actions}>
      <ShortcutListContext.Provider value={shortcuts}>{children}</ShortcutListContext.Provider>
    </ShortcutActionsContext.Provider>
  );
}

/** 读取当前注册的所有快捷键（按分组排序） */
export function useRegisteredShortcuts() {
  return useContext(ShortcutListContext);
}

let idCounter = 0;
const nextId = () => `sc-${++idCounter}`;

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

/** 解析 combo 字符串并匹配 KeyboardEvent */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split("+").map((p) => p.trim());
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase());

  const wantMeta = mods.includes("meta") || (mods.includes("mod") && IS_MAC);
  const wantCtrl = mods.includes("ctrl") || (mods.includes("mod") && !IS_MAC);
  const wantShift = mods.includes("shift");
  const wantAlt = mods.includes("alt");

  if (e.metaKey !== wantMeta) return false;
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.altKey !== wantAlt) return false;

  const isLetterOrDigit = /^[a-zA-Z0-9]$/.test(key);
  if (isLetterOrDigit && e.shiftKey !== wantShift) return false;

  const targetKey = key.toLowerCase() === "space" ? " " : key.toLowerCase();
  return e.key.toLowerCase() === targetKey;
}

/** 把 combo 拆成可显示的按键片段 */
export function formatCombo(combo: string): string[] {
  return combo.split("+").map((p) => {
    const k = p.trim();
    switch (k.toLowerCase()) {
      case "mod":
        return IS_MAC ? "⌘" : "Ctrl";
      case "meta":
        return "⌘";
      case "ctrl":
        return "Ctrl";
      case "shift":
        return "⇧";
      case "alt":
      case "option":
        return IS_MAC ? "⌥" : "Alt";
      case "arrowleft":
        return "←";
      case "arrowright":
        return "→";
      case "arrowup":
        return "↑";
      case "arrowdown":
        return "↓";
      case "escape":
      case "esc":
        return "Esc";
      case "enter":
        return "Enter";
      case "space":
      case " ":
        return "Space";
      case "tab":
        return "Tab";
      default:
        return k.length === 1 ? k.toUpperCase() : k;
    }
  });
}

interface UseShortcutOptions extends ShortcutDef {
  /** 触发条件，默认 true。设为 false 时跳过监听 */
  enabled?: boolean;
}

/**
 * 注册一个键盘快捷键。
 * - 自动跳过 INPUT / TEXTAREA / contentEditable / VIDEO 聚焦时
 * - 触发时按用户偏好播放音效
 * - 自动加入帮助弹窗
 */
export function useShortcut(handler: (e: KeyboardEvent) => void, opts: UseShortcutOptions) {
  const { combo, description, group, sound = "click", enabled = true } = opts;
  const actions = useContext(ShortcutActionsContext);
  const register = actions?.register;
  const unregister = actions?.unregister;
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const soundEnabled = useUserStore((s) => s.preferences.soundEnabled);
  const soundVolume = useUserStore((s) => s.preferences.soundVolume);

  useEffect(() => {
    if (!enabled || !register || !unregister) return;
    const id = nextId();
    register(id, { combo, description, group, sound });
    return () => unregister(id);
  }, [enabled, combo, description, group, sound, register, unregister]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (tag === "VIDEO") return;
      if (!matchesCombo(e, combo)) return;
      e.preventDefault();
      if (sound && soundEnabled) playSound(sound, soundVolume);
      handlerRef.current(e);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, combo, sound, soundEnabled, soundVolume]);
}
