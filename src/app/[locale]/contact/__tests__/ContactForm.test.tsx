import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { ContactForm } from "../ContactForm";

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
  });

  it("falls back to the generic error when the API error payload is not text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: null }) }));
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
