import { useEffect, useRef, useCallback } from "react";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast-with-sound";
import type { SiteConfig } from "@/generated/prisma/client";

interface UseTabFormOptions<T extends FieldValues> {
  schema: z.ZodType<T>;
  pickValues: (cfg: SiteConfig) => T;
  config: SiteConfig | undefined;
}

export function useTabForm<T extends FieldValues>({ schema, pickValues, config }: UseTabFormOptions<T>) {
  const utils = trpc.useUtils();
  const resetTsRef = useRef<number>(0);

  const form = useForm<T>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as any,
    defaultValues: (config ? pickValues(config) : undefined) as DefaultValues<T>,
  });

  const updateConfig = trpc.admin.updateSiteConfig.useMutation({
    onSuccess: (data) => {
      toast.success("配置已保存");
      resetTsRef.current = new Date(data.updatedAt).getTime();
      form.reset(pickValues(data) as DefaultValues<T>);
      utils.admin.getSiteConfig.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "保存失败");
    },
  });

  const resetFromConfig = useCallback(
    (cfg: SiteConfig) => {
      form.reset(pickValues(cfg) as DefaultValues<T>);
    },
    [form, pickValues],
  );

  useEffect(() => {
    if (config) {
      const ts = new Date(config.updatedAt).getTime();
      if (resetTsRef.current !== ts) {
        resetTsRef.current = ts;
        resetFromConfig(config);
      }
    }
  }, [config, resetFromConfig]);

  const onSubmit = (values: T) => {
    const dirty = form.formState.dirtyFields as Record<string, unknown>;
    const dirtyKeys = Object.keys(dirty).filter((k) => dirty[k]);
    if (dirtyKeys.length === 0) {
      toast.info("没有修改");
      return;
    }
    const payload = Object.fromEntries(dirtyKeys.map((k) => [k, (values as Record<string, unknown>)[k]]));
    updateConfig.mutate(payload as T);
  };

  const onFormError = (errors: Record<string, unknown>) => {
    const keys = Object.keys(errors);
    if (keys.length > 0) {
      const details = keys
        .map((k) => {
          const err = errors[k] as { message?: string } | undefined;
          return err?.message ? `${k}: ${err.message}` : k;
        })
        .join("; ");
      console.error("[设置表单验证失败]", errors);
      toast.error(`表单验证失败：${details}`);
    }
  };

  return { form, onSubmit, onFormError, isPending: updateConfig.isPending, resetFromConfig };
}
