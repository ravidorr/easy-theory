export type FeatureFlag =
  | "exam_sessions"
  | "guest_diagnostic"
  | "personalized_plan"
  | "core_navigation";

const DEFAULTS: Record<FeatureFlag, number> = {
  exam_sessions: 100,
  guest_diagnostic: 100,
  personalized_plan: 100,
  core_navigation: 100,
};

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function featureEnabled(flag: FeatureFlag, subject: string): boolean {
  const raw = process.env[`FEATURE_${flag.toUpperCase()}_PERCENT`];
  const percent = raw === undefined ? DEFAULTS[flag] : Number(raw);
  if (!Number.isFinite(percent)) return false;
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  return hash(`${flag}:${subject}`) % 100 < percent;
}
