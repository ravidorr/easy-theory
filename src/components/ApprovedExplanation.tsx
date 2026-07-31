import { InlineMarkdown } from "./InlineMarkdown";

type ApprovedExplanationProps = {
  text: string;
  sourceUrl: string;
  sourceLabel: string;
};

/**
 * Explanations are deliberately invisible until their release supplies a
 * pinned source URL. This keeps generated or otherwise unreviewed text out of
 * learner-facing study flows.
 */
export function ApprovedExplanation({
  text,
  sourceUrl,
  sourceLabel,
}: ApprovedExplanationProps) {
  return (
    <span className="quiz-option-explanation">
      <InlineMarkdown>{text}</InlineMarkdown>{" "}
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        {sourceLabel}
      </a>
    </span>
  );
}
