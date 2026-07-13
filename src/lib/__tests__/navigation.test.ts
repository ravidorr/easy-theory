import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl/navigation", () => ({
  createNavigation: vi.fn().mockReturnValue({
    Link: "MockLink",
    redirect: vi.fn(),
    usePathname: vi.fn(),
    useRouter: vi.fn(),
    permanentRedirect: vi.fn(),
  }),
}));

vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["he", "ar"], defaultLocale: "he" },
}));

describe("navigation", () => {
  it("exports Link", async () => {
    const { Link } = await import("../navigation");
    expect(Link).toBeDefined();
  });

  it("exports redirect", async () => {
    const { redirect } = await import("../navigation");
    expect(redirect).toBeDefined();
  });

  it("exports usePathname", async () => {
    const { usePathname } = await import("../navigation");
    expect(usePathname).toBeDefined();
  });

  it("exports useRouter", async () => {
    const { useRouter } = await import("../navigation");
    expect(useRouter).toBeDefined();
  });

  it("exports permanentRedirect", async () => {
    const { permanentRedirect } = await import("../navigation");
    expect(permanentRedirect).toBeDefined();
  });

  it("calls createNavigation with routing config", async () => {
    const { createNavigation } = await import("next-intl/navigation");
    const { routing } = await import("@/i18n/routing");
    expect(createNavigation).toHaveBeenCalledWith(routing);
  });
});
