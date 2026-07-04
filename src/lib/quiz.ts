export const STREAK_MILESTONES = [3, 7, 14, 30];
export const POINTS_PER_CORRECT = 10;

export function computeNewStreak(
  currentStreak: number,
  lastActiveDate: string | null,
  today: string,
  yesterday: string
): number {
  if (lastActiveDate === today) return currentStreak;
  if (lastActiveDate === yesterday) return currentStreak + 1;
  return 1;
}

export function isMilestoneReached(
  newStreak: number,
  oldStreak: number,
  milestones: number[]
): boolean {
  return newStreak !== oldStreak && milestones.includes(newStreak);
}
