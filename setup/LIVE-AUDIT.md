# Live integration verification

This is an integration installer, not proof of a completed cloud installation.

- 47 local unit, API-contract, workbook and PostgreSQL tests passed. PostgreSQL tests apply both migrations in PGlite and exercise row permissions, tenant isolation, immutable attendance, approval order, exact time acceptance and rate/draft allocation rules.
- 118 desktop/mobile browser checks passed across the repository, including 14 live-build checks. Live browser tests use an intercepted provider API; they do not demonstrate an actual Supabase deployment.
- Current login and worker screenshots were captured and visually inspected. The approved transparent emblem, Source Sans 3 typography, navy/blue palette and supplied site photography are embedded. Signed-in screenshot data and connection responses are test fixtures.
- The strict static UI audit reports 17 existing heuristic findings in older sample/spreadsheet/src surfaces and zero findings in public/live. This is not a clean whole-repository audit.
- Real Supabase connectivity could not be verified from this execution environment: its outbound proxy rejected the connection. Edge Function, Apps Script, first owner and Cloudflare deployment require the installation steps and subsequent real acceptance test.

## Boundaries

The implementation supports controlled workbook proposals and refresh, not instant bidirectional editing. Supabase is authoritative; raw attendance and approvals cannot be overwritten from Sheets. Work lists are capped at 500 per selected stage, with direct detail lookup; workbook exports cap at 20,000 rows per table. Additional pagination is needed beyond these limits.

Billing supports priced subtotal drafts and print-to-PDF only. Final invoice issuance, tax/legal invoice fields, payments, accounting and reconciliation are not implemented. Offline writes are blocked; GPS and uploads need an online connection. Sessions are memory-only and reload requires signing in again.

The package contains public configuration, no service-role key or database password, no seeded test work and no private contracts or contract prices. Complete the installation and real three-role acceptance checks before operational use.

## Approved-interface restoration

Restores the original oversight composition on the authenticated frontend: logo/sidebar/icons, verification hero, metrics, worker activity, loaded hours by location, attention queue and approval handoff. Native admin navigation and three worker bottom links work on phones. Existing live business actions, API configuration and permission rules are unchanged. The focused live suite also checks empty production workspaces, real scoped counts, accessible landmarks and company navigation. DESIGN lint reports zero errors and eight pre-existing warnings; the strict static report remains at the 17 legacy findings noted above.

NPI-Alaska-Interface-Update.zip is a frontend-only upgrade for the existing installation. It requires only a new deployment to the same Cloudflare Pages project; it contains no SQL or Apps Script updates, no private credentials and no seeded test work. New screenshots use explicitly documented fictional provider fixtures.
