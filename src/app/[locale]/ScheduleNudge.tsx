"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ScheduleNudge.module.css";

const LAST_SEEN_KEY = "scheduleNudge.lastSeen";
const RECOMMENDED_SCHEDULE = {
  days: [0, 2, 4],
  start_time: "17:00",
  duration_minutes: 45,
  notify: false,
};
const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

type ModalToast = { toast: (options: { message: string }) => Promise<void> };

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rememberToday() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, localDate());
  } catch {
    // Private browsing or a blocked storage policy should not prevent the nudge.
  }
}

function detectedTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function ScheduleNudge({ hasSchedule }: { hasSchedule: boolean }) {
  const router = useRouter();
  const t = useTranslations("ScheduleNudge");
  const tApi = useTranslations("Api");
  const tSchedule = useTranslations("JS.Schedule");
  const tSchedulePage = useTranslations("Schedule");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scrimPressStartedRef = useRef(false);

  useEffect(() => {
    if (hasSchedule) return;

    try {
      if (localStorage.getItem(LAST_SEEN_KEY) === localDate()) return;
    } catch {
      // Show the nudge if storage cannot be read; persistence is a best effort.
    }

    const activationFrame = requestAnimationFrame(() => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      rememberToday();
      setOpen(true);
    });
    return () => cancelAnimationFrame(activationFrame);
  }, [hasSchedule]);

  const dismiss = useCallback(() => {
    if (saving) return;
    rememberToday();
    setOpen(false);
  }, [saving]);

  useEffect(() => {
    if (!open) return;

    primaryRef.current?.focus();
    const dialog = dialogRef.current;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [dismiss, open]);

  async function saveRecommended() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...RECOMMENDED_SCHEDULE, time_zone: detectedTimeZone() }),
      });
      if (!response.ok) throw new Error("schedule save failed");

      setOpen(false);
      const modal = (window as Window & { modal?: ModalToast }).modal;
      if (modal?.toast) void modal.toast({ message: tSchedule("savedToast") });
    } catch {
      setError(tApi("scheduleUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  function chooseCustomSchedule() {
    if (saving) return;
    router.push("/schedule");
  }

  if (!open) return null;

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        scrimPressStartedRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && scrimPressStartedRef.current) dismiss();
        scrimPressStartedRef.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-nudge-title"
        dir="rtl"
      >
        <span className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <span className={styles.markTile}>
            <Image src="/logomark.svg" alt="" width={26} height={24} priority />
          </span>
          <span className={styles.titleBlock}>
            <span className={styles.eyebrow}>{t("eyebrow")}</span>
            <h2 id="schedule-nudge-title">{t("title")}</h2>
          </span>
        </header>

        <p className={styles.body}>{t("body")}</p>

        <section className={styles.planCard} aria-label={t("planLabel")}>
          <span className={styles.checkBadge} aria-hidden="true">✓</span>
          <span className={styles.planContent}>
            <span className={styles.planLabel}>{t("planLabel")}</span>
            <span className={styles.chips}>
              <span className={styles.chip}>{t("planDays")}</span>
              <span className={styles.chip}>17:00</span>
              <span className={styles.chip}>45 {tSchedulePage("durationUnit")}</span>
            </span>
          </span>
        </section>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <button ref={primaryRef} type="button" className="btn-primary" disabled={saving} onClick={saveRecommended}>
            {saving ? tSchedule("saving") : t("saveRecommended")}
          </button>
          <button type="button" className={`btn-secondary ${styles.customize}`} disabled={saving} onClick={chooseCustomSchedule}>
            {t("customize")}
          </button>
          <button type="button" className={styles.later} disabled={saving} onClick={dismiss}>
            {t("later")}
          </button>
        </div>
      </div>
    </div>
  );
}
