"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "@/lib/toast-with-sound";
import { ArrowRightLeft, Search, Loader2 } from "lucide-react";

interface TransferOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  selectedIds: string[];
  contentType: "video" | "game" | "image";
  contentLabel: string;
  onSuccess: () => void;
}

export function TransferOwnerDialog({
  open,
  onOpenChange,
  selectedCount,
  selectedIds,
  contentType,
  contentLabel,
  onSuccess,
}: TransferOwnerDialogProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: searchedUsers } = trpc.admin.searchUsersForTransfer.useQuery(
    { search: searchValue },
    { enabled: searchValue.length >= 1 && open }
  );

  const transferMutation = trpc.admin.transferWorkItems.useMutation({
    onSuccess: (result) => {
      toast.success(`已将 ${result.count} 个${contentLabel}转移成功`);
      handleClose();
      onSuccess();
    },
    onError: (error) => toast.error(error.message || "转移失败"),
  });

  const handleClose = () => {
    onOpenChange(false);
    setSearchValue("");
    setSelectedUser(null);
    setConfirmOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              转移{contentLabel}所有权
            </DialogTitle>
            <DialogDescription>
              将已选的 {selectedCount} 个{contentLabel}转移到另一个用户
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">目标用户</label>
              {selectedUser ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatar || undefined} />
                    <AvatarFallback>
                      {(selectedUser.nickname || selectedUser.username).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{selectedUser.nickname || selectedUser.username}</div>
                    <div className="text-xs text-muted-foreground">@{selectedUser.username} · ID: {selectedUser.id}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(null);
                      setSearchValue("");
                    }}
                  >
                    更换
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索用户名、昵称、邮箱或 ID..."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchedUsers && searchedUsers.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {searchedUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                          onClick={() => setSelectedUser(u)}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar || undefined} />
                            <AvatarFallback>
                              {(u.nickname || u.username).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">{u.nickname || u.username}</div>
                            <div className="text-xs text-muted-foreground">@{u.username}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchedUsers && searchedUsers.length === 0 && searchValue.length >= 1 && (
                    <div className="text-sm text-muted-foreground text-center py-3">
                      未找到匹配用户
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button
              disabled={!selectedUser || transferMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              确认转移
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认转移所有权</AlertDialogTitle>
            <AlertDialogDescription>
              即将把 {selectedCount} 个{contentLabel}转移给 {selectedUser?.nickname || selectedUser?.username}。此操作不可撤销，请确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={transferMutation.isPending}
              onClick={() => {
                if (selectedUser) {
                  transferMutation.mutate({
                    itemIds: selectedIds,
                    contentType,
                    toUserId: selectedUser.id,
                  });
                }
              }}
            >
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认转移
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
