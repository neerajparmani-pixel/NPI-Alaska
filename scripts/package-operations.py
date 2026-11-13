from pathlib import Path
import re,zipfile
root=Path(__file__).resolve().parents[1];source=root/'public/operations';out=root/'downloads';out.mkdir(exist_ok=True)
html=(source/'index.html').read_text()
html=re.sub(r'<link\s+[^>]*rel="(?:manifest|icon|apple-touch-icon)"[^>]*>','',html)
domain=re.sub(r'\bexport\s+(?=function)','',(source/'domain.js').read_text())
js=re.sub(r'^import\s*\{.*?\}\s*from\s*[\'"]\./domain.js[\'"];?','',(source/'operations.js').read_text(),flags=re.S)
html=html.replace('<script type="module" src="./operations.js"></script>','<script type="module">'+(domain+'\n'+js).replace('</script','<\\/script')+'</script>')
html=re.sub(r'(?m)^[ \t]+$','',html)
assert 'src="./operations.js"' not in html
(out/'NPI-Subcontract-Operations-Sample.html').write_text(html)
readme='''NPI SUBCONTRACT OPERATIONS — REVISED CLICKABLE SAMPLE\n\n1. Extract the ZIP.\n2. Open START-HERE.html in Chrome, Edge or Safari.\n3. Use Preview as to select Worker, Subcontractor, NPI supervisor or Management.\n\nWORKER: Check in and check out EACH require a fresh location. Choose Get my device location (requires supported browser / secure hosting) or clearly labeled Use example GPS for this sample. Choose individual or a crew roster at check-in. Finish tasks, add sample evidence and submit hours.\nSUBCONTRACTOR: Verify hours → approve own workers’ claims and forward to NPI.\nNPI SUPERVISOR: Verify hours → inspect original app times and BOTH maps → accept hours with reasons for adjustments.\nMANAGEMENT: View totals by site and individual, contracts and mixed rates, customer invoice drafts and subcontractor bill reconciliation.\nSUBCONTRACTOR BILL: Switch to Subcontractor → Invoices & bills → submit a bill. Switch to Management to match or dispute it.\n\nAll rates, people, companies and seeded GPS positions are examples. No backend, accounts, invoices, banking or spreadsheet service is connected. Manual payment/receipt entries do not transfer money. GPS is evidence, not proof of identity/presence. Crew GPS belongs to the device operator.\n\nMAPS: Original event links open the recorded coordinates in Google Maps. Candidate site addresses are separate and need verification. Real captured positions do not get a fabricated address if reverse lookup is unavailable.\nPHOTOS: Original inline photos are unavailable as files. Sites & maps lets you select a DIFFERENT actual photo for each site locally (up to 600 KB). No generated landscape is labeled as a courthouse photo.\n\nThe hosted PWA package is separate. Real browser GPS requires permission and usually HTTPS; the example GPS option exists only for reviewing this sample. Original data remains local to this browser. Use Settings to reset this revised sample only.\n'''
with zipfile.ZipFile(out/'NPI-Subcontract-Operations-Sample.zip','w',zipfile.ZIP_DEFLATED) as z:z.writestr('START-HERE.html',html);z.writestr('READ-ME.txt',readme)
with zipfile.ZipFile(out/'NPI-Subcontract-Operations-PWA.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in source.iterdir():
  if p.is_file():z.write(p,'operations/'+p.name)
 for p in (root/'public/icons').iterdir():z.write(p,'icons/'+p.name)
 for name in ['icon.svg','_headers']:z.write(root/'public'/name,name)
 z.writestr('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPI subcontract sample</title><meta http-equiv="refresh" content="0;url=./operations/"><a href="./operations/">Open NPI subcontract sample</a></html>')
 z.writestr('READ-ME.txt',readme+'\nPWA: Upload the EXTRACTED bundle to a static HTTPS host. /operations/ is the sample route. No backend is included.\n')
 z.write(root/'docs/operations/PLAN.md','docs/PLAN.md')
for name in ['NPI-Subcontract-Operations-Sample.zip','NPI-Subcontract-Operations-PWA.zip']:
 with zipfile.ZipFile(out/name) as z:assert z.testzip() is None
print('Built revised standalone HTML and two ZIPs.')
