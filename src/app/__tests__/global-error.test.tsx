import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import GlobalError from "../global-error";
import heMessages from "../../../messages/he.json";
import arMessages from "../../../messages/ar.json";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("GlobalError (root error boundary)", () => {
  const error = Object.assign(new Error("boom"), { digest: "d1" });
  const reset = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    // Silences both the diagnostic log under test and React's warning about
    // rendering <html> outside the document root in jsdom.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders the shared Error strings in both languages", () => {
    render(<GlobalError error={error} reset={reset} />);
    expect(screen.getByText(heMessages.Error.headline)).toBeInTheDocument();
    expect(screen.getByText(heMessages.Error.support)).toBeInTheDocument();
    expect(screen.getByText(arMessages.Error.headline)).toBeInTheDocument();
    expect(screen.getByText(arMessages.Error.support)).toBeInTheDocument();
  });

  it("reports the error to the tracker and the console", () => {
    render(<GlobalError error={error} reset={reset} />);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it("calls reset when the retry button is clicked", () => {
    render(<GlobalError error={error} reset={reset} />);
    fireEvent.click(screen.getByRole("button"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
