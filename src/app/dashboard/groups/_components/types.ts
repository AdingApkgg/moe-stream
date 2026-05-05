import type { GroupPermissions } from "@/lib/group-permissions";

export type GroupRole = "USER" | "ADMIN" | "OWNER";

export interface GroupItem {
  id: string;
  name: string;
  description: string | null;
  role: GroupRole;
  permissions: GroupPermissions;
  adminScopes: string[] | null;
  storageQuota: string;
  referralMaxLinks: number;
  isDefault: boolean;
  isSystem: boolean;
  color: string | null;
  sortOrder: number;
  createdAt: Date;
  _count: { users: number };
}

export const STORAGE_PRESETS = [
  { label: "1 GB", value: "1073741824" },
  { label: "5 GB", value: "5368709120" },
  { label: "10 GB", value: "10737418240" },
  { label: "20 GB", value: "21474836480" },
  { label: "50 GB", value: "53687091200" },
  { label: "100 GB", value: "107374182400" },
];

export const BYTES_PER_GB = 1073741824;

export function formatStorageQuota(bytes: string): string {
  const n = Number(bytes);
  if (n >= 1099511627776) return `${(n / 1099511627776).toFixed(1)} TB`;
  if (n >= BYTES_PER_GB) return `${(n / BYTES_PER_GB).toFixed(0)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(0)} MB`;
  return `${n} B`;
}

export function formatReferralLinkCap(n: number): string {
  return n <= 0 ? "不限制" : `${n} 条/人`;
}

export function bytesToGb(bytes: string): number {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / BYTES_PER_GB) * 100) / 100;
}

export function gbToBytes(gb: number): string {
  return Math.max(0, Math.round(gb * BYTES_PER_GB)).toString();
}
