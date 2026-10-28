# Company-issued usernames/passwords

The user confirmed company-issued credentials. Firebase Authentication is proposed as the managed password verifier; workers do not need a Google account. Sheets remains the work-data database. This is identity-service groundwork, not completed live work access.

## Implemented

`/login` uses accessible username/current-password inputs, show/hide, inline validation, clear failure guidance and sign-out. The server exposes same-origin `/api/auth/login`, `/api/auth/session`, `/api/auth/logout` through Cloudflare Pages Functions. Passwords go only to the identity provider; no passwords/hashes in Sheets. Session data is encrypted with AES-GCM in a maximum-one-hour HttpOnly/Secure/SameSite=Strict host-only cookie. Refresh tokens are discarded. Provider account lookup checks disabled status and password-reset validity. No tokens are returned to frontend JavaScript or persisted in local storage. Successful identity verification deliberately shows 'work records not connected' until the actual work API is ready.

## Required configuration

Use a company-owned Firebase project with Email/Password enabled, a strong password policy and abuse/anti-enumeration protections. Configure FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY and AUTH_COOKIE_KEY in Cloudflare Pages runtime settings; AUTH_COOKIE_KEY must be a random 32-byte base64url secret. Do not paste credentials in chat or put them in source.

Username mapping is `username@PROJECT_ID.invalid`, an internal identity alias rather than a mailbox. Usernames are lowercased, 3–40 ASCII letters/digits/dots/underscores/hyphens. The company administrator must create authorized identities and map each Firebase UID to UsersRoles.UserId. A registered identity does not itself authorize work data. UsersRoles must additionally supply active state, role, contractor/site scope for server checks on every work request.

There is no self-registration UI. Synthetic identity aliases cannot receive password-reset emails; provide an authorized Admin SDK reset workflow before launch. Account provisioning, temporary password change policy, recovery, disabling and administrator MFA remain release requirements. Add edge rate-limiting rules for the login route and review provider terms/costs before production.

## Validation limits

Provider responses are mocked in tests. No Firebase project, real accounts, Cloudflare runtime secrets, real credential checks or work authorization have been deployed/tested. The package fails closed when configuration is missing. Do not confuse login UI, the separate demo role selector and actual server authorization.
