# NPI Alaska clickable sample

This is a separate, locally saved prototype for reviewing the PWA before connecting Supabase and Google Sheets. The existing app and spreadsheet owner preview remain separate.

## Open without setup

1. [Download the clickable ZIP](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Alaska-Clickable-Sample.zip).
2. Extract the ZIP.
3. Open **START-HERE.html** in Chrome, Edge or Safari.

No terminal, API keys, spreadsheet setup or login is needed. Use the Preview selector at the top to switch views. A regular browser window is recommended because local file-storage support varies. The managed test browser blocks `file://`; the exact self-contained HTML was tested through a local HTTP server, including embedded imagery and interactions.

You can also [download the single HTML file](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Alaska-Clickable-Sample.html). Save it with its `.html` extension and open it in your browser.

## Try these actions

- **Worker:** start Alex’s work, complete the checklist, add a sample photo, and finish and submit. A draft can be saved locally.
- **Supervisor:** open Reviews, inspect evidence, approve a submission or return it with a correction reason. Switch back to Worker to resubmit.
- **Management → Settings:** add/edit sample people, roles and site scope; save workspace details. No real accounts or passwords are created.
- **Spreadsheet:** simulate a permitted title edit and run demo sync. Try the older-version scenario to see conflict detection, compare values and re-queue or keep the app version. Completed records are protected.
- **Locations:** review the four courthouse names confirmed from Chris’s photos. Site tasks are provisional. David Dowd and Tote Port remain earlier-discussed sites awaiting exact scope.

## PWA sample and architecture

The [static PWA sample ZIP](https://github.com/neerajparmani-pixel/NPI-Alaska/raw/refs/heads/main/downloads/NPI-Alaska-PWA-Sample.zip) contains `sample/`, icons, a root redirect and hosting headers. Over HTTPS it supports installation on supported browsers and offline sample reopening after the first visit. A downloaded HTML file is a clickable preview rather than an installed PWA.

For local development run `npm ci`, `npm run dev`, then open `http://localhost:5173/sample/`. The route is also included in the normal Vite build. Do not confuse `/sample/` with the earlier app at `/` or the Apps Script owner preview.

See [two-way architecture](ARCHITECTURE.md), [source research and limitations](RESEARCH.md), and [visual audit](AUDIT.md). This proposal makes Supabase authoritative while allowing verified management changes from Sheets. Record IDs, versions, idempotency, permissions, and a visible conflict queue are required for the real bridge.

## Honest boundaries

All sample data is synthetic and stays in this browser. Company logins, private uploads, real authorization, cross-device offline queues and two-way backend synchronization remain to be implemented. Neither service is connected. Original site-photo files and original emblem file are still needed for embedding; the sample uses a labeled illustrative Alaska landscape. The supplied reference archive and its credentials were not copied into this deliverable. Finance remains a later phase.

Rebuild the downloads with `python3 scripts/package-sample.py` after source changes.
