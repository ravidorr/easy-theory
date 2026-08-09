export function BrandMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 76 72" aria-hidden="true" className={className}>
      <path d="M12 20l16 16-16 16" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 20l16 16-16 16" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
