import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import FlashcardsPage from "../page";
import { createClient } from "@/lib/supabase";
import { getSigns } from "@/lib/db";
import { getTranslations, getLocale } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getSigns: vi.fn() }));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
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

  it("trims name at first comma when name contains a comma", async () => {
    const sign = { ...SIGN_1, name_he: "חנייה אסורה, מוחלטת" };
    mockGetSigns.mockResolvedValue([sign] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByRole("heading", { name: "חנייה אסורה" })).toBeInTheDocument();
  });

  it("falls back to the localized signBadge label for a purely-numeric name_he", async () => {
    const numericSign = { ...SIGN_1, name_he: "9999" };
    mockGetSigns.mockResolvedValue([numericSign] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByRole("heading", { name: "תמרור 301" })).toBeInTheDocument();
  });

  it("truncates long sign names with ellipsis", async () => {
    const longSign = {
      ...SIGN_1,
      name_he: "שם תמרור ארוך מאוד שחייב להיות מקוצר כי הוא חורג מחמישים וחמישה תווים",
    };
    mockGetSigns.mockResolvedValue([longSign] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    const heading = screen.getByRole("heading");
    expect(heading.textContent).toContain("…");
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
  });

  it("uses name_ar for ar locale and falls back to name_he when missing", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar" as never);
    const signAr = { ...SIGN_1, name_ar: "ممنوع الوقوف" };
    mockGetSigns.mockResolvedValue([signAr, SIGN_2] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("ممنوع الوقوف")).toBeInTheDocument();
    expect(screen.getByText("עצור")).toBeInTheDocument();
  });
});
