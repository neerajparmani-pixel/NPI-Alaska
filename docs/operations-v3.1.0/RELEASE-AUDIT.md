# Alaska NPI v3.1.0 — release audit

Local release checks use the Product Design screenshot audit framework, the Frontend Design Premium strict static scanner, axe-core 4.14 and Lighthouse 13. These are automated tools plus a local code/screenshot review. No external human audit, Codex Security scan, live cloud test or security certification is claimed.

## Results

90 unit/API/database tests pass. SQL migrations 001/002/004/005/006/007 execute in isolated PGlite tests, including explicit evidence exceptions, camera-only ruler records, service reuse rejection, zero-up snow coverage, below-threshold review, successful-call quota refunds, expiry, literal search, first-check-in service dates, overnight DST elapsed time and daily digest deduplication. Apps Script VM tests cover HTTP/non-JSON errors and ownerless workbook rejection. Edge tests include canonical UUID rejection and invitation throttling. Browser tests use intercepted fictional cloud responses, actual DOM interaction and test camera/GPS.

The full browser suite passes 154 desktop/mobile cases. Build and formatter pass. Strict static scan of the active public/live frontend has zero findings. Old prototype source is included only under source/ so the complete regression suite is reproducible; it is not deployed. All 13 current screenshot states have zero automatically detected axe violations; incomplete/manual rules remain. This is not proof of complete WCAG compliance. Sign-in Lighthouse scores: performance 87, accessibility 100, best practices 100, SEO 100. The display-sized transparent logo reduced startup image cost; original artwork is retained.

## Fixes and behavior

- An explicit missing-evidence reason is required for a bypass. Partial outcome alone does not bypass before/after/ruler requirements. Both reviewers acknowledge exceptions; per-worker counts/percentages support review.
- Ruler evidence must be an app-camera before photo with capture time, fresh for the service. Its evidence ID cannot back another service or visit. Separate physical captures are not forensically proven unique. Human review remains necessary.
- New snow parents are drafts until contiguous bands cover zero upwards through an open-ended highest band. Below 2 inches is included as requested and flagged at both reviews, with no billing entitlement. Invalid existing catalogues become inactive until corrected.
- Service date is fixed at first server check-in in America/Anchorage. Worker-led unstarted preparation expires after 24 hours without saved activity; original evidence/history are retained. Dispatcher ignores worker-led drafts for unstarted-overdue notices.
- Summaries default off, including existing settings after upgrade. Per-scope last_digest_date avoids repeated digest queries. Indexed open attendance replaces the recurring full event-table scan.
- Public shell caching tolerates missing optional assets; essential cache installation is atomic and decoders are lazy. Private APIs/uploads are never cached by the service worker. App updates wait for saved forms and empty pending device queues.
- Personal-device sessions are opt-in, expire after seven days and coordinate across tabs where Web Locks exist. Pending photo originals/previews recover from account-scoped IndexedDB with stable upload IDs. Existing-object conflicts are verified against bytes. Unsupported/full browser storage warns clearly; browser eviction remains possible.
- Invitations have global/hashed-link rate limits and generic registration conflicts. Server failures return 5xx and sanitized request-ID logs. Failed snow-provider calls release successful-call quota, subject to attempt/concurrency limits.
- Sheets checks HTTP status before parsing, fails closed on ownerless workbooks and retains seven management tabs. Source/tests/config/locked dependencies are supplied. The extracted source package also passes all 90 unit/API/database checks using the same locked local dependencies.

## Screenshot review, in flow order

1. **Worker Home — Pass in local fixture.** Worker can start a visit without an assignment. Supplied site photo and current work remain available.
2. **Site Service — Pass in local fixture.** Site and service selection, optional crew disclosure and nearest-site suggestion.
3. **Prepared Visit — Pass in local fixture.** Short service cards and before-photo/start actions.
4. **Direct Camera — Pass in local fixture.** Direct camera capture with keep and retake; synthetic camera feed.
5. **Snow Measurement — Pass in local fixture.** Ruler photo, manual inches and explicit confirmation. Automatic reading is optional.
6. **Reading Fallback — Pass in local fixture.** Unavailable automatic reader leaves manual input usable and does not confirm a reading.
7. **Issue Report — Pass in local fixture.** Category, urgency and description use the established issue form.
8. **Company Review — Pass in local fixture.** Company reviews line/sub-line quantities and original versus claimed hours.
9. **Private Photo — Pass in local fixture.** Same private viewing file available to the company; original retained separately.
10. **Npi Catalogue — Pass in local fixture.** Contract line and sub-line configuration remains in NPI administration.
11. **Sub Line Configuration — Pass in local fixture.** Parent line sets contract, service category and unit. Snow minimum/maximum bounds are explicit.
12. **Notification Settings — Pass in local fixture.** Separate recipient list, escalation and daily-summary control.
13. **Npi Verification — Pass in local fixture.** Exact claimed hours or reasoned correction; approval still follows company review.

## Remaining live acceptance

Apply 007 only after 006, update the Edge Function and bound Sheets script, and stage the frontend. Test actual invitations using two isolated company accounts, phone camera/GPS, before/ruler/after uploads, explicit exceptions, both reviews, below-two acknowledgement, refresh/session recovery, email sender/dispatcher and controlled two-way Sheet proposals. Keep existing accounts/domain/workbook. The ZIP does not change the production deployment by itself.

Automatic ruler reading accuracy and GPS honesty are not established by mocks. Device labels/timestamps are review evidence, not tamper-proof attestation. No closed-app push or billing is included. Retention/purge is not automatic. Reports use loaded work windows; authoritative work search is paginated. Management export refuses oversized tables instead of truncating. See START-HERE for operating limits.

## Videos

Three new recordings use the real frontend and intercepted fictional services. GPS/camera are simulated and labelled. The worker video demonstrates reload recovery with actual pending local photo files. Jenny Dioco is a synthetic English female voice (Great Britain), not an Australian voice or a human presenter. Videos include headings, burned-in captions, VTT captions and written instructions. Technical codec, audio levels and audio/video sync are verified; independent human narration certification is not claimed.
