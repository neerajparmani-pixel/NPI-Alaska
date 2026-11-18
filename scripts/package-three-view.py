"""Explicit allowlist packaging: never include uploaded documents or private review files."""
from pathlib import Path
import re,zipfile,base64
root=Path(__file__).resolve().parents[1];source=root/'public/three-view';out=root/'downloads';out.mkdir(exist_ok=True)
html=(source/'index.html').read_text();css=(source/'style.css').read_text()
css='/* Source Sans 3 font license\n'+(source/'fonts/SOURCE-SANS-LICENSE.txt').read_text()+'\n*/\n'+css
for font in (source/'fonts').glob('*.woff2'):
 css=css.replace('./fonts/'+font.name,'data:font/woff2;base64,'+base64.b64encode(font.read_bytes()).decode())
html=html.replace('<link rel="stylesheet" href="./style.css" />','<style>'+css+'</style>')
html=re.sub(r'<link\s+[^>]*rel="(?:manifest|icon|apple-touch-icon)"[^>]*>','',html)
js=(source/'app.js').read_text();js=re.sub(r'^import\s*\{.*?\}\s*from\s*[\'"]\.\./operations/domain.js[\'"];?','',js,flags=re.S)
js=re.sub(r'import\s*\{[^}]*\}\s*from\s*[\'"]\./workbook.js[\'"];?','',js)
workbook=re.sub(r'\bexport\s+(?=(?:function|const))','',(source/'workbook.js').read_text())
domain=re.sub(r'\bexport\s+(?=function)','',(root/'public/operations/domain.js').read_text())
html=html.replace('<script type="module" src="./app.js"></script>','<script type="module">'+(domain+'\n'+workbook+'\n'+js).replace('</script','<\\/script')+'</script>')
html=re.sub(r'(?m)^[ \t]+$','',html)
assert 'src="./app.js"' not in html
assert 'href="./style.css"' not in html
(out/'NPI-Three-View-Sample.html').write_text(html)
readme='''NPI ALASKA — THREE-VIEW CLICKABLE SAMPLE\n\n1. Extract this ZIP.\n2. Open START-HERE.html in Chrome, Edge or Safari.\n3. Choose NPI Admin, Subcontractor Admin or Subcontractor Worker on the welcome screen or in the top-bar role selector.\n\nThis is a local sample. No real login is needed.\nUploaded contracts, actual prices, private contacts and signatures are NOT included. Billing shows quantities and statuses only, with no financial amounts.\n\nTRY THE FLOW:\nWorker → My work → View assignment → Check in (new location required) → complete checklist/evidence → Check out (another new location required) → submit hours.\nSubcontractor Admin → Review hours → inspect evidence → approve and forward to NPI.\nNPI Admin → Verify hours → compare original evidence and the claim → accept per-worker hours with a reason for any changes.\nFor hauling, add a sample timecard and whole-number load count.\nCompany admin can prepare unpriced quantity claims from NPI-approved work. NPI reviews those separately.\n\nDevice GPS requires permission and a supported secure browser context, usually HTTPS. Use example GPS only to try the sample; it is explicitly simulated.\nPhotos picked in the app stay on your device. The actual site images shown earlier in chat are not embedded because their original files are unavailable.\nNo Supabase/Sheets connection, account provisioning, background sync, invoice delivery or bank payment occurs.\n\nLAYOUT: Refined typography and responsive mobile/desktop layout, based on the NPI identity. Insert the original emblem unchanged in NPI Admin > Settings. No replacement lion has been drawn.\n'''
readme+='\nMANAGEMENT: Schedule & dispatch, Reports & audit, Management workbook and Workspace settings are available from NPI Admin. Workbook changes are reviewed locally, with stale/protected edits rejected. Original logo image bytes remain pending.\n'
with zipfile.ZipFile(out/'NPI-Three-View-Sample.zip','w',zipfile.ZIP_DEFLATED) as z:z.writestr('START-HERE.html',html);z.writestr('READ-ME.txt',readme);z.writestr('SOURCE-SANS-LICENSE.txt',(source/'fonts/SOURCE-SANS-LICENSE.txt').read_text());z.writestr('FEATURES.md',(root/'docs/three-view/FEATURES.md').read_text())
with zipfile.ZipFile(out/'NPI-Three-View-PWA.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in source.rglob("*"):
  if p.is_file():z.write(p,'three-view/'+str(p.relative_to(source)))
 z.write(root/'public/operations/domain.js','operations/domain.js')
 for p in (root/'public/icons').iterdir():z.write(p,'icons/'+p.name)
 for name in ['icon.svg','_headers']:z.write(root/'public'/name,name)
 z.writestr('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPI three-view sample</title><meta http-equiv="refresh" content="0;url=./three-view/"><a href="./three-view/">Open the NPI sample</a></html>')
 z.writestr('READ-ME.txt',readme+'\nPWA: Upload EXTRACTED contents to an HTTPS static host. This is not a connected production app.\n')
for name in ['NPI-Three-View-Sample.zip','NPI-Three-View-PWA.zip']:
 with zipfile.ZipFile(out/name) as z:
  assert z.testzip() is None
  assert not any(p.lower().endswith(('.pdf','.doc','.docx')) for p in z.namelist())
print('Built three-view HTML and ZIPs; no document files included.')
