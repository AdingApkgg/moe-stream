"use client";

import Script from "next/script";
import type { PublicSiteConfig } from "@/lib/site-config";

export function AnalyticsScripts({ config }: { config: PublicSiteConfig }) {
  const { analyticsGoogleId, analyticsGtmId, analyticsCfToken, analyticsClarityId } = config;

  const hasAny = analyticsGoogleId || analyticsGtmId || analyticsCfToken || analyticsClarityId;
  if (!hasAny) return null;

  return (
    <>
      {analyticsGtmId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${analyticsGtmId}');`}
        </Script>
      )}

      {analyticsGoogleId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${analyticsGoogleId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analyticsGoogleId}');`}
          </Script>
        </>
      )}

      {analyticsCfToken && (
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={`{"token":"${analyticsCfToken}"}`}
          strategy="afterInteractive"
        />
      )}

      {analyticsClarityId && (
        <Script id="ms-clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${analyticsClarityId}");`}
        </Script>
      )}
    </>
  );
}

export function GtmNoscript({ gtmId }: { gtmId: string | null }) {
  if (!gtmId) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
