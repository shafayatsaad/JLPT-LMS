export function applyReducedMotionPreference(enabled: boolean) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem("jlpt-reduced-motion", String(enabled)); } catch { /* The current page still applies the preference. */ }
  document.documentElement.dataset.reducedMotion = String(enabled);
}
