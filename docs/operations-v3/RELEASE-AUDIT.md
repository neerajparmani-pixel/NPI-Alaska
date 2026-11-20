# Operations 3.0 — release audit

Worker-led visits were checked using the Product Design screenshot audit framework, Frontend Design Premium strict static scanner, axe-core4.14 and Lighthouse13.0.1. These are local checks, not an independent production security certificate. No external human auditor or Codex Security scan is claimed.

## Results

77 unit/API/database tests passed, including migrations001/002/004/005/006, company isolation, worker-created visits, pre-start evidence, manual measurements, snow-band boundaries and overlap rejection, multiple services sharing a single attendance timeline, corrected values, complete company/NPI approval, reader access/rate limits and daily digest deduplication. Optional vision-service responses were mocked; physical measurement accuracy was not evaluated.

The entire repository browser suite passed144 desktop/mobile cases, including legacy regressions. After presentation changes,26 live/visit cases passed; after final form validation changes,6 visit cases passed. These counts overlap and must not be added together. Build and formatter passed. DESIGN.md lint returned zero errors and eight existing warnings. Active live frontend strict static scan returned zero findings. The whole-repository scan has seventeen pre-existing unshipped prototype findings. No deprecated prototype frontend is included in this release.

All thirteen screenshot states had zero automatically detected axe violations. Some axe rules remain marked incomplete for manual review. Sign-in Lighthouse: performance73, accessibility100, best practices100, SEO91. Image/decoder startup cost remains a performance tuning opportunity. Automated scores do not establish complete WCAG conformance. Production npm audit reported zero known dependency vulnerabilities at test time.

## Screenshot review, in flow order

1. **Worker Home — Pass, local fixture.** Worker can start a visit without an assignment. Supplied site photo and current work remain available.
2. **Site Service — Pass, local fixture.** Site and service selection, optional crew disclosure and nearest-site suggestion.
3. **Prepared Visit — Pass, local fixture.** Short service cards and before-photo/start actions.
4. **Direct Camera — Pass, local fixture.** Direct camera capture with keep and retake; synthetic camera feed.
5. **Snow Measurement — Pass, local fixture.** Ruler photo, manual inches and explicit confirmation. Automatic reading is optional.
6. **Reading Fallback — Pass, local fixture.** Unavailable automatic reader leaves manual input usable and does not confirm a reading.
7. **Issue Report — Pass, local fixture.** Category, urgency and description use the established issue form.
8. **Company Review — Pass, local fixture.** Company reviews line/sub-line quantities and original versus claimed hours.
9. **Private Photo — Pass, local fixture.** Same private viewing file available to the company; original retained separately.
10. **Npi Catalogue — Pass, local fixture.** Contract line and sub-line configuration remains in NPI administration.
11. **Sub Line Configuration — Pass, local fixture.** Parent line sets contract, service category and unit. Snow minimum/maximum bounds are explicit.
12. **Notification Settings — Pass, local fixture.** Separate recipient list, escalation and daily-summary control.
13. **Npi Verification — Pass, local fixture.** Exact claimed hours or reasoned correction; approval still follows company review.

Screenshots, notes and raw reports are arranged in audit/index.html. Worker screens retain the approved identity and use short service cards. NPI catalogue and review tables retain full line/sub-line codes. Native selects/date controls remain intentionally platform-owned. The long measurement/catalogue forms scroll inside the standard accessible dialog. Navigation to a different view resets page scroll; same-view refresh preserves position. Unsupported decorative sub-line arrow glyph was replaced with text.

## Behavior and permissions

NPI sets contract/site scope and service catalogue once. Approved company workers prepare visits and select their own approved crew. No daily assignment is required. Fresh GPS remains mandatory for attendance; manually selected or typed site locations are labelled and never presented as GPS proof. Call-out labels remain linked to an authorised scope. Multiple services use one visit/member attendance timeline, and every worker submits their own hours. Company review still precedes NPI verification.

Ruler evidence and confirmed depth are required before normal snow-work check-in. A selected photo is not proof that the ruler was used correctly: both administrators review its content. Unsafe/unavailable evidence or incomplete work needs a reason and explicit acknowledgement by both reviewers. Original attendance and uploads are retained. Changed measurements need a reason and retain a prior-value history entry. Existing assigned records remain supported.

Automatic nearest-site selection is a suggestion within one kilometre of configured coordinates. Optional automatic inches reading uses a separately configured server-only OpenAI API key and sends the selected signed viewing copy to that provider. Results require confirmation. Missing configuration, provider failure or unclear images fall back to manual entry. Ten requests per worker/hour limit the endpoint; no browser provider key or arbitrary image URL is accepted.

The seven-tab workbook mirrors operational fields, including service lines, quantities, measurements and review history. Private file bytes, passwords, invitation secrets and API keys are excluded. Source JSON/version fields are hidden technical columns. Only permitted site and unstarted planning edits return as versioned NPI-reviewed proposals. Attendance/approval/measurement authority stays in the app.

Daily email summaries are optional in recipient settings, once per scope/date/recipient after7AM Alaska time through the configured dispatcher. Submitted-visit hours are whole recorded visit hours, not strict daily payroll hours. No missed-day backfill or inbox-delivery guarantee exists. Foreground alerts refresh every thirty seconds; no closed-app push is implemented.

## Scope and limits

Work search is paginated at fifty and includes line/sub-line text. Dashboard reports use the latest500 loaded assignments; the selected visit loads its own service lines. General line context is bounded at10,000 rows. Management exports refuse tables above20,000 rows rather than silently truncating them. Photos allow20MB each, twelve/60MB per batch, with private originals and stamped viewing copies. HEIC/TIFF variants can fail decoding. Unsaved photo queues are memory-only; original-file deletion is not automated.

Cloudflare deployment, Supabase RLS/storage behavior in the actual account, real device camera/GPS, Google Apps Script permissions/triggers, optional live vision accuracy and actual email delivery must still be tested by the owner after applying the package. No real emails, secret configuration changes or production record mutations were performed here. SQL tests use PGlite; browser tests use intercepted fictional responses.

## Videos

Three current running-app recordings include chapter headings, burned-in and separate captions, and written instructions. Jenny (Dioco) provides synthetic English female narration. The Australian online voice endpoint was unavailable; no Australian accent or human presenter is claimed. Audio is normalised and video/audio stream durations were verified. The camera feed and ruler illustration are explicitly training inputs; the displayed105-minute shift is a fixture. Model/source terms are included. No runtime voice model is deployed with the app.

## Design reconciliation

Existing Source Sans3, navy/gold tokens, transparent emblem, supplied site images, shared forms/dialogs and success feedback were retained. New worker cards are an approved workflow variant; NPI tables use existing shared owners. Earlier assignment behavior remains a legacy path, not a requirement for new worker visits. No unrelated redesign or financial UI was introduced.
