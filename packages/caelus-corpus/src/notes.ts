/**
 * Family-level context notes (owner decision, 2026-08-16): where a whole
 * body of essays shares a caveat, the caveat lives here once instead of
 * being reworded inside each essay. Surfaces render the note a single time
 * beside any essay the predicate matches.
 *
 * A standalone module so a consumer can import the notes without pulling
 * the passage registries into its bundle.
 */
export interface FamilyNote {
  id: string;
  /** True when a fired rule id belongs to this note's family. */
  appliesTo: (ruleId: string) => boolean;
  note: string;
}

export const FAMILY_NOTES: FamilyNote[] = [
  {
    id: "chiron-thin-tradition",
    appliesTo: (ruleId) => ruleId.includes("chiron"),
    note:
      "Astrologers have only written about Chiron since 1977, so the reading "
      + "here rests on decades of observation rather than centuries. These "
      + "essays keep to the patterns that body of writing agrees on.",
  },
];
