import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import ResourcesPage from "../page";
import { createClient } from "@/lib/supabase";
import { getResources, type Resource } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getResources: vi.fn() }));
vi.mock("@/components/SignImage", () => ({
  SignImage: ({ src }: { src: string }) =>
    React.createElement("img", { src, alt: "" }),
}));
vi.mock("@/components/TabBar", () => ({
  TabBar: () => React.createElement("div", { "data-testid": "tabbar" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue("he"),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetResources = vi.mocked(getResources);

function makeClient(user: { id: string } | null = { id: "u1" }) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) } };
}

function makeResource(overrides: Partial<Resource>): Resource {
  return {
    id: "r0",
    href: "https://example.com/",
    section: "official",
    order_index: 1,
    title_he: "title he",
    title_ar: "title ar",
    description_he: "desc he",
    description_ar: "desc ar",
    icon_type: "char",
    icon_value: "?",
    icon_variant: "primary",
    ...overrides,
  };
}

const fixtures: Resource[] = [
  makeResource({
    id: "r1",
    href: "https://www.gov.il/he/pages/tamrurim_7924_01_18",
    order_index: 1,
    title_he: "signs chart he",
    title_ar: "signs chart ar",
    icon_type: "sign",
    icon_value: "/signs/sign-301.png",
    icon_variant: "neutral",
  }),
  makeResource({
    id: "r2",
    href: "https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data",
    order_index: 2,
    title_he: "question bank he",
    title_ar: null,
    icon_value: "?",
    icon_variant: "primary",
  }),
  makeResource({
    id: "r3",
    href: "https://m.noeg.co.il/",
    section: "practice",
    order_index: 1,
    title_he: "simulator he",
    title_ar: "simulator ar",
    icon_value: "V",
    icon_variant: "success",
  }),
  makeResource({
    id: "r4",
    href: "https://he.wikipedia.org/wiki/%D7%AA%D7%9E%D7%A8%D7%95%D7%A8%D7%99%D7%9D_%D7%91%D7%99%D7%A9%D7%A8%D7%90%D7%9C",
    section: "practice",
    order_index: 2,
    title_he: "wikipedia he",
    title_ar: "wikipedia ar",
    icon_value: "W",
    icon_variant: "muted",
  }),
];

describe("ResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(makeClient() as never);
    mockGetResources.mockResolvedValue(fixtures);
    vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never);
    vi.mocked(getLocale).mockResolvedValue("he");
  });

  it("redirects to /auth/login when not authenticated", async () => {
    mockCreateClient.mockResolvedValue(makeClient(null) as never);
    await expect(ResourcesPage()).rejects.toThrow("redirect");
  });

  it("renders all four external links with target=_blank", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const externalLinks = container.querySelectorAll("a[target='_blank']");
    expect(externalLinks).toHaveLength(4);
  });

  it("renders link to the official government signs chart with its sign icon", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector(
      'a[href="https://www.gov.il/he/pages/tamrurim_7924_01_18"]'
    );
    expect(link).toBeTruthy();
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link!.querySelector('img[src="/signs/sign-301.png"]')).toBeTruthy();
  });

  it("renders link to the official question bank", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector(
      'a[href="https://www.gov.il/he/departments/dynamiccollectors/theoryexamhe_data"]'
    );
    expect(link).toBeTruthy();
  });

  it("renders link to noeg.co.il practice simulator", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector('a[href="https://m.noeg.co.il/"]');
    expect(link).toBeTruthy();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders link to Hebrew Wikipedia signs article", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    const link = container.querySelector('a[href*="wikipedia.org"]');
    expect(link).toBeTruthy();
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders resource titles from the DB rows", async () => {
    const jsx = await ResourcesPage();
    render(jsx);
    expect(screen.getByText("signs chart he")).toBeInTheDocument();
    expect(screen.getByText("question bank he")).toBeInTheDocument();
    expect(screen.getByText("simulator he")).toBeInTheDocument();
    expect(screen.getByText("wikipedia he")).toBeInTheDocument();
  });

  it("renders Arabic fields for the ar locale, falling back to Hebrew", async () => {
    vi.mocked(getLocale).mockResolvedValue("ar");
    const jsx = await ResourcesPage();
    render(jsx);
    expect(screen.getByText("signs chart ar")).toBeInTheDocument();
    // the question bank row has no Arabic translation, so the Hebrew text is shown
    expect(screen.getByText("question bank he")).toBeInTheDocument();
  });

  it("renders no resource links when the table is empty", async () => {
    mockGetResources.mockResolvedValue([]);
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    expect(container.querySelectorAll("a[target='_blank']")).toHaveLength(0);
  });

  it("renders the TabBar", async () => {
    const jsx = await ResourcesPage();
    const { container } = render(jsx);
    expect(container.querySelector('[data-testid="tabbar"]')).toBeTruthy();
  });

  it("renders page heading (pageTitle key)", async () => {
    const jsx = await ResourcesPage();
    render(jsx);
    expect(screen.getByText("pageTitle")).toBeInTheDocument();
  });
});
