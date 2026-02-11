// ---------------------------------------------------------------------------
// Sport & Position constants for athlete profiles
// ---------------------------------------------------------------------------

/** Sports supported by FUDL. Stored as plain strings in the DB (no Prisma enum). */
export const SPORTS = [
  "FLAG_FOOTBALL",
  "TACKLE_FOOTBALL",
  "RUGBY",
  "HANDBALL",
  "BJJ",
] as const;

export type Sport = (typeof SPORTS)[number];

/** Display labels for each sport. */
export const SPORT_LABELS: Record<Sport, string> = {
  FLAG_FOOTBALL: "Flag Football",
  TACKLE_FOOTBALL: "Tackle Football",
  RUGBY: "Rugby",
  HANDBALL: "Handball",
  BJJ: "Brazilian Jiu-Jitsu",
};

/** Dropdown-friendly options: { value, label }. */
export const SPORT_OPTIONS = SPORTS.map((s) => ({
  value: s,
  label: SPORT_LABELS[s],
}));

// ---------------------------------------------------------------------------
// Positions by sport
// ---------------------------------------------------------------------------

/** Sport-specific positions. BJJ uses belt ranks instead of field positions. */
export const POSITIONS_BY_SPORT: Record<Sport, readonly string[]> = {
  FLAG_FOOTBALL: [
    "Quarterback",
    "Wide Receiver",
    "Center",
    "Blitzer",
    "Cornerback",
    "Safety",
    "Linebacker",
  ],
  TACKLE_FOOTBALL: [
    "Quarterback",
    "Running Back",
    "Wide Receiver",
    "Tight End",
    "Offensive Tackle",
    "Offensive Guard",
    "Center",
    "Defensive Tackle",
    "Defensive End",
    "Middle Linebacker",
    "Outside Linebacker",
    "Cornerback",
    "Safety",
    "Kicker",
    "Punter",
  ],
  RUGBY: [
    "Prop",
    "Hooker",
    "Lock",
    "Flanker",
    "Number 8",
    "Scrum-half",
    "Fly-half",
    "Centre",
    "Wing",
    "Fullback",
  ],
  HANDBALL: [
    "Goalkeeper",
    "Left Wing",
    "Left Back",
    "Centre Back",
    "Right Back",
    "Right Wing",
    "Pivot",
  ],
  BJJ: ["White Belt", "Blue Belt", "Purple Belt", "Brown Belt", "Black Belt"],
};

/** Get position options for a sport (dropdown-friendly). */
export function getPositionOptions(sport: Sport) {
  return POSITIONS_BY_SPORT[sport].map((p) => ({ value: p, label: p }));
}

/** Type guard: is the given string a valid Sport? */
export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}
