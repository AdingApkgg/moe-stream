import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("应合并多个类名", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("应过滤 falsy 值", () => {
    expect(cn("foo", false && "bar", null, undefined, "baz")).toBe("foo baz");
  });

  it("应正确合并 Tailwind 冲突类", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-white", "bg-black")).toBe("bg-black");
  });

  it("应支持条件类名", () => {
    const active = true;
    const disabled = false;
    expect(cn("btn", active && "btn-active", disabled && "btn-disabled")).toBe(
      "btn btn-active",
    );
  });

  it("应支持数组和对象语法（clsx）", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("空输入返回空字符串", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });
});
