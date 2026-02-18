import { useMemo } from "react";

/**
 * Compute polar positions for users in a "galaxy" circle.
 * Returns array of { user, x, y } where x & y are percentages (0–100).
 * Reusable for any galaxy-style layout.
 */
export function useGalaxyPositions(users) {
  return useMemo(() => {
    const count = users.length || 1;
    const radiusBase = 25;
    const radiusStep = 12;

    return users.map((user, index) => {
      const angle = (index / count) * Math.PI * 2;
      const layer = index % 3;
      const radius = radiusBase + layer * radiusStep;

      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;

      return { user, x, y };
    });
  }, [users]);
}
