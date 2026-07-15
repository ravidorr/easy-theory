import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import FlashcardsPage from "../page";
import { createClient } from "@/lib/supabase";
import { getSigns, getSignSrsCards } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getSigns: vi.fn(), getSignSrsCards: vi.fn() }));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));
// Echo keys, except signBadge which interpolates so the numeric-name
// fallback test can verify the sign number is threaded through.
// vi.hoisted so the vi.mock factory (hoisted to the top) can reference it.
const echoTranslator = vi.hoisted(
  () => (key: string, values?: Record<string, unknown>) =>
    key === "signBadge" && values ? `תמרור ${values.number}` : key
);

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue(echoTranslator),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetSigns = vi.mocked(getSigns);
const mockGetSignSrsCards = vi.mocked(getSignSrsCards);

function srsCard(signId: string, dueAt: string) {
  return {
    sign_id: signId,
    question_id: null,
    ease: 2.5,
    interval_days: 1,
    repetitions: 1,
    due_at: dueAt,
    last_reviewed_at: dueAt,
  };
}

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const SIGN_1 = {
  id: "s1",
  sign_number: "301",
  name_he: "חנייה אסורה",
  image_path: "/signs/sign-301.png",
};
const SIGN_2 = {
  id: "s2",
  sign_number: "205",
  name_he: "עצור",
  image_path: "/signs/sign-205.png",
};

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

describe("FlashcardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetSigns.mockResolvedValue([]);
    mockGetSignSrsCards.mockResolvedValue([]);
    vi.mocked(getTranslations).mockResolvedValue(echoTranslator as never);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(FlashcardsPage()).rejects.toThrow("redirect");
  });

  it("shows cardCount key in header", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    // t("cardCount", { current: 1, total }) returns "cardCount"
    expect(screen.getByText("cardCount")).toBeInTheDocument();
  });

  it("renders sign name on back face of card", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("חנייה אסורה")).toBeInTheDocument();
  });

  it("renders sign badge label on back face", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    // t("signBadge", { number: "301" }) returns "תמרור 301"
    expect(screen.getByText("תמרור 301")).toBeInTheDocument();
  });

  it("renders flip hint on front face", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    // t("flipHint") returns "flipHint"
    expect(screen.getByText("flipHint")).toBeInTheDocument();
  });

  it("exposes the flip control as an accessible button", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    const flipControl = screen.getByRole("button", { name: "flipHint" });
    expect(flipControl).toHaveAttribute("aria-expanded", "false");
    expect(flipControl.querySelector(".flashcard-back-face")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("trims name at first comma when name contains a comma", async () => {
    const sign = { ...SIGN_1, name_he: "חנייה אסורה, מוחלטת" };
    mockGetSigns.mockResolvedValue([sign] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector("#fc-name")).toHaveTextContent("חנייה אסורה");
  });

  it("falls back to the localized signBadge label for a purely-numeric name_he", async () => {
    const numericSign = { ...SIGN_1, name_he: "9999" };
    mockGetSigns.mockResolvedValue([numericSign] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector("#fc-name")).toHaveTextContent("תמרור 301");
  });

  it("truncates long sign names with ellipsis", async () => {
    const longSign = {
      ...SIGN_1,
      name_he: "שם תמרור ארוך מאוד שחייב להיות מקוצר כי הוא חורג מחמישים וחמישה תווים",
    };
    mockGetSigns.mockResolvedValue([longSign] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector("#fc-name")!.textContent).toContain("…");
  });

  it("renders back link to home (/)", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
  });

  it("gives the icon-only back link an accessible name", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector("a[aria-label='backLabel']")).toBeTruthy();
  });

  it("renders btnYes and btnNo buttons", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("btnYes")).toBeInTheDocument();
    expect(screen.getByText("btnNo")).toBeInTheDocument();
  });

  it("renders 0% progress width when there are no signs", async () => {
    mockGetSigns.mockResolvedValue([]);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    const progress = container.querySelector<HTMLElement>("#fc-progress");
    expect(progress?.style.width).toBe("0%");
    expect(container.querySelectorAll(".flashcard-wrap")).toHaveLength(0);
    expect(JSON.parse(container.querySelector("#fc-data")!.textContent!)).toEqual([]);
  });

  it("renders only the first card even with multiple signs", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    const cards = container.querySelectorAll(".flashcard-wrap");
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector("img")?.getAttribute("src")).toBe(SIGN_1.image_path);
  });

  it("exposes the DOM hooks flashcard.js relies on", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector(".fc-front-img")).toBeTruthy();
    expect(container.querySelector(".fc-back-img")).toBeTruthy();
    expect(container.querySelector("#fc-name")).toBeTruthy();
    expect(container.querySelector("#fc-badge")).toBeTruthy();
  });

  it("embeds all signs in the #fc-data JSON payload", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    const data = JSON.parse(container.querySelector("#fc-data")!.textContent!);
    expect(data).toEqual([
      {
        id: "s1",
        img: "/signs/sign-301.png",
        alt: "חנייה אסורה",
        name: "חנייה אסורה",
        badge: "תמרור 301",
      },
      {
        id: "s2",
        img: "/signs/sign-205.png",
        alt: "עצור",
        name: "עצור",
        badge: "תמרור 205",
      },
    ]);
  });

  it("orders the deck due-first, then never-seen, then not-yet-due", async () => {
    const SIGN_3 = { ...SIGN_1, id: "s3", sign_number: "410", image_path: "/signs/sign-410.png" };
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2, SIGN_3] as never);
    // s1 reviewed but not due yet; s3 due; s2 never seen.
    mockGetSignSrsCards.mockResolvedValue([srsCard("s1", FUTURE), srsCard("s3", PAST)] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    const data = JSON.parse(container.querySelector("#fc-data")!.textContent!);
    expect(data.map((c: { id: string }) => c.id)).toEqual(["s3", "s2", "s1"]);
    // The server-rendered first card matches the reordered deck.
    const firstCard = container.querySelector(".flashcard-wrap img");
    expect(firstCard?.getAttribute("src")).toBe(SIGN_3.image_path);
  });

  it("orders due cards by oldest due date first", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    mockGetSignSrsCards.mockResolvedValue([
      srsCard("s1", "2021-01-01T00:00:00.000Z"),
      srsCard("s2", PAST),
    ] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    const data = JSON.parse(container.querySelector("#fc-data")!.textContent!);
    expect(data.map((c: { id: string }) => c.id)).toEqual(["s2", "s1"]);
  });

  it("shows the dueToday note only when cards are due", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    mockGetSignSrsCards.mockResolvedValue([srsCard("s1", PAST)] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    // t("dueToday", { count }) echoes the key.
    expect(screen.getByText("dueToday")).toBeInTheDocument();
  });

  it("hides the dueToday note when nothing is due", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    mockGetSignSrsCards.mockResolvedValue([srsCard("s1", FUTURE)] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.queryByText("dueToday")).not.toBeInTheDocument();
  });

  it("applies cleanName to payload names and escapes < in the JSON", async () => {
    const signs = [
      SIGN_1,
      { ...SIGN_2, name_he: "עצור, תמיד" },
      { ...SIGN_2, id: "s3", sign_number: "206", name_he: "9999" },
      { ...SIGN_2, id: "s4", sign_number: "207", name_he: "a<script>b" },
    ];
    mockGetSigns.mockResolvedValue(signs as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    const raw = container.querySelector("#fc-data")!.textContent!;
    expect(raw).not.toContain("<script");
    const data = JSON.parse(raw);
    expect(data[1].name).toBe("עצור");
    expect(data[2].name).toBe("תמרור 206");
    expect(data[3].alt).toBe("a<script>b");
  });

  it("uses name_ar for ar locale and falls back to name_he when missing", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const signAr = { ...SIGN_1, name_ar: "ممنوع الوقوف" };
    mockGetSigns.mockResolvedValue([signAr, SIGN_2] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(screen.getByText("ممنوع الوقوف")).toBeInTheDocument();
    const data = JSON.parse(container.querySelector("#fc-data")!.textContent!);
    expect(data[0].name).toBe("ممنوع الوقوف");
    expect(data[1].name).toBe("עצור");
  });
});
