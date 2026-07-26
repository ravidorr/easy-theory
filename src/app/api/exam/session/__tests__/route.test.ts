import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "../route";
import { createClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const QUESTION_ID = "22222222-2222-4222-8222-222222222222";

function request(body: object) {
  return new Request("http://localhost/api/exam/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/exam/session", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: 1, error: null });
    mockCreateClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      rpc,
    } as never);
  });

  it("accepts standard UUIDs and forwards a complete snapshot to the atomic RPC", async () => {
    const response = await PATCH(request({
      session_id: SESSION_ID,
      revision: 0,
      answers: { [QUESTION_ID]: "a" },
      current_index: 0,
      marked_question_ids: [QUESTION_ID],
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("update_exam_session", {
      p_session_id: SESSION_ID,
      p_revision: 0,
      p_answers: { [QUESTION_ID]: "a" },
      p_current_index: 0,
      p_marked_question_ids: [QUESTION_ID],
    });
  });
});
