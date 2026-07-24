import { existsSync } from "fs";
import { join } from "path";

export function resolveOptionSignImage(text: string, isSignsTopic: boolean): string | null {
  if (!isSignsTopic || !/^\d{2,4}$/.test(text.trim())) return null;

  const path = join(process.cwd(), "public", "signs", `sign-${text.trim()}.png`);
  return existsSync(path) ? `/signs/sign-${text.trim()}.png` : null;
}
