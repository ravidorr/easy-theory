import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import LoginPage from "../page";

vi.mock("next/script", () => ({
  default: () => React.createElement("div", null),
}));

describe("LoginPage", () => {
  it("renders the email input", () => {
    render(React.createElement(LoginPage));
    const emailInput = screen.getByRole("textbox");
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("renders the submit button", () => {
    render(React.createElement(LoginPage));
    expect(
      screen.getByRole("button", { name: /שלחי לי קישור/ })
    ).toBeInTheDocument();
  });

  it("renders the app wordmark", () => {
    render(React.createElement(LoginPage));
    expect(screen.getByText("דרך ברורה")).toBeInTheDocument();
  });

  it("renders the welcome heading", () => {
    render(React.createElement(LoginPage));
    expect(screen.getByRole("heading", { name: /טוב שבאת/ })).toBeInTheDocument();
  });

  it("renders the ClearRoad brand name in the footer", () => {
    render(React.createElement(LoginPage));
    expect(screen.getByText("ClearRoad")).toBeInTheDocument();
  });

  it("renders the login form", () => {
    render(React.createElement(LoginPage));
    const form = document.querySelector("#login-form");
    expect(form).toBeTruthy();
  });
});
