# Passenger figures

The dashboard now separates **Check-in** and **On board**:

- Checked-in passengers excludes infants; checked-in infants is a separate entry.
- Boarded passengers excludes infants; infants on board is separate.
- **TOB = boarded passengers + infants on board**. The browser previews it and the server calculates it independently; a submitted TOB value cannot override the sum.
- Jump seat is separate and excluded from TOB.
- Remaining passengers = checked-in − boarded; remaining infants = checked-in infants − infants on board. Negative results are preserved and flagged as a mismatch for review.

All five editable values must be whole numbers from 0 to 1,000. Blank values are not silently treated as zero. Updates require a signed-in user with the existing passenger-edit skills (CHECKIN, GATE, ARRIVAL), a duty-manager position or ADMIN. An atomic passenger revision rejects stale saves from another tab. The editing modal stays open with the error on failure.

## Existing data

No bulk migration runs. For a legacy record, boarded is displayed as old TOB minus old infants, preserving the previous total. If old TOB is less than infants, boarded and the calculated TOB are shown as unknown and the operator must correct the figures. Checked-in infants was not previously recorded, so it remains unknown until explicitly entered. The first save stores figuresVersion 2 and all explicit counts. Jump seat previously appeared in the form but was absent from the Mongoose schema; it now persists. Values already dropped by the old schema cannot be recovered automatically.

The existing `infants` database field continues to mean infants on board. `checkedInInfants` is new. Check-in → Gate handover remains a separate snapshot and is not changed by editing this panel.

## Render smoke test

Enter checked-in 240, checked-in infants 3, boarded 235, infants on board 2, jump seat 4. Expect TOB 237, remaining passengers 5 and remaining infants 1. Save/reload and verify Jump seat remains 4. Change boarded to 241 and infants on board to 4: TOB becomes 245 and both remaining figures show −1 with a warning. Open an old flight and verify checked-in infants is blank rather than copied from on-board infants. In two tabs, save one then attempt to save the stale other tab; it must reject the overwrite.

Automated tests cover formulas, legacy handling, invalid inputs, server-calculated TOB, persistence schema, concurrency and editor preview using mocked models/DOM. The deployed Render page and real devices still require smoke testing.
