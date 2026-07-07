import type { CSSProperties } from "react";

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
  style?: CSSProperties;
};

export function SignImage({ src, alt = "", size = "sm", style }: SignImageProps) {
  const px = SIZES[size];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="sign-image"
      style={{
        width: px,
        height: px,
        objectFit: "contain",
        flexShrink: 0,
        display: "block",
        ...style,
      }}
    />
  );
}
