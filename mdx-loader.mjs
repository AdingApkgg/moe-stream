import { compile } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";

export default async function mdxLoader(source) {
  const callback = this.async();
  try {
    const result = await compile(source, {
      remarkPlugins: [remarkGfm],
      jsx: true,
      outputFormat: "program",
      providerImportSource: "@mdx-js/react",
      development: process.env.NODE_ENV === "development",
    });
    callback(null, String(result));
  } catch (err) {
    callback(err);
  }
}
