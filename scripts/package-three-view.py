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
js=(source/'app.js').read_text();js=re.sub(r'import\s*\{[^}]*\}\s*from\s*[\'"]\./rates.js[\'"];?','',js);js=re.sub(r'^\s*import\s*\{.*?\}\s*from\s*[\'"]\.\./operations/domain.js[\'"];?','',js,flags=re.S)
js=re.sub(r'import\s*\{[^}]*\}\s*from\s*[\'"]\./workbook.js[\'"];?','',js)
js=re.sub(r'import\s*\{[^}]*\}\s*from\s*[\'"]\./assets.js[\'"];?','',js)
artwork=(source/'assets.js').read_text().replace('export const','const')
for photo in (source/'assets').glob('*'):
 if photo.suffix not in ['.jpg','.png']:continue
 artwork=artwork.replace('./assets/'+photo.name,('data:image/png;base64,' if photo.suffix=='.png' else 'data:image/jpeg;base64,')+base64.b64encode(photo.read_bytes()).decode())
workbook=re.sub(r'\bexport\s+(?=(?:function|const))','',(source/'workbook.js').read_text())
domain=re.sub(r'\bexport\s+(?=function)','',(root/'public/operations/domain.js').read_text())
html=html.replace('<script type="module" src="./app.js"></script>','<script type="module">'+(artwork+'\n'+domain+'\n'+workbook+'\n'+re.sub(r'\bexport\s+(?=(?:function|const))','',(source/'rates.js').read_text())+'\n'+js).replace('</script','<\\/script')+'</script>')
html=re.sub(r'(?m)^[ \t]+$','',html)
assert 'src="./app.js"' not in html
assert 'href="./style.css"' not in html
(out/'NPI-Three-View-Sample.html').write_text(html)
readme='''NPI ALASKA — THREE-VIEW CLICKABLE SAMPLE\n\n1. Extract this ZIP.\n2. Open START-HERE.html in Chrome, Edge or Safari.\n3. Choose NPI Admin, Subcontractor Admin or Subcontractor Worker on the welcome screen or in the top-bar role selector.\n\nThis is a local sample. No real login is needed.\nUploaded contracts, actual prices, private contacts and signatures are NOT included. Invoice checklists remain unpriced. Settings now supports blank local customer/subcontractor rate lists and a quantity calculator; no real prices are seeded.\n\nTRY THE FLOW:\nWorker → My work → View assignment → Check in (new location required) → complete checklist/evidence → Check out (another new location required) → submit hours.\nSubcontractor Admin → Review hours → inspect evidence → approve and forward to NPI.\nNPI Admin → Verify hours → compare original evidence and the claim → accept per-worker hours with a reason for any changes.\nFor hauling, add a sample timecard and whole-number load count.\nCompany admin can prepare unpriced quantity claims from NPI-approved work. NPI reviews those separately.\n\nDevice GPS requires permission and a supported secure browser context, usually HTTPS. Use example GPS only to try the sample; it is explicitly simulated.\nPhotos picked in the app stay on your device. Four original site photos from the uploaded image ZIP are embedded. A transparent logo was prepared with the image-editing tool from the supplied reference. It is an edited derivative, not the original vector artwork.\nNo Supabase/Sheets connection, account provisioning, background sync, invoice delivery or bank payment occurs.\n\nLAYOUT: Refined typography and responsive mobile/desktop layout, based on the NPI identity. The transparent emblem appears across the welcome, header and Settings.\n'''
readme+='\nMANAGEMENT: Schedule & dispatch, Reports & audit, Management workbook and Workspace settings are available from NPI Admin. Workbook changes are reviewed locally, with stale/protected edits rejected. The transparent logo and four site photos are included.\n'
readme+='\nWATCH FIRST: Open GUIDE.html for the narrated walkthrough, then START-HERE.html. The video uses a synthetic voice instructor and captions. Sample controls below the work screen let you move between review stages.\n'
readme+='\nTEST: Click Start test transaction. Use check-in, tasks/photo, checkout, then the Company review and NPI approval buttons. This creates one local test work order, never a payment.\nPICTURES: Use Paste your logo on the welcome screen and Paste site photo under Sites & snowfall. Copy the actual chat image, then paste into the portal. Artwork up to 8 MB is stored unchanged on your device. Settings > Download with my pictures creates a standalone copy with artwork only. The default package includes the four supplied building photos and transparent logo.\n'
with zipfile.ZipFile(out/'NPI-Three-View-Sample.zip','w',zipfile.ZIP_DEFLATED) as z:z.writestr('START-HERE.html',html);z.writestr('READ-ME.txt',readme);z.writestr('SOURCE-SANS-LICENSE.txt',(source/'fonts/SOURCE-SANS-LICENSE.txt').read_text());z.writestr('FEATURES.md',(root/'docs/three-view/FEATURES.md').read_text())
with zipfile.ZipFile(out/'NPI-Three-View-PWA.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in source.rglob("*"):
  if p.is_file():z.write(p,'three-view/'+str(p.relative_to(source)))
 z.writestr('START-HERE.html',html)
 z.write(root/'public/operations/domain.js','operations/domain.js')
 for p in (root/'public/icons').iterdir():z.write(p,'icons/'+p.name)
 for name in ['icon.svg','_headers']:z.write(root/'public'/name,name)
 z.writestr('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPI three-view sample</title><meta http-equiv="refresh" content="0;url=./three-view/"><a href="./three-view/">Open the NPI sample</a></html>')
 z.writestr('READ-ME.txt',readme+'\nPWA: Upload EXTRACTED contents to an HTTPS static host. This is not a connected production app.\n')
for name in ['NPI-Three-View-Sample.zip','NPI-Three-View-PWA.zip']:
 with zipfile.ZipFile(out/name,'a',zipfile.ZIP_DEFLATED) as z:
  for guide in ['GUIDE.html','NPI-Quick-Guide.mp4','NPI-Quick-Guide.vtt','NPI-Quick-Guide-Transcript.md','NPI-Image-Preview.png']:z.write(out/guide,guide)
for name in ['NPI-Three-View-Sample.zip','NPI-Three-View-PWA.zip']:
 with zipfile.ZipFile(out/name) as z:
  assert z.testzip() is None
  assert not any(p.lower().endswith(('.pdf','.doc','.docx')) for p in z.namelist())
with zipfile.ZipFile(out/'NPI-Setup-Package.zip','w',zipfile.ZIP_DEFLATED) as z:
 with zipfile.ZipFile(out/'NPI-Three-View-PWA.zip') as frontend:
  for name in frontend.namelist():z.writestr(name,frontend.read(name))
 for p in (root/'setup').rglob('*'):
  if p.is_file():z.write(p,'setup/'+str(p.relative_to(root/'setup')))
 z.writestr('READ-THIS-FIRST.txt','Open START-HERE.html to try the local app. Read setup/START-HERE.md for Supabase and Google Sheets setup. This package is NOT a connected production installation. Four supplied site photos and the transparent logo are included. See setup/SETUP.html for a browser-readable guide.')
with zipfile.ZipFile(out/'NPI-Setup-Package.zip') as z:assert z.testzip() is None
print('Built local app and setup ZIPs; no private contracts or real prices included.')

import shutil
shutil.copyfile(out/'NPI-Setup-Package.zip',out/'NPI-Alaska-Deployment-Package.zip')
