# eLIR workflow

Open a flight dashboard and choose **LIR → Open eLIR**.

- An active OPERATIONS user uploads a PDF (up to 5 MB, renderer supports 50 pages) or plain text. Text keeps spaces and line breaks; limits are 120,000 characters, 3,000 lines, 200 characters per line.
- The active RAMP user assigned to this flight selects Tick, NIL, ULD Details, vertical ULD Number, PCs, or Blue Strike and marks the page. Blue Strike is drawn by dragging horizontally. Save annotations stores a draft. Draw a signature and choose Sign & complete LIR to lock the version.
- ADMIN may upload/view; annotation and signing require the current RAMP assignment even for administrators. Permissions are checked against the current database user, not localStorage or stale JWT department claims.
- Upload, draft save and completion add a system notice to the flight chat and update open dashboards. These are in-app notices, not email or push delivery.
- New uploads start an empty annotation set. Earlier originals, annotations and signatures remain available through Version. PNG exports contain the selected page, signature and completion/draft status; Download original retrieves the original PDF/text.
- Concurrent stale saves/uploads return 409. Unsaved edits remain in the browser after a conflict or reconnect; export each affected page before Refresh. Closing the page discards unsaved edits after the browser warning.

Originals and annotation vectors are stored in MongoDB, not Render's temporary filesystem. No new environment variables are needed. Startup creates a unique flight/revision index. Server timestamps are displayed in Europe/London. The PDF renderer and worker use pinned PDF.js 4.10.38 from jsDelivr; internet access and a modern browser are required. Encrypted, corrupt, extremely tall or over-50-page PDFs must be replaced by OPS with a supported document. The handwritten signature records the authenticated user's name and server time; it is not a cryptographic PDF signature.

Staff account API access now requires authentication and excludes password hashes. Account creation/changes require ADMIN or an OPERATIONS user with position OPERATIONS_DM, preventing self-assignment of LIR privileges.

## Verification

`npm test` includes role separation, input bounds, draft conflicts, completion locks, obsolete revisions and upload sequencing using mocked database calls, plus existing operational-time tests. These do not replace live MongoDB/browser verification.

After the main deployment is Live in Render, use a test flight:

1. OPS uploads a two-page LIR PDF. RAMP opens it, marks both pages, draws a signature and saves a draft. Refresh both accounts; positions and draft status must persist, and the flight chat must show the notice.
2. RAMP completes it. OPS can read/download it; neither account can edit the completed revision. Confirm the displayed signer and London timestamp.
3. OPS uploads a correction. Version 2 must be blank, while Version 1 retains all annotations and signature.
4. Open the same draft in two RAMP tabs. Save in one; the other must preserve its unsaved marks, warn about the conflict and offer PNG export before refresh.
5. Disconnect/reconnect with unsaved marks. They must remain visible and further editing must pause until refresh. Check tools and signature on the actual ramp tablet, including scrolling and page changes.
6. Attempt upload with RAMP and annotation save with OPS: API must return 403. A signed-out request must return 401. Restart Render and verify stored originals and annotations still load.

An upload and an old-version save may overlap: edits remain attached to that old document, never to the replacement. A failed document write after reserving a revision can leave a numbering gap; refresh and retry. Chat delivery failure does not roll back a successfully saved LIR.

## Phone view

Touch devices open at 100% in Move / read mode. Swipe across the document to scroll and use the browser pinch gesture to zoom. The + / − controls change document size from 25% to 300%; Fit width fits the page to the available width. Select an annotation tool to enter marking mode; use Move / read to resume scrolling and pinch gestures. Zoom changes display size only: stored coordinates and PNG export remain unchanged.

## Live annotation preview

OPS and RAMP with the same eLIR revision open see new marks, edits, undo/redo and deletions as an unsaved live preview (updates are debounced by 150 ms). The banner identifies the RAMP operator. Other viewers temporarily cannot edit that revision while the live editor is active. Preview data never overwrites another operator's local unsaved work. Simultaneous first edits are resolved by the server; the losing operator keeps their local draft for export and must refresh.

Save still persists the annotations; signature completion still locks the revision. Signatures are not broadcast while being drawn. Live preview clears on save, replacement upload, editor departure or connection timeout. A late viewer receives the current preview. Preview PNG exports explicitly say LIVE UNSAVED PREVIEW. A lost live connection does not prevent normal REST saves.

The authenticated `/lir-live` Socket.IO namespace checks active database users, OPS/RAMP viewing permissions, RAMP editing permissions and current document/version. Live drafts exist only in server memory with a 30-second lease renewed every 10 seconds; no new database fields or environment variables are needed. This implementation targets one Render instance. Multiple instances would require a shared draft/lease store and Socket.IO adapter before enabling horizontal scaling. Persisted LIR documents remain in MongoDB.

To test after deployment: open the same revision in an OPS browser and a RAMP phone. Add a tick, NIL, ULD, then undo: OPS should see each change without Refresh and with an UNSAVED banner. Save and verify the banner clears and the saved marks remain. Open another flight/revision and confirm it receives no preview. Disconnect the editor and confirm the preview clears; reconnect and refresh before continuing. Automated tests cover authentication, room isolation, ownership, late joins, stale/completed versions, expiry and clearing, using socket/database mocks; live devices still require this smoke test.

## Assigned RAMP agent only

The authoritative assignment is Assigned Staff → RAMP (`Assignment.turnaroundId`, role `RAMP`, `userId` matching the authenticated active RAMP user). Being in the RAMP department, having a skill or being ADMIN does not by itself grant annotation/signing access. If the RAMP slot is empty, all viewers are read-only. OPS upload and OPS/RAMP viewing remain available.

The server checks assignment at each draft save/completion and live update. Reassignment clears the live preview and notifies open eLIR clients to reload their permissions; a former agent's unsaved local draft remains available for PNG export, with further saving disabled. The new assignee can continue from saved annotations. Completed documents stay locked.

Assignment writes now require an authenticated authorized manager/coordinator. Existing duty-manager permissions are retained; coordinators may update only their supported roles, preserving other departments' assignments. RAMP targets must be active RAMP users with the RAMP skill. An ordinary ramp supervisor cannot self-assign through the API.

After deployment, assign agent A to RAMP, then open the LIR as A and B. Only A should edit/sign/share live. Reassign to B while A has an unsaved mark: A should become read-only, B should gain edit access, and A's local mark must remain exportable. Remove RAMP assignment and verify neither can save. The tests use database/socket/DOM mocks; verify this handover on the deployed site.

### Session and stale-permission handling

The editor binds REST and live access to the account that opened the page. A token change in another tab immediately stops editing and disconnects the old live session; export unsaved work, then reload. The page displays the authenticated name returned by the server. Assignment rights refresh every five seconds and on window focus; local editing expires after 15 seconds without a successful access check. Save/sign/live updates still check the database on the server. Ambiguous duplicate RAMP rows deny editing until an authorized allocator reassigns the role. Test different accounts in separate browser profiles or a private window: ordinary tabs share localStorage login state.

## Flight acceptance and LIR receipt

Each assigned agent sees **Accept flight** under their own Assigned Staff entry. Acceptance records the authenticated name and server time, displays to the allocator, and adds a flight-chat notification. Other users cannot accept on their behalf. Saving an unchanged assignment preserves acceptance; removing/reassigning creates a fresh assignment requiring acceptance.

The assigned RAMP agent sees **I have received / read this LIR** after opening the document. The confirmation records who and when for that exact LIR revision and assignment. OPS sees pending/received status on the dashboard and receipt details in eLIR; open pages update automatically. Repeated clicks preserve the first timestamp. Each new LIR starts with no receipts. Reassignment requires the new agent to acknowledge even if they were assigned previously; old receipts remain visible as history on that LIR. Historical revisions cannot be newly acknowledged. Receipt is an explicit acknowledgement, separate from signing/completing the LIR; it does not block annotation tools.

After deploy: accept a test flight as its dispatcher/RAMP agent, check the allocator's status; resave unchanged assignments and verify the original acceptance persists. Upload v1, confirm receipt as assigned RAMP, then upload v2 and check that it awaits receipt. Reassign to another RAMP agent and confirm that only the new assignee can acknowledge, while the previous receipt remains in history. Tests cover HTTP routes with mocked persistence and DOM behavior; real MongoDB and device verification remain necessary.
