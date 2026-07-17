import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const modalScript = readFileSync(
  resolve(__dirname, "../../../public/js/modal.js"),
  "utf-8"
);

type ModalApi = {
  confirm: (options: {
    message: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean>;
  alert: (options: { message: string; title?: string }) => Promise<void>;
  dismissAll: () => void;
};

function modal(): ModalApi {
  return (window as unknown as { modal: ModalApi }).modal;
}

function scrim() {
  return document.querySelector(".modal-scrim") as HTMLElement | null;
}

function card() {
  return document.querySelector(".modal-card") as HTMLElement | null;
}

function actionButtons() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".modal-actions button")
  );
}

function pressKey(key: string, shiftKey = false) {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true })
  );
}

describe("modal.js – confirm", () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="opener">פתיחה</button>`;
    eval(modalScript);
  });

  it("renders a dialog with the message and default button labels", () => {
    const promise = modal().confirm({ message: "להגיש בכל זאת?" });

    expect(card()!.getAttribute("role")).toBe("dialog");
    expect(card()!.getAttribute("aria-modal")).toBe("true");
    expect(card()!.getAttribute("aria-label")).toBe("להגיש בכל זאת?");
    expect(card()!.querySelector(".modal-message")!.textContent).toBe("להגיש בכל זאת?");

    const [confirmBtn, cancelBtn] = actionButtons();
    expect(confirmBtn.textContent).toBe("אישור");
    expect(confirmBtn.className).toBe("btn-primary");
    expect(cancelBtn.textContent).toBe("ביטול");
    expect(cancelBtn.className).toBe("btn-secondary");

    cancelBtn.click();
    return promise;
  });

  it("labels the dialog by its title when one is given", () => {
    const promise = modal().confirm({ message: "הודעה", title: "כותרת" });

    const title = card()!.querySelector(".modal-title")!;
    expect(title.textContent).toBe("כותרת");
    expect(card()!.getAttribute("aria-labelledby")).toBe(title.id);
    expect(card()!.hasAttribute("aria-label")).toBe(false);

    actionButtons()[1].click();
    return promise;
  });

  it("uses custom button labels when provided", () => {
    const promise = modal().confirm({
      message: "הודעה",
      confirmText: "כן, להגיש",
      cancelText: "חזרה",
    });

    const [confirmBtn, cancelBtn] = actionButtons();
    expect(confirmBtn.textContent).toBe("כן, להגיש");
    expect(cancelBtn.textContent).toBe("חזרה");

    cancelBtn.click();
    return promise;
  });

  it("resolves true on confirm and removes the dialog", async () => {
    const promise = modal().confirm({ message: "בטוח?" });
    actionButtons()[0].click();

    await expect(promise).resolves.toBe(true);
    expect(scrim()).toBeNull();
  });

  it("resolves false on cancel", async () => {
    const promise = modal().confirm({ message: "בטוח?" });
    actionButtons()[1].click();

    await expect(promise).resolves.toBe(false);
    expect(scrim()).toBeNull();
  });

  it("resolves false on Escape", async () => {
    const promise = modal().confirm({ message: "בטוח?" });
    pressKey("Escape");

    await expect(promise).resolves.toBe(false);
    expect(scrim()).toBeNull();
  });

  it("resolves false on a backdrop click but not on a card click", async () => {
    const promise = modal().confirm({ message: "בטוח?" });

    card()!.click();
    expect(scrim()).not.toBeNull();

    scrim()!.click();
    await expect(promise).resolves.toBe(false);
    expect(scrim()).toBeNull();
  });

  it("does not dismiss when a press starts inside the card and releases on the backdrop", async () => {
    const promise = modal().confirm({ message: "בטוח?" });

    // Text selection drag: mousedown on the card, the resulting click targets the scrim.
    card()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    scrim()!.click();
    expect(scrim()).not.toBeNull();

    // A clean backdrop press still dismisses.
    scrim()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    scrim()!.click();
    await expect(promise).resolves.toBe(false);
    expect(scrim()).toBeNull();
  });

  it("keeps Shift+Tab inside the dialog when focus fell back to the body", async () => {
    const promise = modal().confirm({ message: "בטוח?" });
    const [, cancelBtn] = actionButtons();

    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    pressKey("Tab", true);
    expect(document.activeElement).toBe(cancelBtn);

    cancelBtn.click();
    await promise;
  });

  it("dismissAll closes an open dialog with its dismiss value", async () => {
    const promise = modal().confirm({ message: "בטוח?" });
    modal().dismissAll();

    await expect(promise).resolves.toBe(false);
    expect(scrim()).toBeNull();
  });

  it("gives each titled dialog a unique title id", async () => {
    const first = modal().confirm({ message: "הודעה", title: "כותרת" });
    const firstId = card()!.querySelector(".modal-title")!.id;
    modal().dismissAll();
    await first;

    const second = modal().confirm({ message: "הודעה", title: "כותרת" });
    const secondId = card()!.querySelector(".modal-title")!.id;
    expect(secondId).not.toBe(firstId);
    expect(card()!.getAttribute("aria-labelledby")).toBe(secondId);
    modal().dismissAll();
    await second;
  });

  it("focuses the cancel button on open and restores focus on close", async () => {
    const opener = document.getElementById("opener") as HTMLButtonElement;
    opener.focus();

    const promise = modal().confirm({ message: "בטוח?" });
    const [, cancelBtn] = actionButtons();
    expect(document.activeElement).toBe(cancelBtn);

    cancelBtn.click();
    await promise;
    expect(document.activeElement).toBe(opener);
  });

  it("traps Tab and Shift+Tab inside the dialog", async () => {
    const promise = modal().confirm({ message: "בטוח?" });
    const [confirmBtn, cancelBtn] = actionButtons();

    // Focus starts on the cancel button (last focusable): Tab wraps to the first.
    pressKey("Tab");
    expect(document.activeElement).toBe(confirmBtn);

    // Shift+Tab from the first wraps back to the last.
    pressKey("Tab", true);
    expect(document.activeElement).toBe(cancelBtn);

    cancelBtn.click();
    await promise;
  });
});

describe("modal.js – alert", () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="opener">פתיחה</button>`;
    eval(modalScript);
  });

  it("renders a single focused OK button and resolves on click", async () => {
    const promise = modal().alert({ message: "יש לבחור יום." });

    const buttons = actionButtons();
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe("אישור");
    expect(document.activeElement).toBe(buttons[0]);

    buttons[0].click();
    await expect(promise).resolves.toBeUndefined();
    expect(scrim()).toBeNull();
  });

  it("dismisses on Escape", async () => {
    const promise = modal().alert({ message: "יש לבחור יום." });
    pressKey("Escape");

    await expect(promise).resolves.toBeUndefined();
    expect(scrim()).toBeNull();
  });

  it("stops listening for keys after closing", async () => {
    const promise = modal().alert({ message: "יש לבחור יום." });
    actionButtons()[0].click();
    await promise;

    // A second Escape must not throw or re-remove anything.
    pressKey("Escape");
    expect(scrim()).toBeNull();
  });
});
