import { getPublicSiteConfig } from "@/lib/site-config";
import { RedirectClient } from "./client";

export default async function RedirectPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const [{ url }, config] = await Promise.all([searchParams, getPublicSiteConfig()]);

  return (
    <RedirectClient
      url={url}
      redirectEnabled={config.redirectEnabled}
      countdown={config.redirectCountdown}
      whitelist={config.redirectWhitelist}
      title={config.redirectTitle}
      description={config.redirectDescription}
      disclaimer={config.redirectDisclaimer}
    />
  );
}
