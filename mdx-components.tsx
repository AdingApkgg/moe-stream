import type { MDXComponents } from "mdx/types";
import { getMDXComponents } from "@/components/mdx/mdx-components";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return getMDXComponents(components);
}
