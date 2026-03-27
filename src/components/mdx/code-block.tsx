import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  children: React.ReactNode;
}

async function highlight(code: string, lang: string) {
  return codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark-dimmed" },
    defaultColor: false,
  });
}

export async function CodeBlock({ children }: CodeBlockProps) {
  const codeElement = children as React.ReactElement<{
    className?: string;
    children?: string;
  }>;

  if (!codeElement?.props) {
    return <pre>{children}</pre>;
  }

  const { className, children: code } = codeElement.props;
  const lang = className?.replace("language-", "") || "plaintext";
  const codeStr = typeof code === "string" ? code.trim() : "";

  if (!codeStr) {
    return <pre>{children}</pre>;
  }

  const html = await highlight(codeStr, lang);

  return (
    <div className="mdx-code-block group relative my-3">
      <CopyButton code={codeStr} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
