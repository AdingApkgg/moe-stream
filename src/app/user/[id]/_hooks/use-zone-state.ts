"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDefaultTab, type Zone } from "../_lib/utils";

interface ZoneState {
  zone: Zone;
  tab: string;
  page: number;
}

interface UpdateOptions {
  mode?: "push" | "replace";
}

export function useZoneState(): ZoneState & {
  setZone: (zone: Zone) => void;
  setTab: (tab: string) => void;
  setPage: (page: number) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const zone = ((params.get("zone") ?? "all") as Zone) || "all";
  const tab = params.get("tab") ?? getDefaultTab(zone);
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const navigate = useCallback(
    (next: URLSearchParams, { mode = "replace" }: UpdateOptions = {}) => {
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router[mode](url, { scroll: false });
    },
    [pathname, router],
  );

  const setZone = useCallback(
    (nextZone: Zone) => {
      const sp = new URLSearchParams(params);
      if (nextZone === "all") sp.delete("zone");
      else sp.set("zone", nextZone);
      sp.delete("tab");
      sp.delete("page");
      navigate(sp, { mode: "push" });
    },
    [params, navigate],
  );

  const setTab = useCallback(
    (nextTab: string) => {
      const sp = new URLSearchParams(params);
      const fallback = getDefaultTab(zone);
      if (nextTab === fallback) sp.delete("tab");
      else sp.set("tab", nextTab);
      sp.delete("page");
      navigate(sp, { mode: "replace" });
    },
    [params, zone, navigate],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const sp = new URLSearchParams(params);
      if (nextPage <= 1) sp.delete("page");
      else sp.set("page", String(nextPage));
      navigate(sp, { mode: "replace" });
    },
    [params, navigate],
  );

  return { zone, tab, page, setZone, setTab, setPage };
}
