"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Send, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast-with-sound";

export function TestEmailButton() {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const sendTest = trpc.admin.sendTestEmail.useMutation({
    onSuccess: () => {
      toast.success("测试邮件已发送，请检查收件箱");
      setOpen(false);
      setEmail("");
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4 mr-2" />
        发送测试邮件
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>发送测试邮件</AlertDialogTitle>
            <AlertDialogDescription>
              请先保存配置，然后输入收件人邮箱发送一封测试邮件来验证配置是否正确。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input type="email" placeholder="收件人邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={!email.includes("@") || sendTest.isPending}
              onClick={(e) => {
                e.preventDefault();
                sendTest.mutate({ to: email });
              }}
            >
              {sendTest.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
