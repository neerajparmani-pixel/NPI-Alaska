# Reference app review

Source supplied privately by the user: NPI_System_PWA_Phase2_Development_v2.3.33.zip. The archive was inspected as reference only; it was not executed, edited or committed. No credentials, configured PINs, endpoints, customer data or bundled assets were copied into this repository.

Observed patterns: Apps Script backend; a Settings sheet containing operational configuration and staff/admin access records; separate mechanic, driver and administrator login paths; server-side session and role checks; retry/lockout bookkeeping; and role-oriented frontend navigation. The login code directly compares PIN values read from the sheet. Those credential values were not printed or reused.

Applied to NPI Alaska: a dedicated Settings area, readable backend tabs, explicit access/status information, full-page entry and separate operational roles in the owner preview. Workspace name/support settings are functional. Employee provisioning/reset remains disabled until an actual authentication backend is implemented/configured. A hosting project alone does not supply those account functions.

The reference's financial, mechanic, fuel-card, truck and other unrelated modules are not added to the Alaska Phase 1 scope. The Alaska logo will come from the user separately.
