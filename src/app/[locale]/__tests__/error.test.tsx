import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import * as Sentry from "@sentry/nextjs";
import LocaleError from "../error";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("LocaleError ([locale] error boundary)", () => {
  const error = Object.assign(new Error("boom"), { digest: "d1" });
  const reset = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the translated headline, support line, and home link", () => {
    render(<LocaleError error={error} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("headline");
    expect(screen.getByText("support")).toBeInTheDocument();
    expect(screen.getByText("backHome").closest("a")).toHaveAttribute("href", "/");
  });

  it("logs the error for diagnostics", () => {
    render(<LocaleError error={error} reset={reset} />);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it("reports the error to the tracker", () => {
    render(<LocaleError error={error} reset={reset} />);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("calls reset when the retry button is clicked", () => {
    render(<LocaleError error={error} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
