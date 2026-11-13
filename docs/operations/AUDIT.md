# Revised subcontract sample: audit evidence

## Screens captured and inspected

1. **Overview — usable:** separate recorded/claimed/accepted totals and site summaries. [Screenshot](overview.png).
2. **Worker — usable after revision:** required-location check-in action is above the phone's bottom navigation. Individual and crew modes are explicit; own hours exclude colleagues. [Screenshot](worker.png).
3. **Hours — usable:** original event times, roster, break deductions, source, accuracy and separate map links are available. Tables have keyboard-focusable horizontal scroll regions. [Office register](hours.png), [worker register](worker-hours.png).
4. **Billing — usable prototype:** expected service value, contractor costs and estimated margin are separate. Bills require review; mismatches block approval. [Screenshot](bills.png).

5. **NPI cross-verification — usable:** per-worker recorded/claimed values are compared before accepting adjusted hours. [Screenshot](npi-review.png).
6. **Recorded location detail — usable with lookup limitation:** event time, coordinates, accuracy, source and a map link are distinct from the candidate site address. No reverse-geocoded address is invented. [Screenshot](event-map-detail.png).

The photos/addresses are an unresolved content dependency: site-photo slots are distinct and accept local actual photos, but original user images are not available as files. Candidate addresses and example GPS positions are labeled. No authoritative photo/address research is claimed while the network policy blocks the sources.

## Runtime verification

- 23 unit tests pass, including five new cases for crew/break arithmetic, mandatory two-ended coordinates, review order/adjustment reasons, mixed billing/duplicate allocations and overlapping attendance.
- 16 new browser checks pass across desktop and phone: worker→contractor→NPI flow, required independent GPS captures, denied permission, preserved raw evidence, accepted-hours adjustment, per-worker totals, map coordinate links, bill dispute/revision/payment record, separate client invoice pricing, company-scoped assignment, CSV download and offline reopening.
- The full current browser suite passes: 54 tests across desktop and phone, including 16 for the revised operations workflow.
- axe-core tagged WCAG 2 A/AA, 2.1 AA and 2.2 AA scans found no automated violations in tested office overview, hours, sites, contracts, billing and settings states at desktop/phone widths. This is not complete accessibility certification or a field usability study.
- Browser GPS success/denial use deterministic mocks; seeded GPS is example data. No actual worker was located or production attendance verified.
- Standalone compiled HTML was exercised through a local HTTP route with no JavaScript errors; example GPS check-in worked. Managed Chrome blocks file://, so downloaded-file support depends on the end user's browser.
- Production Vite and Cloudflare Pages worker builds pass. Both archives pass ZIP integrity checks. No live deployment, invoice delivery or banking operation occurred.

## Findings corrected

- Crew totals were separated from individual worker totals.
- NPI approval cannot precede subcontractor review.
- Adjusted accepted hours preserve original times and contractor claims, with reasons and audit entries.
- Both events need their own captured position; a denied position cannot be confirmed.
- Mobile scroll regions now receive keyboard focus; primary attendance action moved above supporting content.
- Offline route matching now ignores URL fragments, allowing hash-route reopening.
- Bills with mismatched claims cannot be approved; approved quantities cannot be allocated twice to the same document stream.

## Static audit

[Strict static-audit JSON](static-audit.json) is retained. It is not a clean repository-wide result: the existing delegated-handler heuristic flags buttons in the earlier samples. No operations-surface violations were reported in the captured result. Browser tests verify the new operations controls and do not treat static inspection as proof of working behavior.

## Production limitations

This prototype is local and synthetic. Authentication/RLS, immutable server events, verified manager identities in Sheets, private files, actual contracts/rate versions, taxes, proximity policy, exception handling, offline reconciliation, true address lookup, verified imagery and production integration tests remain pending. The sample is for reviewing the workflow and calculations.
