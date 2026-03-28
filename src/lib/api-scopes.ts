/**
 * API Key 权限范围定义
 * 采用 资源:操作 两级结构，前后端共享
 */

export interface ApiScope {
  id: string;
  label: string;
  desc: string;
}

export interface ApiScopeGroup {
  id: string;
  label: string;
  description: string;
  scopes: readonly ApiScope[];
}

export const API_SCOPE_GROUPS: readonly ApiScopeGroup[] = [
  {
    id: "content",
    label: "内容",
    description: "视频、游戏、图片帖子",
    scopes: [
      { id: "content:read", label: "读取", desc: "查询列表、详情、搜索" },
      { id: "content:write", label: "写入", desc: "创建、编辑、删除内容" },
    ],
  },
  {
    id: "comment",
    label: "评论",
    description: "所有内容类型的评论",
    scopes: [
      { id: "comment:read", label: "读取", desc: "查询评论列表" },
      { id: "comment:write", label: "写入", desc: "发表、编辑、删除评论" },
    ],
  },
  {
    id: "social",
    label: "社交",
    description: "关注、私信、频道",
    scopes: [
      { id: "social:read", label: "读取", desc: "查看关注、私信、频道" },
      { id: "social:write", label: "写入", desc: "关注、发消息" },
    ],
  },
  {
    id: "file",
    label: "文件",
    description: "文件上传和存储管理",
    scopes: [
      { id: "file:read", label: "读取", desc: "查询文件列表和用量" },
      { id: "file:write", label: "写入", desc: "上传、删除文件" },
    ],
  },
  {
    id: "user",
    label: "用户资料",
    description: "个人资料和账号信息",
    scopes: [
      { id: "user:read", label: "读取", desc: "查看个人资料" },
      { id: "user:write", label: "写入", desc: "修改昵称、头像等" },
    ],
  },
  {
    id: "notification",
    label: "通知",
    description: "站内通知",
    scopes: [
      { id: "notification:read", label: "读取", desc: "查询通知列表和未读数" },
      { id: "notification:write", label: "写入", desc: "标记已读、删除" },
    ],
  },
  {
    id: "stats",
    label: "数据统计",
    description: "站点统计、增长趋势、排行榜",
    scopes: [{ id: "stats:read", label: "读取", desc: "查询数据总览、增长趋势、排行榜、内容分布" }],
  },
  {
    id: "system",
    label: "系统信息",
    description: "存储用量、标签、合集等系统数据",
    scopes: [{ id: "system:read", label: "读取", desc: "查询存储用量、热门标签、合集列表" }],
  },
  {
    id: "admin",
    label: "管理后台",
    description: "后台管理操作（需管理员角色）",
    scopes: [
      { id: "admin:read", label: "读取", desc: "查询后台数据、审核列表、用户管理" },
      { id: "admin:write", label: "写入", desc: "审核内容、封禁用户、修改配置" },
    ],
  },
] as const;

/** 所有有效 scope id 列表 */
export const ALL_SCOPE_IDS = API_SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => s.id));

/** 校验 scope id 是否合法 */
export function isValidScope(scope: string): boolean {
  return ALL_SCOPE_IDS.includes(scope);
}

/** 校验一组 scope id 是否全部合法 */
export function validateScopes(scopes: string[]): boolean {
  return scopes.length > 0 && scopes.every(isValidScope);
}

/** 根据 scope id 获取所属分组 label */
export function getScopeGroupLabel(scopeId: string): string {
  const group = API_SCOPE_GROUPS.find((g) => g.scopes.some((s) => s.id === scopeId));
  return group?.label ?? scopeId;
}

/** 将 scope id 列表归纳为分组摘要（用于 UI badge 展示） */
export function summarizeScopes(scopes: string[]): string[] {
  const groups = new Map<string, Set<string>>();
  for (const scope of scopes) {
    const [group, action] = scope.split(":");
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group)!.add(action);
  }

  const result: string[] = [];
  for (const g of API_SCOPE_GROUPS) {
    const actions = groups.get(g.id);
    if (!actions) continue;
    if (actions.has("write")) {
      result.push(`${g.label} 读写`);
    } else if (actions.has("read")) {
      result.push(`${g.label} 只读`);
    }
  }
  return result;
}

// ---- 模板预设 ----

export interface ApiScopeTemplate {
  id: string;
  label: string;
  description: string;
  scopes: string[];
}

export const API_SCOPE_TEMPLATES: readonly ApiScopeTemplate[] = [
  {
    id: "all",
    label: "全部权限",
    description: "所有资源的读写权限",
    scopes: [...ALL_SCOPE_IDS],
  },
  {
    id: "publish",
    label: "仅发布内容",
    description: "创建和管理内容 + 文件上传",
    scopes: ["content:read", "content:write", "file:read", "file:write"],
  },
  {
    id: "readonly",
    label: "只读访问",
    description: "所有资源的只读权限",
    scopes: ALL_SCOPE_IDS.filter((s) => s.endsWith(":read")),
  },
  {
    id: "data-analysis",
    label: "数据分析",
    description: "统计数据 + 系统信息只读",
    scopes: ["stats:read", "system:read", "content:read"],
  },
] as const;
