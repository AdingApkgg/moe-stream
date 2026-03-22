import { describe, it, expect } from "vitest";
import { formatDuration, formatViews } from "../format";

describe("formatDuration", () => {
  it("应正确格式化纯秒数", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(59)).toBe("0:59");
  });

  it("应正确格式化分秒", () => {
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(3599)).toBe("59:59");
  });

  it("超过 1 小时应显示时:分:秒", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
    expect(formatDuration(7384)).toBe("2:03:04");
    expect(formatDuration(36000)).toBe("10:00:00");
  });

  it("应对小数秒取整", () => {
    expect(formatDuration(90.7)).toBe("1:30");
    expect(formatDuration(59.99)).toBe("0:59");
  });
});

describe("formatViews", () => {
  it("小于 1 万直接显示数字", () => {
    expect(formatViews(0)).toBe("0");
    expect(formatViews(1)).toBe("1");
    expect(formatViews(999)).toBe("999");
    expect(formatViews(9999)).toBe("9999");
  });

  it("1 万以上显示 x.x 万", () => {
    expect(formatViews(10000)).toBe("1.0万");
    expect(formatViews(12345)).toBe("1.2万");
    expect(formatViews(99999)).toBe("10.0万");
    expect(formatViews(999999)).toBe("100.0万");
    expect(formatViews(9999999)).toBe("1000.0万");
  });

  it("1 亿以上显示 x.x 亿", () => {
    expect(formatViews(100000000)).toBe("1.0亿");
    expect(formatViews(123456789)).toBe("1.2亿");
    expect(formatViews(999999999)).toBe("10.0亿");
  });
});
