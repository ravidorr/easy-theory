import type { IconName } from "@/components/Icon";

export const DEFAULT_AUTO_ADVANCE_DELAY_MS = 1125;
export const MIN_AUTO_ADVANCE_DELAY_MS = 750;
export const MAX_AUTO_ADVANCE_DELAY_MS = 3000;
export const AUTO_ADVANCE_DELAY_STEP_MS = 125;

export type MoreMedal = {
  medal_slug: string;
  earned_at: string;
};

export type MoreMedalItem = {
  slug: string;
  label: string;
  icon: IconName;
  earned: boolean;
  dateText: string;
};

type Translate = (key: string) => string;

const MILESTONE_META: ReadonlyArray<{ slug: string; labelKey: string; icon: IconName }> = [
  { slug: "streak-3", labelKey: "milestone3", icon: "flame" },
  { slug: "streak-7", labelKey: "milestone7", icon: "star" },
  { slug: "streak-14", labelKey: "milestone14", icon: "gem" },
  { slug: "streak-30", labelKey: "milestone30", icon: "trophy" },
];

const ACHIEVEMENT_META: ReadonlyArray<{ slug: string; labelKey: string; icon: IconName }> = [
  { slug: "first-topic", labelKey: "achFirstTopic", icon: "check" },
  { slug: "questions-100", labelKey: "achQuestions100", icon: "cards" },
  { slug: "all-topics", labelKey: "achAllTopics", icon: "globe" },
  { slug: "exam-pass", labelKey: "achExamPass", icon: "timer" },
];

export function autoAdvanceDelay(value: string | undefined): number {
  const delay = Number(value);
  return Number.isInteger(delay) &&
    delay >= MIN_AUTO_ADVANCE_DELAY_MS &&
    delay <= MAX_AUTO_ADVANCE_DELAY_MS &&
    (delay - MIN_AUTO_ADVANCE_DELAY_MS) % AUTO_ADVANCE_DELAY_STEP_MS === 0
    ? delay
    : DEFAULT_AUTO_ADVANCE_DELAY_MS;
}

export function buildMoreMedalItems({
  medals,
  locale,
  translate,
}: {
  medals: ReadonlyArray<MoreMedal>;
  locale: string;
  translate: Translate;
}): MoreMedalItem[] {
  const earnedDateBySlug = new Map(medals.map(({ medal_slug, earned_at }) => [medal_slug, earned_at]));
  const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-IL" : "he-IL", {
    day: "numeric",
    month: "short",
  });

  return [...MILESTONE_META, ...ACHIEVEMENT_META].map(({ slug, labelKey, icon }) => {
    const earnedAt = earnedDateBySlug.get(slug);
    return {
      slug,
      label: translate(labelKey),
      icon,
      earned: earnedAt !== undefined,
      dateText: earnedAt ? dateFormatter.format(new Date(earnedAt)) : translate("medalLockedLabel"),
    };
  });
}
