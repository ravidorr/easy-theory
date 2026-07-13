import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageToggle } from "../LanguageToggle";

const mockReplace = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useLocale: vi.fn().mockReturnValue("he"),
}));

vi.mock("@/lib/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/he/more"),
  useRouter: vi.fn().mockReturnValue({ replace: mockReplace }),
}));

import { useLocale } from "next-intl";
import { usePathname } from "@/lib/navigation";

describe("LanguageToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLocale).mockReturnValue("he");
    vi.mocked(usePathname).mockReturnValue("/he/more");
  });

  it("shows العربية when locale is he", () => {
    render(<LanguageToggle />);
    expect(screen.getByRole("button")).toHaveTextContent("العربية");
  });

  it("shows עברית when locale is ar", () => {
    vi.mocked(useLocale).mockReturnValue("ar");
    render(<LanguageToggle />);
    expect(screen.getByRole("button")).toHaveTextContent("עברית");
  });

  it("has aria-label Switch to Arabic when locale is he", () => {
    render(<LanguageToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to Arabic");
  });

  it("has aria-label Switch to Hebrew when locale is ar", () => {
    vi.mocked(useLocale).mockReturnValue("ar");
    render(<LanguageToggle />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to Hebrew");
  });

  it("calls router.replace with ar locale when clicked from he", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith("/he/more", { locale: "ar" });
  });

  it("calls router.replace with he locale when clicked from ar", () => {
    vi.mocked(useLocale).mockReturnValue("ar");
    vi.mocked(usePathname).mockReturnValue("/ar/more");
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith("/ar/more", { locale: "he" });
  });
});
