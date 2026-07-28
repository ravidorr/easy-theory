import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import styles from "./EmptyStateCard.module.css";

type EmptyStateTone = "primary" | "success" | "warning";

export function EmptyStateCard({
  icon,
  tone,
  title,
  description,
  actions,
}: {
  icon: IconName;
  tone: EmptyStateTone;
  title: string;
  description: ReactNode;
  actions: ReactNode;
}) {
  return (
    <section className={styles.card} data-empty-state data-tone={tone}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <div className={styles.content}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}
