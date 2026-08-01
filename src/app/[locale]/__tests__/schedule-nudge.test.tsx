import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ScheduleNudge } from "../ScheduleNudge";

const push = vi.fn();

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

describe("ScheduleNudge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens only once per local day and records that it was shown", async () => {
    render(<ScheduleNudge hasSchedule={false} />);

    expect(await screen.findByRole("dialog")).toHaveAttribute("aria-labelledby", "schedule-nudge-title");
    expect(localStorage.getItem("scheduleNudge.lastSeen")).toBe(today());
    expect(screen.getByText("45 Schedule.durationUnit")).toBeInTheDocument();

    localStorage.setItem("scheduleNudge.lastSeen", today());
    const { container } = render(<ScheduleNudge hasSchedule={false} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("does not show for a learner who has a schedule", async () => {
    render(<ScheduleNudge hasSchedule />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("saves the fixed recommended schedule and shows the existing toast", async () => {
    const toast = vi.fn().mockResolvedValue(undefined);
    (window as Window & { modal?: { toast: typeof toast } }).modal = { toast };
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    render(<ScheduleNudge hasSchedule={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "ScheduleNudge.saveRecommended" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: [0, 2, 4],
          start_time: "17:00",
          duration_minutes: 45,
          notify: false,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith({ message: "JS.Schedule.savedToast" });
  });

  it("keeps the modal open with an error when saving fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    render(<ScheduleNudge hasSchedule={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "ScheduleNudge.saveRecommended" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Api.scheduleUpdateFailed");
    expect(screen.getByRole("button", { name: "ScheduleNudge.saveRecommended" })).toBeEnabled();
  });

  it("keeps focus inside the dialog while a save is in flight", async () => {
    let resolveFetch: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
    render(<ScheduleNudge hasSchedule={false} />);

    const primary = await screen.findByRole("button", { name: "ScheduleNudge.saveRecommended" });
    primary.focus();
    fireEvent.click(primary);

    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog).toHaveFocus());
    resolveFetch!({ ok: false } as Response);
    await screen.findByRole("alert");
  });

  it("routes to the full schedule editor without saving", async () => {
    render(<ScheduleNudge hasSchedule={false} />);

    fireEvent.click(await screen.findByRole("button", { name: "ScheduleNudge.customize" }));

    expect(push).toHaveBeenCalledWith("/schedule");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("dismisses on the later button, backdrop, and Escape while returning focus", async () => {
    const invokingButton = document.createElement("button");
    document.body.appendChild(invokingButton);
    invokingButton.focus();
    const { unmount } = render(<ScheduleNudge hasSchedule={false} />);

    const primary = await screen.findByRole("button", { name: "ScheduleNudge.saveRecommended" });
    expect(primary).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "ScheduleNudge.later" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(invokingButton).toHaveFocus();

    unmount();
    localStorage.clear();
    render(<ScheduleNudge hasSchedule={false} />);
    const scrim = (await screen.findByRole("dialog")).parentElement as HTMLElement;
    fireEvent.mouseDown(scrim);
    fireEvent.click(scrim);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    invokingButton.remove();
  });
});
