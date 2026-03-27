import { describe, it, expect } from "vitest";
import { isPrivileged, isOwner, canUploadContent, userHasScope } from "../permissions";

describe("isPrivileged", () => {
  it("OWNER 应为特权用户", () => {
    expect(isPrivileged("OWNER")).toBe(true);
  });

  it("ADMIN 应为特权用户", () => {
    expect(isPrivileged("ADMIN")).toBe(true);
  });

  it("USER 不应为特权用户", () => {
    expect(isPrivileged("USER")).toBe(false);
  });

  it("未知角色不应为特权用户", () => {
    expect(isPrivileged("GUEST")).toBe(false);
    expect(isPrivileged("")).toBe(false);
  });
});

describe("isOwner", () => {
  it("OWNER 返回 true", () => {
    expect(isOwner("OWNER")).toBe(true);
  });

  it("ADMIN 返回 false", () => {
    expect(isOwner("ADMIN")).toBe(false);
  });

  it("USER 返回 false", () => {
    expect(isOwner("USER")).toBe(false);
  });
});

describe("canUploadContent", () => {
  it("OWNER 无论 canUpload 标志如何都可以上传", () => {
    expect(canUploadContent({ role: "OWNER", canUpload: false })).toBe(true);
    expect(canUploadContent({ role: "OWNER", canUpload: true })).toBe(true);
  });

  it("ADMIN 无论 canUpload 标志如何都可以上传", () => {
    expect(canUploadContent({ role: "ADMIN", canUpload: false })).toBe(true);
  });

  it("USER 需要 canUpload 为 true 才能上传", () => {
    expect(canUploadContent({ role: "USER", canUpload: true })).toBe(true);
    expect(canUploadContent({ role: "USER", canUpload: false })).toBe(false);
  });
});

describe("userHasScope", () => {
  it("OWNER 拥有所有权限", () => {
    expect(userHasScope("OWNER", [], "video:manage")).toBe(true);
    expect(userHasScope("OWNER", [], "user:manage")).toBe(true);
    expect(userHasScope("OWNER", [], "settings:manage")).toBe(true);
  });

  it("USER 无任何管理权限", () => {
    expect(userHasScope("USER", ["video:manage", "user:manage"], "video:manage")).toBe(false);
  });

  it("ADMIN 根据 scopes 数组判断", () => {
    expect(userHasScope("ADMIN", ["video:manage", "tag:manage"], "video:manage")).toBe(true);
    expect(userHasScope("ADMIN", ["video:manage", "tag:manage"], "user:manage")).toBe(false);
    expect(userHasScope("ADMIN", [], "video:manage")).toBe(false);
  });
});
