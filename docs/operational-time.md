# London operational time and turnaround countdown

STA/STD and date-time input fields are London civil time (`Europe/London`). New turnarounds store full `arrival.staAt` and `departure.stdAt` instants. ETA, actual events and ETD remain MongoDB dates. Display formatting explicitly uses London regardless of the operator's browser or server timezone.

## Operating policy

- Operating date is the London arrival/schedule date. Departure day is explicitly 0–7 days after it.
- Existing records without a day offset infer +1 only when STD is earlier than STA. Equal times require an explicit offset. No bulk data migration runs.
- A nonexistent spring-forward time is rejected. For a repeated autumn time, choose first (BST) or second (GMT) occurrence in the form. The schedule choice applies to both schedule times; review clock-change schedules before that date.
- Unchanged date-time inputs preserve existing exact instants and seconds. Selecting an explicit clock-change occurrence intentionally resolves the input again. Historical timestamps are not shifted automatically.
- Ground Ready = ON_BLOCKS + stored MGT in elapsed minutes. STD/MGT target = max(STD, Ground Ready). This is a minimum-time estimate, not TOBT or a prediction incorporating ATC/ETD/readiness constraints. An expired target is explicitly marked as passed.
- Generated and manual flights resolve MGT from airline/aircraft rules. Aircraft-type edits resolve it again. Missing rules use 75 minutes with `mgtSource: fallback`, visible in the timer. Invalid/duplicate matching rules are errors.
- Existing stored MGT values remain snapshots. Missing legacy MGT is resolved on reads, without silently rewriting historical flights. Previously stored default 75 cannot be distinguished from an intentional 75 without reviewing the database.
- Editing an Event updates its derivative Turnaround timestamp and broadcasts `flightUpdated`; it does not replay status transitions. The countdown treats Events as authoritative.

## Generation and deployment

Generation uses the London weekday/date, runs after initialization and every minute after the preceding run completes. A unique partial MongoDB index on `(scheduleId, operatingDate)` plus upsert prevents duplicate generated flights across instances. Deleted generated flights remain tombstones.

Startup creates `generated_schedule_date`. Existing duplicate schedule/date records (including deleted copies) cause startup to fail with an error rather than deleting/merging records. Check these on a staging copy before deployment:

```javascript
db.turnarounds.aggregate([
  { $match: { scheduleId: { $type: "objectId" } } },
  { $group: { _id: { scheduleId: "$scheduleId", operatingDate: "$operatingDate" },
              ids: { $push: "$_id" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

Confirm existing STA/STD are London civil time. Review legacy overnight inference, previously saved MGT=75, duplicate rules and a sample of historical ETA/events. The application cannot infer whether a historical instant was entered with the old timezone bug.

## Verification

Run `npm test`. The suite uses Node's test runner, real date conversion and countdown functions, controlled async responses and database mocks. It covers timezone independence, DST gap/fold, midnight dates, overnight/late/exact-MGT turns, manual generation, aircraft swaps, AIBT edits, stale responses and interval teardown.

A live MongoDB integration test and browser smoke test are still required on staging. Event and derivative timestamp writes are awaited but are not a multi-document transaction; an interrupted second write can leave the derivative field stale. The operational endpoint groups the data for the client but does not provide a transactional MongoDB snapshot. Historical correction/reconciliation and replica-set transaction support are separate deployment decisions.
