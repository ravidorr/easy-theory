"use client";

import type { CSSProperties } from "react";
import styles from "./SignImage.module.css";

const SIZES = {
  xs: 32,
  sm: 52,
  md: 96,
} as const;

type SignImageSize = keyof typeof SIZES;

type SignImageProps = {
  src: string;
  alt?: string;
  size?: SignImageSize;
  className?: string;
  style?: CSSProperties;
};

export function SignImage({ src, alt = "", size = "sm", className, style }: SignImageProps) {
  const px = SIZES[size];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={["sign-image", styles.root, className].filter(Boolean).join(" ")}
      style={{ width: px, height: px, ...style }}
      onError={(e) => { e.currentTarget.src = "/placeholder.svg"; e.currentTarget.onerror = null; }}
    />
  );
}
