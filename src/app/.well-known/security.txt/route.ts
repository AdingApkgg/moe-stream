import { NextResponse } from "next/server";
import { getPublicSiteConfig } from "@/lib/site-config";

export async function GET() {
  const config = await getPublicSiteConfig();
  const baseUrl = config.siteUrl;
  const securityEmail = config.securityEmail || config.contactEmail;

  const contactLines = securityEmail
    ? `Contact: mailto:${securityEmail}\nContact: ${baseUrl}/security`
    : `Contact: ${baseUrl}/security`;

  const securityTxt = `# Security Policy for ${config.siteName}
# https://securitytxt.org/

${contactLines}
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Preferred-Languages: zh, en
Canonical: ${baseUrl}/.well-known/security.txt
`;

  return new NextResponse(securityTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
