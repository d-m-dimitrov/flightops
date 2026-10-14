# eLIR workflow

Open a flight dashboard and choose **LIR → Open eLIR**.

- An active OPERATIONS user uploads a PDF (up to 5 MB, renderer supports 50 pages) or plain text. Text keeps spaces and line breaks; limits are 120,000 characters, 3,000 lines, 200 characters per line.
- An active RAMP user selects Tick, NIL, ULD Details, vertical ULD Number, PCs, or Blue Strike and marks the page. Blue Strike is drawn by dragging horizontally. Save annotations stores a draft. Draw a signature and choose Sign & complete LIR to lock the version.
- ADMIN can perform both actions. Permissions are checked against the current database user, not localStorage or stale JWT department claims.
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
