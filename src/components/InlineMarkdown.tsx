import type { ReactNode } from "react";
import Markdown from "react-markdown";

type InlineMarkdownProps = {
  children: string;
};

// Paragraphs are unwrapped so the output stays valid inside <span>/<button>.
const components = {
  p: ({ children }: { children?: ReactNode }) => <>{children}</>,
};

const allowedElements = ["p", "strong", "em", "br"];

export function InlineMarkdown({ children }: InlineMarkdownProps) {
  return (
    <Markdown allowedElements={allowedElements} unwrapDisallowed components={components}>
      {children}
    </Markdown>
  );
}
