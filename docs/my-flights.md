# My flights and Check-in → Gate handover

Open **My flights** from Operations or the flight dashboard navigation. The selected operating date defaults to today's Europe/London date, and can be changed to yesterday for an overnight flight or tomorrow for preparation. All assignment roles are supported: DISPATCH, CHECKIN, GATE, ARRIVAL, RAMP and SPUR. The server reads assignments for the authenticated user; a client cannot request another user's list.

Cards show assigned roles, acceptance actions, stand, registration, STA/STD and an ETA/STA or ETD/STD countdown using stored instants. If the instant is unavailable, the card says so rather than guessing a timezone. Pending acknowledgements and handovers sort first; pushed-back/departed/cancelled flights sort last and do not display outstanding action prompts. The countdown is a schedule countdown, not an operational task deadline. LIR metadata and links are limited to users with LIR viewing permissions.

The list refreshes every 15 seconds. **Accept ROLE** uses the existing protected acceptance endpoint. **Open flight**, **Open LIR** and **Check-in → Gate** lead to the detailed workflows. This release does not add gate-bag or offload workflows.

## Handover

The assigned CHECKIN user opens Check-in → Gate, enters checked-in passengers, infants, checked bags and outstanding/special-handling notes, then sends a version. These figures are an explicit handover snapshot and do not change the flight's existing passenger counters. Only one unambiguous current CHECKIN assignment permits sending; administrator privileges alone do not permit sending on behalf of an agent.

The assigned GATE user reads that version and confirms receipt. The server records the user name and time, and creates a flight-chat system notice. Repeated confirmation preserves the first receipt. A correction is a new version, requiring a new confirmation. A new Gate assignment also requires confirmation; earlier confirmations remain in the version history. Version numbers are reserved atomically; a failed database write can leave a numbering gap, but does not replace an existing version.

The assigned flight team, Operations, ADMIN and the passenger duty manager can view the handover. Unassigned agents cannot view or submit it. All mutations verify role, assignment ID and current version on the server. The form checks for updates every 10 seconds and preserves dirty fields on an assignment/version change, blocking sending until the user copies any notes they need and explicitly reloads. A browser warning protects against accidentally leaving an unsent draft. Switching accounts blocks requests until reload.

MongoDB stores handovers in a new Handover collection with a unique flight/revision index created at startup; no new environment variables are required. New pages use the existing Bootstrap CDN.

## Verification after Render deploy

1. Assign distinct CHECKIN and GATE users to a test flight. Each should see it in My flights for its London operating date; an unassigned user should not.
2. Accept each assignment from its card. Open Check-in → Gate as CHECKIN, enter 240 checked-in passengers, 3 infants, 260 bags and a note; send v1.
3. GATE should see a pending action after refresh, then the counts and note. Confirm receipt; Check-in should see the name/time within 10 seconds.
4. Send a corrected v2 with 261 bags. Receipt must be pending again; v1 and its receipt remain in history.
5. Reassign Gate and verify the new agent must acknowledge. Reassign Check-in while the old user's form contains an unsent draft: fields remain, sending is disabled.
6. Test an overnight flight by selecting its operating date. Check My flights in portrait orientation, including the acceptance buttons and navigation.

Automated tests cover task ordering, role isolation, input validation, HTTP handover submission, version conflicts, idempotent receipt and reassignment using mocked database models. Real browser/tablet rendering and live MongoDB/Render verification are still required.
