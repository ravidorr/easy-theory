import styles from "./Skeleton.module.css";

type SkeletonVariant = "line" | "lineLg" | "pill" | "block" | "circle" | "bar" | "image";

type SkeletonSize = "w25" | "w40" | "w60" | "w80" | "s40" | "s52" | "s72";

export function Skeleton({
  variant = "line",
  size,
}: {
  variant?: SkeletonVariant;
  size?: SkeletonSize;
}) {
  return (
    <span
      aria-hidden="true"
      data-skeleton={variant}
      className={`${styles.skeleton} ${styles[variant]}${size ? ` ${styles[size]}` : ""}`}
    />
  );
}

export function SkeletonRow({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" data-skeleton="row" className={styles.row}>
      {children}
    </div>
  );
}

export function SkeletonCol({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" data-skeleton="col" className={styles.col}>
      {children}
    </div>
  );
}

export function SkeletonCard({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-hidden="true" data-skeleton="card" className={styles.card}>
      {children}
    </div>
  );
}

/* A card holding one icon-plus-two-lines row: the shape of the app's link
   cards (resources, credits). Shared so the two routes cannot drift apart. */
export function SkeletonIconCard() {
  return (
    <SkeletonCard>
      <SkeletonRow>
        <Skeleton variant="block" size="s40" />
        <SkeletonCol>
          <Skeleton size="w60" />
          <Skeleton size="w80" />
        </SkeletonCol>
      </SkeletonRow>
    </SkeletonCard>
  );
}

export function SkeletonScreen({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main aria-busy="true" className={className}>
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </main>
  );
}
