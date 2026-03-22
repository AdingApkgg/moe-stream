import { describe, it, expect } from "vitest";
import { ADMIN_SCOPES, GAME_PLATFORMS, GAME_TYPES } from "../constants";

describe("ADMIN_SCOPES", () => {
  it("应包含所有必要的权限范围", () => {
    const requiredScopes = [
      "video:moderate",
      "video:manage",
      "user:view",
      "user:manage",
      "tag:manage",
      "settings:manage",
      "comment:manage",
    ];
    for (const scope of requiredScopes) {
      expect(ADMIN_SCOPES).toHaveProperty(scope);
    }
  });

  it("每个 scope 应有中文描述", () => {
    for (const [key, value] of Object.entries(ADMIN_SCOPES)) {
      expect(typeof key).toBe("string");
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("GAME_PLATFORMS", () => {
  it("应包含常见游戏平台", () => {
    expect(GAME_PLATFORMS).toContain("Windows");
    expect(GAME_PLATFORMS).toContain("Android");
    expect(GAME_PLATFORMS).toContain("iOS");
    expect(GAME_PLATFORMS).toContain("Web");
  });

  it("应包含主机平台", () => {
    expect(GAME_PLATFORMS).toContain("PS5");
    expect(GAME_PLATFORMS).toContain("Switch");
  });
});

describe("GAME_TYPES", () => {
  it("应包含常见游戏类型", () => {
    expect(GAME_TYPES).toContain("RPG");
    expect(GAME_TYPES).toContain("ADV");
    expect(GAME_TYPES).toContain("ACT");
    expect(GAME_TYPES).toContain("SLG");
    expect(GAME_TYPES).toContain("VN");
  });

  it("不应有重复项", () => {
    const unique = new Set(GAME_TYPES);
    expect(unique.size).toBe(GAME_TYPES.length);
  });
});
