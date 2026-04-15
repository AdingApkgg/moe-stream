"use client";

import { useMemo } from "react";
import { useSiteConfig } from "@/contexts/site-config";
import type { RedirectOptions } from "@/lib/utils";

export function useRedirectOptions(): RedirectOptions | undefined {
  const config = useSiteConfig();
  return useMemo(
    () => (config ? { enabled: config.redirectEnabled, whitelist: config.redirectWhitelist } : undefined),
    [config],
  );
}
