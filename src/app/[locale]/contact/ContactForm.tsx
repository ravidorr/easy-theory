"use client";

import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon";
import styles from "./page.module.css";

const TOPICS = ["question", "bug", "idea", "general"] as const;
type Topic = (typeof TOPICS)[number];

export function ContactForm() {
  const t = useTranslations("Contact");
  const [topic, setTopic] = useState<Topic>("question");
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTopic("question");
    setMessage("");
    setReplyEmail("");
    setError(null);
    setIsSent(false);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message, reply_email: replyEmail }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : t("sendFailed"));
      }
      setIsSent(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("sendFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <section className={styles.sentCard} aria-live="polite">
        <span className={styles.sentIcon} aria-hidden="true">
          <Icon name="check" size={28} />
        </span>
        <h2>{t("sentTitle")}</h2>
        <p>{t("sentMessage")}</p>
        <button type="button" className={`pressable ${styles.resetBtn}`} onClick={reset}>
          {t("sendAnother")}
        </button>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.section} aria-labelledby="contact-topic-title">
        <h2 id="contact-topic-title">{t("topicTitle")}</h2>
        <div className={styles.topicList}>
          {TOPICS.map((id) => (
            <button
              key={id}
              type="button"
              className={`pressable ${styles.topic} ${topic === id ? styles.topicSelected : ""}`}
              aria-pressed={topic === id}
              onClick={() => setTopic(id)}
            >
              {t(`topic${id[0].toUpperCase()}${id.slice(1)}`)}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="contact-message-title">
        <h2 id="contact-message-title">{t("messageTitle")}</h2>
        <textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          required
          maxLength={2000}
          placeholder={t("messagePlaceholder")}
          className={styles.messageInput}
        />
        <input
          id="contact-reply-email"
          type="email"
          value={replyEmail}
          onChange={(event) => setReplyEmail(event.target.value)}
          maxLength={254}
          placeholder={t("replyEmailPlaceholder")}
          dir="ltr"
          inputMode="email"
          autoComplete="email"
          className={styles.emailInput}
        />
        <p className={styles.replyHint}>{t("replyEmailHint")}</p>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
