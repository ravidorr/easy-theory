/** Returns whether a sign image would reveal the correct answer. */
export function shouldSuppressQuestionImage(
  imageUrl: string | null | undefined,
  correctOption: string,
  options: readonly (readonly [string, string])[],
): boolean {
  const signNumber = imageUrl?.match(/\/signs\/sign-(\d{2,4})(?:[./?#]|$)/)?.[1];
  const correctAnswer = options.find(([key]) => key === correctOption)?.[1];
  return signNumber !== undefined && correctAnswer?.trim() === signNumber;
}
