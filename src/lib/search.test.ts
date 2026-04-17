import { describe, it, expect } from "vitest";
import { buildHighlightSegments, splitSearchTokens } from "@/lib/search-text";

describe("splitSearchTokens", () => {
  it("按空格分词并去空", () => {
    expect(splitSearchTokens("  a  b ")).toEqual(["a", "b"]);
  });
});

describe("buildHighlightSegments", () => {
  it("无关键词时整段非高亮", () => {
    expect(buildHighlightSegments("你好", "")).toEqual([{ text: "你好", hit: false }]);
  });

  it("忽略大小写高亮", () => {
    expect(buildHighlightSegments("Hello World", "hello")).toEqual([
      { text: "Hello", hit: true },
      { text: " World", hit: false },
    ]);
  });

  it("多词分别高亮", () => {
    const segs = buildHighlightSegments("ab cd ab", "ab cd");
    const hits = segs.filter((s) => s.hit).map((s) => s.text);
    expect(hits.join("")).toContain("ab");
    expect(hits.join("")).toContain("cd");
  });
});
