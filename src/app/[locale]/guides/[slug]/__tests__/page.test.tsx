import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import GuidePage, { generateMetadata, generateStaticParams } from "../page";
import { createClient } from "@/lib/supabase";
import { getLatestSourceRelease } from "@/lib/db";
import { formatSourceRelease } from "@/lib/source-release";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("notFound"); }),
}));
vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getLatestSourceRelease: vi.fn() }));
vi.mock("@/lib/source-release", () => ({
  OFFICIAL_QUESTION_BANK_URL: "https://gov.il/question-bank",
  formatSourceRelease: vi.fn(() => "source release"),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) =>
    React.createElement("a", { href, ...props }, children),
}));

const mockCreateClient = vi.mocked(createClient);
const mockGetLatestSourceRelease = vi.mocked(getLatestSourceRelease);
const mockFormatSourceRelease = vi.mocked(formatSourceRelease);

describe("GuidePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({} as never);
    mockGetLatestSourceRelease.mockResolvedValue(null);
  });

  it("exports every supported guide slug and metadata for a valid guide", async () => {
    expect(generateStaticParams()).toEqual([
      { slug: "signs" }, { slug: "traffic-laws" }, { slug: "safety" }, { slug: "vehicle" },
    ]);
    await expect(generateMetadata({ params: Promise.resolve({ slug: "signs" }) })).resolves.toMatchObject({
      title: "תמרורי דרך: איך לומדים נכון למבחן התיאוריה",
      alternates: { canonical: "/he/guides/signs" },
    });
    await expect(generateMetadata({ params: Promise.resolve({ slug: "unknown" }) })).resolves.toEqual({});
  });

  it("renders a guide and conditionally includes the formatted source release", async () => {
    mockGetLatestSourceRelease.mockResolvedValue({ id: "release-1" } as never);
    const { container } = render(await GuidePage({ params: Promise.resolve({ slug: "signs" }) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("תמרורי דרך");
    expect(container.querySelector('a[href="/topics/signs"]')).toBeTruthy();
    expect(mockFormatSourceRelease).toHaveBeenCalledWith(expect.objectContaining({ id: "release-1" }), "he");
    expect(screen.getByText("source release")).toBeInTheDocument();
  });

  it("uses notFound for an unsupported guide", async () => {
    await expect(GuidePage({ params: Promise.resolve({ slug: "unknown" }) })).rejects.toThrow("notFound");
  });
});
