# Gate items

Open **Gate items** from My flights or the flight dashboard's Assigned Staff section.

The current assigned GATE agent submits **Bags, Strollers and Wheelchairs**, each with a count and tag list. Separate tags by whitespace, commas or new lines. Every item requires a tag; the count must exactly match the list. Tags preserve leading zeros, normalize letters to uppercase, accept 1–24 letters/digits/hyphens and cannot duplicate another active item on that flight, including another type. Limits: 200 items per submission, 1,000 active items per flight.

The current assigned RAMP agent confirms **Received**, then **Loaded**, separately for each tag. The API prevents skipping receipt and rejects stale updates. The counts show submitted active items, received (including loaded), and loaded by type. Thus 5 submitted / 4 received leaves one specific tag waiting. My flights shows totals and RAMP pending-action prompts.

Assigned team members and Operations can view. Being ADMIN alone does not permit sending or handling on behalf of an agent. Duplicate ambiguous role assignments disable that role's actions. Each update checks current assignments, assignment ID and manifest version. Reassignment transfers future handling rights without erasing actual receipt/loading history.

Gate may cancel a wrong item only while it is SUBMITTED. It remains visible as CANCELLED and in history, excluded from totals. The tag can then be resubmitted correctly. Received/loaded corrections and offloads are not included in this release. Each action records actor ID/name, assignment, timestamp, type and tag. A flight-chat system notice is created after save.

The page refreshes every 10 seconds and keeps unsent counts/tags when another user changes the list. Sending pauses until Gate reviews the list and chooses **I reviewed the list — keep my draft**. Duplicate tags are still rejected. Lost-response retries cannot duplicate items: version checks force a refresh. The list does not change LIR or passenger counters.

Data is stored in the GateItems collection, with one unique manifest per flight and atomic version updates. The unique index is initialized on startup. No new environment variables are needed.

## Render smoke test

1. Assign separate Gate and RAMP users to a test flight. Gate enters 3 bags (00123/00124/00125), 2 strollers (00126/00127), 1 wheelchair (00128).
2. Verify totals are 3/2/1 submitted and all receipt/loading counts zero. Enter a count/tag mismatch or duplicate across types; submission must fail without adding items.
3. RAMP receives 00123, then loads it. The bag totals should be 3 submitted / 1 received / 1 loaded; other tags remain pending.
4. Gate cancels an unreceived stroller. Totals exclude it and history preserves it. Loaded items cannot be cancelled.
5. Open two sessions. An old update must fail after another saves; Gate's unsent tag list remains in the form and requires review.
6. Reassign RAMP. The old agent cannot receive/load; the new agent can continue. Refresh and restart the service to verify persistence.

Automated tests cover validation, exact assignments, per-tag transitions, optimistic concurrency, audit, totals, RAMP tasks and form draft preservation using mocked models/DOM. Actual Render/MongoDB and phone rendering remain to be verified.
