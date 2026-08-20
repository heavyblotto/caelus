# B5 adversarial review — supplement

Everything in `pipeline/reviewer-instructions.md` applies. This sheet
adds the traps specific to the B5 families (lots, dispositors and
receptions, fixed stars, parallels, nakshatras, vargas, yogas).

## B5-specific checks

1. **Doctrine accuracy.** The doctrine the essays may state is pinned in
   `writer-instructions-b5.md`. Verify every claim against it: lot
   keepers and subjects (Fortune/Moon, Spirit/Sun, Eros/Venus,
   Necessity/Mercury, Courage/Mars, Victory/Jupiter, Nemesis/Saturn);
   mansion lords in the Vimshottari cycle (Ketu, Venus, Sun, Moon,
   Mars, Rahu, Jupiter, Saturn, Mercury, repeating); pada-to-navamsa
   mappings where stated; varga subjects (D2 wealth, D3 siblings and
   courage, D9 marriage and dharma, D10 career, D12 parents, D30
   adversity); yoga definitions exactly as the engine detects them
   (Mahapurusha = own or exaltation sign AND a whole-sign kendra from
   the Ascendant); star identifications (right constellation, character
   traceable to Ptolemy, Robson, or Brady).

2. **Selector overreach.** A lot essay must not claim the chart's sect
   or any body's position; a sign cell must not name a house and the
   reverse. A dispositor essay must not name the sign or house. A
   reception route essay must not name planets; a reception body essay
   must not name the partner or the signs. A star essay must not name
   the body on the star, a zodiac sign, or a house. A star-contact
   essay must stay with its named body. A parallel essay must not imply
   a longitude conjunction and must not cover the contraparallel. The
   sidereal families (nakshatras, vargas, yogas) must never translate
   to tropical claims; a D9 essay must not claim the rasi sign or any
   dignity.

3. **Fatalism drift.** The dangerous corners of this batch: Algol and
   the difficult stars, the Nemesis lot, Kemadruma, and D30. No
   catastrophe forecasting, no classical verdicts (poverty, widowhood,
   violence) delivered as fact — the tradition's report, hedged, or
   nothing. Yoga essays must not grade strength or invoke
   cancellations.

4. **Register drift.** Sanskrit glossed on first use and kept to the
   named terms; star lore in plain English, researched but written
   fresh — no lifted Robson phrasing; technique explainers one or two
   sentences, not a lecture.

5. **Shared skeletons.** The big sibling sets — 108 padas, 84 lot
   placements, 84 D9 placements, 60 star essays — are where openings
   and closers converge. Break any repeated scaffold ("This quarter
   sharpens...", "With your X parallel Y...") across a slice or across
   slices. Pada chips must not restate their mansion essay; star
   contacts must not restate their star essay.

6. **Second person and biography.** As every batch: hedge life events,
   degender partners and caretakers, no era claims, no age claims, no
   financial or medical directives.

Fix wording in place; keep `id`/`family`/`when`/`atomIds` untouched;
re-run `check-texts.mjs` per file after edits.
