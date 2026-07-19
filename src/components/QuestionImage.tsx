"use client";

import Image from "next/image";

type QuestionImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function QuestionImage({ src, alt, className }: QuestionImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={480}
      height={270}
      sizes="(max-width: 480px) 100vw, 440px"
      className={className}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        // Clear srcset too: with the optimizer's srcset present, setting src alone doesn't stick.
        img.srcset = "";
        img.src = "/placeholder.svg";
      }}
    />
  );
}
