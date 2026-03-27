import type { AdminScope } from "./constants";

export function isPrivileged(role: string): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export function isOwner(role: string): boolean {
  return role === "OWNER";
}

export function canUploadContent(user: { role: string; canUpload: boolean }): boolean {
  return isPrivileged(user.role) || user.canUpload;
}

export function userHasScope(role: string, adminScopes: string[], scope: AdminScope): boolean {
  if (role === "OWNER") return true;
  if (role === "USER") return false;
  return adminScopes.includes(scope);
}
