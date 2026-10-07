import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { trackPendoEvent } from "@/lib/pendo-client";
import { ContactForm } from "../ContactForm";

vi.mock("@/lib/pendo-client", () => ({ trackPendoEvent: vi.fn() }));

const messages = {
  Contact: {
    topicTitle: "topicTitle",
    topicQuestion: "topicQuestion",
    topicBug: "topicBug",
    topicIdea: "topicIdea",
    topicGeneral: "topicGeneral",
    messageTitle: "messageTitle",
    messagePlaceholder: "messagePlaceholder",
    replyEmailPlaceholder: "replyEmailPlaceholder",
    replyEmailHint: "replyEmailHint",
    submit: "submit",
    submitting: "submitting",
    sendFailed: "sendFailed",
    sentTitle: "sentTitle",
    sentMessage: "sentMessage",
    sendAnother: "sendAnother",
  },
};

function renderForm() {
  return render(
    <NextIntlClientProvider locale="he" messages={messages}>
      <ContactForm />
    </NextIntlClientProvider>
  );
}

describe("ContactForm", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("starts with the question topic", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "topicQuestion" })).toHaveAttribute("aria-pressed", "true");
  });

  it("changes topic chips", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "topicBug" }));
    expect(screen.getByRole("button", { name: "topicBug" })).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores duplicate submit attempts while the first request is pending", async () => {
    let resolveFetch: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Need help" } });
    const submitButton = screen.getByRole("button", { name: "submit" });
    fireEvent.submit(submitButton.closest("form")!);
    submitButton.removeAttribute("disabled");
    fireEvent.submit(submitButton.closest("form")!);

    resolveFetch!({ ok: true, json: async () => ({ ok: true }) } as Response);
    await waitFor(() => expect(screen.getByText("sentTitle")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("submits the selected topic and shows the sent state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "topicIdea" }));
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Helpful idea" } });
    fireEvent.change(screen.getByPlaceholderText("replyEmailPlaceholder"), { target: { value: "reply@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => expect(screen.getByText("sentTitle")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic: "idea", message: "Helpful idea", reply_email: "reply@example.com" }),
      })
    );
  });

  it("shows the API error and preserves the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "apiError" }) }));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Need help" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("apiError"));
    expect(screen.getByPlaceholderText("messagePlaceholder")).toHaveValue("Need help");
    expect(trackPendoEvent).not.toHaveBeenCalled();
  });

  it("tracks a sent message by topic and length, never its text or reply address", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "topicBug" }));
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "  It broke  " } });
    fireEvent.change(screen.getByPlaceholderText("replyEmailPlaceholder"), { target: { value: "reply@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => expect(screen.getByText("sentTitle")).toBeInTheDocument());
    expect(trackPendoEvent).toHaveBeenCalledTimes(1);
    expect(trackPendoEvent).toHaveBeenCalledWith("contact_message_sent", {
      topic: "bug",
      message_length: 8,
      has_reply_email: true,
      locale: "he",
    });
  });

  it("falls back to the generic error when the API error payload is not text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: null }) }));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Need help" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sendFailed"));
  });

  it("falls back to the generic error when the API response cannot be decoded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error("invalid JSON"); } }));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Need help" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sendFailed"));
  });

  it("falls back to the generic error when submission rejects with a non-Error value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network unavailable"));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Need help" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("sendFailed"));
  });

  it("resets the sent state to the default form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText("messagePlaceholder"), { target: { value: "Need help" } });
    fireEvent.submit(screen.getByRole("button", { name: "submit" }).closest("form")!);
    await waitFor(() => expect(screen.getByText("sentTitle")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "sendAnother" }));

    expect(screen.getByPlaceholderText("messagePlaceholder")).toHaveValue("");
    expect(screen.getByRole("button", { name: "topicQuestion" })).toHaveAttribute("aria-pressed", "true");
  });
});
