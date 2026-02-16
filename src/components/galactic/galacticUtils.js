/**
 * Shared helpers for galactic map / odyssey UI.
 * Reusable across GalacticMap and other odyssey components.
 */

export const ELEMENT_COLORS = {
  rouge: "border-red-400 bg-red-500/30",
  jaune: "border-yellow-400 bg-yellow-400/30",
  vert: "border-emerald-400 bg-emerald-400/30",
  bleu: "border-sky-400 bg-sky-400/30",
};

/**
 * Map DISC dominant_color to Tailwind border/background classes.
 */
export function getElementClasses(dominantColor) {
  if (!dominantColor) return "border-white/20 bg-white/10";
  const colorClass =
    ELEMENT_COLORS[dominantColor] || "border-white/20 bg-white/10";
  return `${colorClass}`;
}
