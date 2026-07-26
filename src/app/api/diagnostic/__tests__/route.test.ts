import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { createAdminClient, createClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ createAdminClient: vi.fn(), createClient: vi.fn() }));

const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockCreateClient = vi.mocked(createClient);
const questionId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

describe("POST /api/diagnostic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const questions = Array.from({ length: 12 }, (_, index) => ({
      id: questionId(index), topic_id: "topic-1", correct_option: "a",
    }));
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: questions, error: null }) }),
      }),
    } as never);
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);
  });

  it("accepts a complete guest diagnostic with standard UUID question ids", async () => {
    const answers = Array.from({ length: 12 }, (_, index) => ({
      question_id: questionId(index), selected_option: "a",
    }));
    const response = await POST(new Request("http://localhost/api/diagnostic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ saved: false, topic_scores: { "topic-1": { correct: 12, total: 12 } } });
  });

  it("returns a failure when the atomic authenticated save fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "write failed" } });
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      rpc,
    } as never);
    const answers = Array.from({ length: 12 }, (_, index) => ({
      question_id: questionId(index), selected_option: "a",
    }));

    const response = await POST(new Request("http://localhost/api/diagnostic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, target_exam_date: "2026-08-01" }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "שמירת ההתקדמות נכשלה" });
    expect(rpc).toHaveBeenCalledWith("complete_diagnostic", expect.objectContaining({
      p_target_exam_date: "2026-08-01",
    }));
  });
});
