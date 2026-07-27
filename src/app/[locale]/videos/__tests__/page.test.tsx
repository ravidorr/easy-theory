import { expect, it, vi } from "vitest";
import VideosPage from "../page";
import { permanentRedirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(() => { throw new Error("redirect"); }),
}));

it("permanently redirects legacy videos links to resources", () => {
  expect(() => VideosPage()).toThrow("redirect");
  expect(permanentRedirect).toHaveBeenCalledWith("/resources");
});
