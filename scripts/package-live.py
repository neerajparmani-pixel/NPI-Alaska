"""Build the live integration installer from an explicit public-code allowlist."""
from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
out=root/'downloads';out.mkdir(exist_ok=True)
# Dashboard deployment uses one self-contained Edge Function file.
handler=(root/'supabase/functions/npi-admin/handler.js').read_text()
wrapper="""
Deno.serve((request) =>
  handleAdmin(request, {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    NPI_ORIGIN: Deno.env.get("NPI_ORIGIN") || "https://alaska.npi6030.com",
    NPI_SHEETS_ID: Deno.env.get("NPI_SHEETS_ID"),
    NPI_SHEETS_TOKEN: Deno.env.get("NPI_SHEETS_TOKEN"),
  }),
);
"""
(root/'supabase/functions/npi-admin/index.ts').write_text(handler+wrapper)
files=[]
for folder in ['public/live','public/three-view/fonts','public/icons']:
 for p in (root/folder).rglob('*'):
  if p.is_file():files.append((p,str(p.relative_to(root/'public'))))
for file in ['style.css','assets.js']:
 files.append((root/'public/three-view'/file,'three-view/'+file))
for file in ['logo-transparent.png','boney.jpg','nesbit.jpg','snowden.jpg','youth.jpg']:
 files.append((root/'public/three-view/assets'/file,'three-view/assets/'+file))
for file in ['_headers','icon.svg']:files.append((root/'public'/file,file))
for file in ['002-live-access.sql','003-first-admin.sql']:files.append((root/'setup/supabase'/file,'setup/'+file))
files.append((root/'setup/google-sheets/LiveSync.gs','setup/LiveSync.gs'))
files.append((root/'supabase/functions/npi-admin/index.ts','setup/npi-admin.ts'))
files.append((root/'supabase/config.toml','setup/supabase-config.toml'))
for file in ['LIVE-INSTALL.md','LIVE-INSTALL.html','LIVE-AUDIT.md']:
 p=root/'setup'/file
 if p.exists():files.append((p,'setup/'+file))
preview=root/'docs/live'
if preview.exists():
 for p in preview.iterdir():
  if p.is_file():files.append((p,'setup/audit/'+p.name))
readme='''NPI ALASKA — LIVE INTEGRATION INSTALLER\n\nThis build uses real Supabase authentication, scoped database RPCs and private evidence uploads. It contains no demo-role picker or seeded test work. It is NOT installed into your Supabase project automatically.\n\nFIRST: Open setup/LIVE-INSTALL.html. Apply 002-live-access.sql, create/confirm your first Auth user and run 003-first-admin.sql with your own email. Deploy setup/npi-admin.ts as the npi-admin Edge Function and configure the private workbook bridge. Then upload the extracted frontend to the EXISTING npi-alaska Cloudflare Pages project.\n\nYour domain remains alaska.npi6030.com. No new DNS changes are required. Root and the previous /three-view/ path redirect to /live/. Do not double-click live/index.html: managed login needs HTTPS hosting.\n\nExisting browser-only sample records and prices are NOT imported. Do not erase old browser data before reviewing it. Real records in this build are stored in Supabase; sessions stay in memory and require reauthentication after reload.\n\nPriced subtotal drafts and print-to-PDF are supported. Tax/legal invoice details, final issuance, payment and reconciliation are NOT implemented. Drafts are clearly marked NOT ISSUED. No automatic email/invoice delivery occurs.\n\nThe publishable key is intentionally browser-safe. NEVER place a service-role/secret key or database password in frontend code or spreadsheet cells. No such secret is included. Work evidence is private and scoped to permitted assignments.\n'''
with zipfile.ZipFile(out/'NPI-Alaska-Live-Integration.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p,name in files:z.write(p,name)
 z.writestr('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alaska NPI</title><meta http-equiv="refresh" content="0;url=/live/"><a href="/live/">Open Alaska NPI</a></html>')
 z.writestr('_redirects','/three-view /live/ 302\n/three-view/ /live/ 302\n')
 z.writestr('READ-THIS-FIRST.txt',readme)
with zipfile.ZipFile(out/'NPI-Alaska-Live-Integration.zip') as z:
 assert z.testzip() is None
 assert 'three-view/app.js' not in z.namelist()
 assert 'three-view/index.html' not in z.namelist()
 assert not any(n.lower().endswith(('.pdf','.doc','.docx','.env')) for n in z.namelist())
 assert 'sb_secret_' not in z.read('live/config.js').decode()
print('Built NPI-Alaska-Live-Integration.zip; no demo runtime or private credentials included.')
