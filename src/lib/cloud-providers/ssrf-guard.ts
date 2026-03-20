/**
 * Block URLs targeting internal/private network addresses to prevent SSRF.
 * Returns true if the URL host appears safe (public internet).
 */
export function isUrlSafe(parsed: URL): boolean {
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "[::1]") return false;

  // IPv4 private/reserved ranges
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    const parts = hostname.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return false;                           // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return false;    // 172.16.0.0/12
    if (a === 192 && b === 168) return false;              // 192.168.0.0/16
    if (a === 127) return false;                           // 127.0.0.0/8
    if (a === 169 && b === 254) return false;              // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 0) return false;                             // 0.0.0.0/8
    if (a >= 224) return false;                            // multicast + reserved
  }

  // IPv6 private
  if (hostname.startsWith("[")) {
    const inner = hostname.slice(1, -1).toLowerCase();
    if (inner === "::1") return false;
    if (inner.startsWith("fe80:")) return false;           // link-local
    if (inner.startsWith("fc") || inner.startsWith("fd")) return false; // unique-local
  }

  // Block cloud metadata hostnames
  if (hostname === "metadata.google.internal") return false;
  if (hostname.endsWith(".internal")) return false;

  return true;
}
