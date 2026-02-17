"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: { group: string; items: ShortcutItem[] }[] = [
  {
    group: "导航",
    items: [
      { keys: ["←"], description: "上一页" },
      { keys: ["→"], description: "下一页" },
      { keys: ["/"], description: "打开搜索" },
      { keys: ["Ctrl", "K"], description: "命令面板" },
    ],
  },
  {
    group: "通用",
    items: [
      { keys: ["Esc"], description: "关闭弹窗 / 取消聚焦" },
      { keys: ["?"], description: "显示快捷键帮助" },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>键盘快捷键</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {shortcuts.map((group) => (
            <div key={group.group}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {group.group}
              </h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span className="text-xs text-muted-foreground mx-0.5">+</span>
                          )}
                          <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                            {key}
                          </kbd>
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
