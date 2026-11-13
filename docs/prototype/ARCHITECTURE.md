# Supabase + Google Sheets: proposed two-way design

This is an architecture proposal behind the clickable sample. No credentials, deployed functions, live sync, SQL migrations, or user provisioning are included. User explicitly requested two-way operation because some managers work only in Sheets.

## Authority and responsibilities

- Cloudflare hosts the PWA. A server endpoint / managed function performs privileged actions.
- Supabase Auth manages real passwords, session lifetime and revocation. A server-owned company-username mapping is required; workers do not need their own Google account. No password, password hash, service-role key or token goes into Sheets or a public bundle.
- Supabase Postgres holds canonical records, assignments, task completions, memberships, site scopes, reviews, file metadata, audit events and sync operations. RLS plus restricted grants enforce access for each operation; frontend visibility is not authorization.
- Private Supabase Storage holds evidence. Signed access and server validation are required. A photo link in a management Sheet must not become a public storage URL.
- One private management workbook contains Assignments, WorkLogs, Evidence, Approvals, PeopleDirectory, Locations, Changes and SyncLog tabs. File ownership and editor access need confirmation. PeopleDirectory is a reference, never a credential store.

## Spreadsheet edits are first-class inputs

Managers use a dedicated controlled edit range or a Changes sheet, with immutable record ID, expected version, permitted field, proposed value and a sync result. Reports are readable and protected from arbitrary primary-key/formula edits. Sheet-protection alone is not an authorization boundary; every change is revalidated on the server.

Proposed editable fields: assignment title, planned date, authorized worker/site references, and supervisor decisions only for verified approvers. Actual allowlist and per-manager identities need approval. Completed work, evidence, audit fields and credentials are protected. The sample implements only title edits to demonstrate safety.

An installable Apps Script edit trigger captures the permitted human change into an outbox with a stable operation UUID. Timed reconciliation catches missed edits, pasted ranges and trigger failures. Programmatic sheet writes do not rely on onEdit firing. A narrowly scoped server credential validates the sender; workbook identity alone does not identify a human editor. If Google does not expose a reliable editor identity, consequential operations must use authenticated approval or a signed change request. This is an unresolved implementation requirement, not solved by the sample.

## App → Sheets

1. Authenticated mutation validates membership, state and expected row version.
2. In one database transaction, update the record, increment its version, append audit event and append outbox event.
3. A server job applies a batched, idempotent projection update to Sheets using stable record ID.
4. Store acknowledgement, last applied version and time. Retry transient failures with bounded backoff; expose failure/retry in SyncLog.

## Sheets → app

1. Capture change with record ID, expected version, operation UUID, permitted field and verified acting identity.
2. Server validates workbook trust, actor permission/site scope, payload/schema, business transition and version.
3. Matching version: transaction updates row, audit and outbox. Duplicate UUID returns the previous result.
4. Mismatching version: preserve both values in a conflict queue. Do not overwrite silently.
5. Project the resulting canonical record and change outcome back to the workbook. Ignore acknowledged operation IDs to prevent loops.

No database and Google Sheets distributed transaction is assumed. Temporary divergence is visible and repairable. Never show “synced” until both acknowledgement and versions agree. Deletes/tombstones, edited IDs, row moves, duplicates, batch edits, quotas and revoked access need explicit tests.

## Offline and conflicts

Production PWA queues require user-scoped encrypted/appropriate local storage, signed-in ownership, durable idempotency keys, out-of-order handling, session expiry and reconnect reconciliation. The sample stores synthetic data on one device and caches its shell; it never claims to implement production sync.

## Before real data

Confirm Supabase project, managed identity setup, Cloudflare project, workbook owner/editor roster, full site scope, permitted spreadsheet fields, approval identity and evidence rules. Implement migrations/RLS allow-and-deny tests, privileged endpoint authorization, private-file tests and integration tests against a dedicated test workbook. Pilot with a small crew before field release.
