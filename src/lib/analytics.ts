export type AnalyticsParams = Record<
  string,
  string | number | boolean | undefined
>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetOrEventName: string | Date,
      params?: AnalyticsParams,
    ) => void
  }
}

/** Fire a GA4 event. No-ops if gtag is unavailable. Never send PII. */
export function trackEvent(name: string, params?: AnalyticsParams) {
  try {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
    window.gtag('event', name, params)
  } catch {
    /* ignore analytics failures */
  }
}
