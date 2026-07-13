import { describe, it, expect } from "vitest";
import { parseJsonBody } from "../api";

function makeRequest(body: string) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("parseJsonBody", () => {
  it("returns the parsed object for a valid JSON object body", async () => {
    const result = await parseJsonBody(makeRequest('{"a": 1, "b": "x"}'));
    expect(result).toEqual({ a: 1, b: "x" });
  });

  it("returns null for malformed JSON", async () => {
    expect(await parseJsonBody(makeRequest("{not json"))).toBeNull();
  });

  it("returns null for an empty body", async () => {
    expect(await parseJsonBody(makeRequest(""))).toBeNull();
  });

  it("returns null for non-object JSON values", async () => {
    expect(await parseJsonBody(makeRequest("5"))).toBeNull();
    expect(await parseJsonBody(makeRequest('"text"'))).toBeNull();
    expect(await parseJsonBody(makeRequest("null"))).toBeNull();
    expect(await parseJsonBody(makeRequest("[1, 2]"))).toBeNull();
  });
});
