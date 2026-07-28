import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type TabBarRoute = {
  file: string;
  active: "home" | "practice" | "exam" | "progress" | "more";
  child?: boolean;
};

const routes: TabBarRoute[] = [
  { file: "page.tsx", active: "home" },
  { file: "loading.tsx", active: "home" },
  { file: "not-found.tsx", active: "home" },
  { file: "error.tsx", active: "home", child: true },
  { file: "practice/page.tsx", active: "practice" },
  { file: "diagnostic/page.tsx", active: "practice", child: true },
  { file: "mistakes/page.tsx", active: "practice", child: true },
  { file: "flashcards/page.tsx", active: "practice", child: true },
  { file: "flashcards/loading.tsx", active: "practice", child: true },
  { file: "topics/[slug]/page.tsx", active: "practice", child: true },
  { file: "topics/[slug]/loading.tsx", active: "practice", child: true },
  { file: "topics/[slug]/retry/page.tsx", active: "practice", child: true },
  { file: "topics/[slug]/review/page.tsx", active: "practice", child: true },
  { file: "topics/[slug]/review/loading.tsx", active: "practice", child: true },
  { file: "exam/page.tsx", active: "exam" },
  { file: "exam/loading.tsx", active: "exam" },
  { file: "exam/run/page.tsx", active: "exam", child: true },
  { file: "exam/run/loading.tsx", active: "exam", child: true },
  { file: "progress/page.tsx", active: "progress" },
  { file: "more/page.tsx", active: "more" },
  { file: "more/loading.tsx", active: "more" },
  { file: "schedule/page.tsx", active: "more", child: true },
  { file: "schedule/loading.tsx", active: "more", child: true },
  { file: "resources/page.tsx", active: "more", child: true },
  { file: "resources/loading.tsx", active: "more", child: true },
  { file: "bookmarks/page.tsx", active: "more", child: true },
  { file: "bookmarks/loading.tsx", active: "more", child: true },
  { file: "credits/page.tsx", active: "more", child: true },
  { file: "credits/loading.tsx", active: "more", child: true },
  { file: "contact/page.tsx", active: "more", child: true },
];

describe("localized route TabBar selection", () => {
  it.each(routes)("maps $file to the $active section", ({ file, active, child }) => {
    const source = readFileSync(resolve(__dirname, "..", file), "utf8");
    const tabBar = child ? "(?:Client)?TabBar" : "TabBar";
    const current = child ? " current=\\{null\\}" : "";

    expect(source).toMatch(new RegExp(`<${tabBar} active="${active}"${current} ?/>`));
  });
});
