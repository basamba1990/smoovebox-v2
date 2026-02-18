// Predefined football formations by number of players.
// Coordinates are normalized (0..1) relative to the field container
// where x is horizontal (0 = left, 1 = right) and y is vertical
// (0 = own goal line, 1 = opponent goal line).

export const FOOTBALL_FORMATIONS_BY_COUNT = {
  11: {
    "4-4-2": {
      starters: 11,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF line
        { index: 1, role: "DEF", x: 0.15, y: 0.25 },
        { index: 2, role: "DEF", x: 0.35, y: 0.25 },
        { index: 3, role: "DEF", x: 0.65, y: 0.25 },
        { index: 4, role: "DEF", x: 0.85, y: 0.25 },
        // MID line
        { index: 5, role: "MID", x: 0.15, y: 0.45 },
        { index: 6, role: "MID", x: 0.35, y: 0.45 },
        { index: 7, role: "MID", x: 0.65, y: 0.45 },
        { index: 8, role: "MID", x: 0.85, y: 0.45 },
        // ATT line
        { index: 9, role: "ATT", x: 0.4, y: 0.7 },
        { index: 10, role: "ATT", x: 0.6, y: 0.7 },
      ],
    },
    "4-3-3": {
      starters: 11,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF line
        { index: 1, role: "DEF", x: 0.15, y: 0.22 },
        { index: 2, role: "DEF", x: 0.35, y: 0.22 },
        { index: 3, role: "DEF", x: 0.65, y: 0.22 },
        { index: 4, role: "DEF", x: 0.85, y: 0.22 },
        // MID line (3)
        { index: 5, role: "MID", x: 0.25, y: 0.45 },
        { index: 6, role: "MID", x: 0.5, y: 0.48 },
        { index: 7, role: "MID", x: 0.75, y: 0.45 },
        // ATT line (3)
        { index: 8, role: "ATT", x: 0.2, y: 0.72 },
        { index: 9, role: "ATT", x: 0.5, y: 0.75 },
        { index: 10, role: "ATT", x: 0.8, y: 0.72 },
      ],
    },
    "3-5-2": {
      starters: 11,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (3)
        { index: 1, role: "DEF", x: 0.25, y: 0.22 },
        { index: 2, role: "DEF", x: 0.5, y: 0.2 },
        { index: 3, role: "DEF", x: 0.75, y: 0.22 },
        // MID (5)
        { index: 4, role: "MID", x: 0.15, y: 0.42 },
        { index: 5, role: "MID", x: 0.35, y: 0.47 },
        { index: 6, role: "MID", x: 0.5, y: 0.5 },
        { index: 7, role: "MID", x: 0.65, y: 0.47 },
        { index: 8, role: "MID", x: 0.85, y: 0.42 },
        // ATT (2)
        { index: 9, role: "ATT", x: 0.4, y: 0.72 },
        { index: 10, role: "ATT", x: 0.6, y: 0.72 },
      ],
    },
    "3-4-3": {
      starters: 11,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (3)
        { index: 1, role: "DEF", x: 0.25, y: 0.22 },
        { index: 2, role: "DEF", x: 0.5, y: 0.2 },
        { index: 3, role: "DEF", x: 0.75, y: 0.22 },
        // MID (4)
        { index: 4, role: "MID", x: 0.2, y: 0.45 },
        { index: 5, role: "MID", x: 0.4, y: 0.48 },
        { index: 6, role: "MID", x: 0.6, y: 0.48 },
        { index: 7, role: "MID", x: 0.8, y: 0.45 },
        // ATT (3)
        { index: 8, role: "ATT", x: 0.2, y: 0.72 },
        { index: 9, role: "ATT", x: 0.5, y: 0.76 },
        { index: 10, role: "ATT", x: 0.8, y: 0.72 },
      ],
    },
  },
  7: {
    "2-3-1": {
      starters: 7,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (2)
        { index: 1, role: "DEF", x: 0.35, y: 0.25 },
        { index: 2, role: "DEF", x: 0.65, y: 0.25 },
        // MID (3)
        { index: 3, role: "MID", x: 0.2, y: 0.5 },
        { index: 4, role: "MID", x: 0.5, y: 0.52 },
        { index: 5, role: "MID", x: 0.8, y: 0.5 },
        // ATT (1)
        { index: 6, role: "ATT", x: 0.5, y: 0.78 },
      ],
    },
    "3-2-1": {
      starters: 7,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (3)
        { index: 1, role: "DEF", x: 0.3, y: 0.25 },
        { index: 2, role: "DEF", x: 0.5, y: 0.28 },
        { index: 3, role: "DEF", x: 0.7, y: 0.25 },
        // MID (2)
        { index: 4, role: "MID", x: 0.35, y: 0.5 },
        { index: 5, role: "MID", x: 0.65, y: 0.5 },
        // ATT (1)
        { index: 6, role: "ATT", x: 0.5, y: 0.78 },
      ],
    },
    "2-2-2": {
      starters: 7,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (2)
        { index: 1, role: "DEF", x: 0.35, y: 0.25 },
        { index: 2, role: "DEF", x: 0.65, y: 0.25 },
        // MID (2)
        { index: 3, role: "MID", x: 0.35, y: 0.5 },
        { index: 4, role: "MID", x: 0.65, y: 0.5 },
        // ATT (2)
        { index: 5, role: "ATT", x: 0.35, y: 0.78 },
        { index: 6, role: "ATT", x: 0.65, y: 0.78 },
      ],
    },
  },
  5: {
    "2-2": {
      starters: 5,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (2)
        { index: 1, role: "DEF", x: 0.35, y: 0.3 },
        { index: 2, role: "DEF", x: 0.65, y: 0.3 },
        // ATT (2)
        { index: 3, role: "ATT", x: 0.35, y: 0.7 },
        { index: 4, role: "ATT", x: 0.65, y: 0.7 },
      ],
    },
    "1-2-1": {
      starters: 5,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (1)
        { index: 1, role: "DEF", x: 0.5, y: 0.25 },
        // MID (2)
        { index: 2, role: "MID", x: 0.35, y: 0.5 },
        { index: 3, role: "MID", x: 0.65, y: 0.5 },
        // ATT (1)
        { index: 4, role: "ATT", x: 0.5, y: 0.78 },
      ],
    },
    "3-1": {
      starters: 5,
      slots: [
        // GK
        { index: 0, role: "GK", x: 0.5, y: 0.05 },
        // DEF (3)
        { index: 1, role: "DEF", x: 0.3, y: 0.3 },
        { index: 2, role: "DEF", x: 0.5, y: 0.32 },
        { index: 3, role: "DEF", x: 0.7, y: 0.3 },
        // ATT (1)
        { index: 4, role: "ATT", x: 0.5, y: 0.75 },
      ],
    },
  },
};

