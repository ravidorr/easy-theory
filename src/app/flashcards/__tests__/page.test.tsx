import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import FlashcardsPage from "../page";
import { createClient } from "@/lib/supabase";
import { getSigns } from "@/lib/db";

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
  default: ({ href, children }: { href: string; children: unknown }) =>
    React.createElement("a", { href }, children as React.ReactNode),
}));
vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
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
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(FlashcardsPage()).rejects.toThrow("redirect");
  });

  it("shows 'כרטיס 1 מתוך N' count in header", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1, SIGN_2] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("כרטיס 1 מתוך 2")).toBeInTheDocument();
  });

  it("renders sign name on back face of card", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("חנייה אסורה")).toBeInTheDocument();
  });

  it("renders sign number label on back face", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("תמרור 301")).toBeInTheDocument();
  });

  it("renders 'הקליקי להיפוך' hint on front face", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText("הקליקי להיפוך")).toBeInTheDocument();
  });

  it("trims name at first comma when name contains a comma", async () => {
    const sign = { ...SIGN_1, name_he: "חנייה אסורה, מוחלטת" };
    mockGetSigns.mockResolvedValue([sign] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByRole("heading", { name: "חנייה אסורה" })).toBeInTheDocument();
  });

  it("converts a purely-numeric name_he to 'תמרור <sign_number>'", async () => {
    const numericSign = { ...SIGN_1, name_he: "9999" };
    mockGetSigns.mockResolvedValue([numericSign] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    // cleanName("9999", "301") → "תמרור 301" — h2 uses this
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
    // cleanName truncates at 55 chars and adds "…"
    const heading = screen.getByRole("heading");
    expect(heading.textContent).toContain("…");
  });

  it("renders back link to home (/)", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    const { container } = render(jsx);
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
  });

  it("renders 'ידעתי ✓' and 'עוד לא' buttons", async () => {
    mockGetSigns.mockResolvedValue([SIGN_1] as never);
    const jsx = await FlashcardsPage();
    render(jsx);
    expect(screen.getByText(/ידעתי/)).toBeInTheDocument();
    expect(screen.getByText("עוד לא")).toBeInTheDocument();
  });
});
