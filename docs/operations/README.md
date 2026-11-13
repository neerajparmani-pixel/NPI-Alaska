# Revised NPI subcontract operations sample

[Download the revised clickable ZIP](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Subcontract-Operations-Sample.zip), extract it, then open **START-HERE.html**. This is separate from the earlier simpler sample.

[Read the plan written before implementation](PLAN.md).

## Try the workflow

1. **Management:** create a work order with a subcontractor, assigned worker, site and separate customer/subcontract rates.
2. **Worker:** choose the work order, check in with a newly captured location, choose individual or an explicit crew roster, complete tasks and sample evidence, and check out with another newly captured location. Submit claimed hours per worker.
3. **Subcontractor:** open Verify hours and approve the workers' claim before forwarding it to NPI.
4. **NPI supervisor:** inspect original events, both map links, breaks and roster. Enter accepted hours per worker, giving a reason for differences. Original recorded hours and contractor claims are preserved.
5. **Subcontractor:** submit a bill against unallocated NPI-approved work. Only that company's work is offered.
6. **Management:** cross-check the bill against the agreed sample rates. Mismatched bills require dispute/revision; they cannot be approved. Create customer invoice drafts separately, with independent pricing. Record bookkeeping receipts/payments if desired; no money moves.
7. **Spreadsheet:** inspect the local projection and export hours CSV. Supabase and Sheets are unconnected. The production two-way bridge is planned in PLAN.md and the prior architecture notes.

## Hours and location

Worker views show their own hours, not every crew member's total. Office views show recorded worker-hours, claimed hours and NPI accepted hours by site and record. Crew elapsed time and person-hours are different. Running elapsed time is provisional until checkout and breaks are entered. Overlapping attendance prevents NPI approval. Planned work dates and actual event times are distinct.

Both check-in AND checkout require a location. Confirmation stays disabled until that event has its own position. Device GPS requires browser permission and a secure/supported browser context, usually HTTPS. Denied/unavailable/timeout paths explain retry. The **Use example GPS** option is explicitly for trying the sample; it is not a production location bypass. Seeded positions, names and companies are synthetic.

Map & address opens a detail panel and a link to the captured coordinates in Google Maps. The expected site's candidate address is separate. Actual device points do not get a fabricated street address when reverse lookup is unavailable. Accuracy and source are visible. A crew location identifies the device operator; it does not independently prove all roster members' presence.

## Photos and address verification

The four sites are Boney Courthouse, Anchorage Youth Court, Snowden Courthouse and Nesbit Courthouse, using the user's names. **Site addresses/coordinates remain candidates and must be verified.** Original photos pasted in chat are not available as downloadable files in the workspace. The sample provides a separate photo slot and local image picker for each site; it does not mislabel a generic landscape as a courthouse photo. Choose different actual photos you are authorized to use, up to 600 KB each. They stay on this device.

Research access for the official court directory and Wikimedia has been saved as an environment draft. It has not been applied; current policy still blocks those hosts. Exact original photos or applied research access are needed to finish verified embedded site imagery/address sourcing.

## PWA and honest limits

[Static-host PWA ZIP](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Subcontract-Operations-PWA.zip). Upload extracted contents to an HTTPS static host for supported browser installation and scoped offline sample reopening. No real backend is included. A downloaded HTML file is the clickable review version; file storage/GPS support varies by browser.

Local development route is `/operations/`. Rebuild downloads with `npm run package:operations`. The previous `/sample/`, root demo and private Apps Script owner preview stay separate.

Role selection is a preview, not authentication. No real accounts, tax determination, sent invoices, bank transfers, verified field attendance, production RLS, live spreadsheet sync or private file service is implemented. All financial values are illustrative, before tax; estimated gross margin excludes overhead and other costs. Backend approval, identity, rate versions and sync still need implementation and integration testing.

See [audit evidence](AUDIT.md).
