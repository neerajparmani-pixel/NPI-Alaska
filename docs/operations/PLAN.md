# NPI subcontract operations: revised plan

User confirmed mixed customer/subcontract pricing, individual and crew entries, subcontractor-first approval and required location at BOTH check-in and checkout. This supersedes the earlier work-only sample and finance deferral for the new prototype. Existing samples/data stay separate.

## Workflow

Customer contract → NPI subcontract/scope → site work order → individual/crew location check-in → tasks/evidence → location checkout → worker hours submitted → subcontractor approves its workers' hours → NPI compares the claim with original app events → NPI approves/returns the hours → accepted quantities become eligible for customer invoice and subcontractor bill reconciliation → management reviews invoice/bill/payment records.

Original event times and locations are preserved. The contractor claim, recorded hours and NPI accepted hours are separate values. Changes require reasons and append an audit entry. Contractor approval alone never authorizes an NPI payment or customer invoice.

## Roles and screens

- Worker: assigned site/address, own check-in/out events and maps, elapsed/break/net hours, checklist, evidence, own submitted/approved hours. No client rates or margins.
- Subcontractor supervisor: own company crews and attendance, recorded vs claimed hours, approve/return worker hours, own bill submissions/status. No other contractor records or NPI customer prices.
- NPI supervisor: contractor-approved timesheets, original check-in/out map links, location accuracy, task evidence, discrepancies, proposed accepted hours with reason.
- NPI management: contract/site/contractor/date totals, customer invoice drafts, subcontractor bills, rate/quantity mismatches, recorded receipts/payments, estimated gross margin. No automatic transfers or invoice sending in sample.

## Time and quantity model

Store individual intervals (UTC), breaks, crew roster and site/contract/company IDs. Display Alaska time. Hours = non-overlapping ended intervals less breaks. Preserve missing checkout as incomplete, not zero/fabricated finish time. Crew elapsed time differs from total person-hours; only explicit roster entries contribute. Task times never sum over attendance again. Billable units follow each agreement independently: hourly, fixed, per visit or per load. Fixed prices are not multiplied by worker-hours. Customer price and contractor rate are separate, versioned agreements. Prevent duplicate allocations of approved quantities to bill/invoice lines.

## Location model

Location required separately for both events. Capture coordinate, device position timestamp, event time, accuracy and source; show denied/timeout/unavailable/low-accuracy explicitly. No silent fallback to the site's coordinate. GPS is evidence, not proof of identity/presence. A crew capture identifies its device operator and is not individual GPS evidence. Expected site address and actual captured position are distinct. Map links open the captured coordinates; site links open the site's address. A real captured point's address is not invented if reverse lookup is unavailable. Offline/server receipt states must remain distinct in production. No background surveillance.

## Sites and photos

Boney, Anchorage Youth Court, Snowden and Nesbit are the user's names. Candidate Anchorage street addresses must be independently verified before operation; Youth Court's photo visibly shows 838 W 4th Ave, and Snowden's photo shows 820. Other candidates are unverified. Original inline site photos are not mounted as files. Do not reuse the Alaska illustration as a photograph of each courthouse. Provide distinct site photo slots and a local photo picker, plus address/map links to inspect the real site. Actual photo embedding and authoritative address/coordinate verification are remaining dependencies; do not claim research access that the network policy blocks.

## Supabase and Sheets

Supabase remains canonical. A private workbook gives management Contracts, Subcontracts, Sites, Workers, TimeEvents, TimeClaims, NPIApprovals, CustomerInvoices, ContractorBills, Payments, Changes and SyncLog views. Validated two-way edits retain record IDs, versions and actor identity. Raw events, rate snapshots, approvals and posted invoice/bill lines are protected; corrections are requests with audit history. Conflict review prevents stale overwrites. Employee credentials never enter Sheets.

## Sample acceptance

Demonstrate all four roles, individual and crew records, site/worker/company hour totals, mandatory two-ended location capture, original vs claimed vs accepted hours, contractor submission before NPI approval, mixed-rate invoice/bill calculations, blocked unapproved/duplicate billing, and maps. Clearly label sample rates, example coordinates, candidate addresses, local evidence and unconnected services. Verify calculations/workflow with automated tests and phone/desktop browser tests. No real account creation, invoice sending, payments or backend writes.
