"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import type { GroupItem } from "./types";

interface DeleteGroupDialogProps {
  group: GroupItem | null;
  defaultGroupName?: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteGroupDialog({ group, defaultGroupName, isPending, onCancel, onConfirm }: DeleteGroupDialogProps) {
  const memberCount = group?._count.users ?? 0;
  return (
    <AlertDialog open={!!group} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除用户组</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除「<span className="font-medium text-foreground">{group?.name}</span>」吗?
            {memberCount > 0 ? (
              <>
                {" "}
                该组下的 <span className="font-medium text-foreground">{memberCount}</span> 名用户将被移至
                {defaultGroupName ? (
                  <>
                    默认组「<span className="font-medium text-foreground">{defaultGroupName}</span>」
                  </>
                ) : (
                  "默认用户组"
                )}
                ,其角色也会同步变更。
              </>
            ) : (
              " 该组当前没有成员。"
            )}{" "}
            此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
