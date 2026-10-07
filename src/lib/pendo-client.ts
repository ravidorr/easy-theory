export type PendoTrackProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    pendo?: {
      track?: (event: string, properties?: PendoTrackProperties) => void;
    };
  }
}

export function trackPendoEvent(event: string, properties: PendoTrackProperties): void {
  try {
    window.pendo?.track?.(event, properties);
  } catch {
    // The agent may be missing, blocked or broken; analytics must never break the UI.
  }
}
