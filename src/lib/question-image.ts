export function shouldSuppressQuestionImage(
  imageUrl: string | null | undefined,
  options: readonly string[],
): boolean {
  const signNumber = imageUrl?.match(/\/signs\/sign-(\d{2,4})(?:[./?#]|$)/)?.[1];
  return signNumber !== undefined && options.some((option) => option.trim() === signNumber);
}
