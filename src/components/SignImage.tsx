"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
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
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      className={["sign-image", styles.root, className].filter(Boolean).join(" ")}
      style={style}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/placeholder.svg"; }}
      unoptimized
    />
  );
}
