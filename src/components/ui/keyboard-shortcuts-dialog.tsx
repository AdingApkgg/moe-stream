"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCombo, useRegisteredShortcuts } from "@/contexts/shortcut-registry";

interface StaticShortcut {
  combo: string;
  description: string;
  group: string;
}

// 不通过 useShortcut 注册的「常驻」快捷键，手工列出
const staticShortcuts: StaticShortcut[] = [
  { combo: "mod+k", description: "打开命令面板", group: "导航" },
  { combo: "/", description: "聚焦搜索", group: "导航" },
  { combo: "Escape", description: "关闭弹窗 / 取消聚焦", group: "通用" },
  { combo: "?", description: "显示快捷键帮助", group: "通用" },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const registered = useRegisteredShortcuts();

  const merged = [
    ...staticShortcuts,
    ...registered.map(({ combo, description, group }) => ({ combo, description, group })),
  ];

  // 同 combo 去重（注册版优先）
  const seen = new Set<string>();
  const unique = [...merged].reverse().filter((s) => {
    const k = `${s.group}::${s.combo}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const groups = unique.reduce<Record<string, typeof unique>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  // 分组排序：导航 > 视频 > 互动 > 通用 > 其他
  const order = ["导航", "视频", "互动", "通用"];
  const sortedGroupNames = Object.keys(groups).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>键盘快捷键</DialogTitle>
          <DialogDescription>当前页面可用的快捷键，按 ? 随时打开此面板</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {sortedGroupNames.map((groupName) => (
            <div key={groupName}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">{groupName}</h4>
              <div className="space-y-2">
                {groups[groupName].map((item) => (
                  <div key={`${groupName}-${item.combo}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {formatCombo(item.combo).map((key, i, arr) => (
                        <span key={i} className="inline-flex items-center">
                          {i > 0 && <span className="text-xs text-muted-foreground mx-0.5">+</span>}
                          <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                            {key}
                          </kbd>
                          {i === arr.length - 1 ? null : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
