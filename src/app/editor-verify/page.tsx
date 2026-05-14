"use client";

import { useRef, useState } from "react";
import { PostEditor, type PostEditorRef } from "@/components/editor/post-editor";
import { Button } from "@/components/ui/button";

export default function EditorVerifyPage() {
  const [postValue, setPostValue] = useState("");
  const [docValue, setDocValue] = useState("");
  const postRef = useRef<PostEditorRef>(null);
  const docRef = useRef<PostEditorRef>(null);

  return (
    <div className="container mx-auto max-w-3xl space-y-8 py-8">
      <header>
        <h1 className="text-2xl font-semibold">PostEditor 验证页</h1>
        <p className="text-sm text-muted-foreground">
          本地调试入口：分别挂载 post / doc 两种变体，验证渲染与 markdown 输出。
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">variant = post</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => postRef.current?.insertText("插入文本 ")}>
              insertText
            </Button>
            <Button size="sm" variant="outline" onClick={() => postRef.current?.focus()}>
              focus
            </Button>
            <Button size="sm" variant="outline" onClick={() => postRef.current?.clear()}>
              clear
            </Button>
          </div>
        </div>
        <PostEditor
          ref={postRef}
          variant="post"
          value={postValue}
          onChange={setPostValue}
          placeholder="post 变体：写点视频/图片简介试试…"
          maxLength={500}
        />
        <pre className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
          {postValue || "(空)"}
        </pre>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">variant = doc</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => docRef.current?.insertText("插入文本 ")}>
              insertText
            </Button>
            <Button size="sm" variant="outline" onClick={() => docRef.current?.focus()}>
              focus
            </Button>
            <Button size="sm" variant="outline" onClick={() => docRef.current?.clear()}>
              clear
            </Button>
          </div>
        </div>
        <PostEditor
          ref={docRef}
          variant="doc"
          value={docValue}
          onChange={setDocValue}
          placeholder="doc 变体：试试斜杠菜单、富媒体快捷码…"
          minHeight="280px"
        />
        <pre className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
          {docValue || "(空)"}
        </pre>
      </section>
    </div>
  );
}
