// Helpers for pilot-focused downtime actions and transformations.

/**
 * Safely adjust a pilot's gunnery value by delta.
 * Lower is better, so improvements are negative deltas.
 * We clamp between 0 and 8.
 */
export function adjustGunnery(current, delta) {
  const base = typeof current === 'number' ? current : 4;
  const next = base + delta;
  return Math.max(0, Math.min(8, next));
}

/**
 * Safely adjust a pilot's piloting value by delta.
 * Lower is better, so improvements are negative deltas.
 * We clamp between 0 and 8.
 */
export function adjustPiloting(current, delta) {
  const base = typeof current === 'number' ? current : 5;
  const next = base + delta;
  return Math.max(0, Math.min(8, next));
}

/**
 * Safely adjust a pilot's injuries by delta.
 * We clamp between 0 and 6, with 6 = KIA.
 */
export function adjustInjuries(current, delta) {
  const base = typeof current === 'number' ? current : 0;
  const next = base + delta;
  return Math.max(0, Math.min(6, next));
}

/**
 * Return a pilot name label used across UI/PDF.
 * Adds the 🚫 marker when the pilot is marked as Dezgra.
 */
export function getPilotDisplayName(pilot) {
  if (!pilot) return '';
  return `${pilot.name || ''}${pilot.dezgra ? ' 🚫' : ''}`.trim();
}

