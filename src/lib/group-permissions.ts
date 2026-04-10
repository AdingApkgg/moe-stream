import { ADMIN_SCOPES, type AdminScope } from "./constants";

export interface GroupPermissions {
  canUpload: boolean;
  canComment: boolean;
  canDanmaku: boolean;
  canChat: boolean;
  canDownload: boolean;
  adsEnabled: boolean;
}

export const DEFAULT_GROUP_PERMISSIONS: GroupPermissions = {
  canUpload: false,
  canComment: true,
  canDanmaku: true,
  canChat: true,
  canDownload: false,
  adsEnabled: true,
};

const ALL_PERMISSIONS: GroupPermissions = {
  canUpload: true,
  canComment: true,
  canDanmaku: true,
  canChat: true,
  canDownload: true,
  adsEnabled: false,
};

/**
 * 从用户组的 permissions JSON 解析出完整的功能权限。
 * OWNER 角色直接获得全部权限，其他角色以组权限为准、缺失字段回退默认值。
 */
export function resolvePermissions(
  role: string,
  groupPermissions?: Partial<GroupPermissions> | null,
): GroupPermissions {
  if (role === "OWNER") return ALL_PERMISSIONS;
  return { ...DEFAULT_GROUP_PERMISSIONS, ...(groupPermissions ?? {}) };
}

/**
 * 从用户组的 adminScopes 解析出管理员可用的权限范围列表。
 * OWNER 获得全部 scope，ADMIN 取组配置，USER 返回空数组。
 */
export function resolveAdminScopes(role: string, groupAdminScopes?: string[] | null): AdminScope[] {
  if (role === "OWNER") return Object.keys(ADMIN_SCOPES) as AdminScope[];
  if (role !== "ADMIN") return [];
  if (!groupAdminScopes) return [];
  const valid = Object.keys(ADMIN_SCOPES);
  return groupAdminScopes.filter((s) => valid.includes(s)) as AdminScope[];
}

/**
 * 从用户的 group 信息解析出有效 role。
 * 优先使用 group.role，回退到 user 自身的 role（兼容未分配组的用户）。
 */
export function resolveRole(userRole: string, groupRole?: string | null): "USER" | "ADMIN" | "OWNER" {
  const effective = groupRole ?? userRole;
  if (effective === "OWNER") return "OWNER";
  if (effective === "ADMIN") return "ADMIN";
  return "USER";
}

export const GROUP_PERMISSION_LABELS: Record<keyof GroupPermissions, string> = {
  canUpload: "投稿",
  canComment: "评论",
  canDanmaku: "弹幕",
  canChat: "聊天/私信",
  canDownload: "下载文件",
  adsEnabled: "展示广告",
};

export const ROLE_LABELS: Record<string, string> = {
  USER: "普通用户",
  ADMIN: "管理员",
  OWNER: "站长",
};
