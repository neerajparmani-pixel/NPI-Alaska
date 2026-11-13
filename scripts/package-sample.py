"""Build a double-click preview and a separate static-host PWA sample bundle."""
from pathlib import Path
import base64,re,zipfile
root=Path(__file__).resolve().parents[1]
sample=root/'public/sample'
html=(sample/'index.html').read_text()
photo='data:image/jpeg;base64,'+base64.b64encode((sample/'alaska-illustration.jpg').read_bytes()).decode()
html=html.replace("url(\"./alaska-illustration.jpg\")",'url("'+photo+'")').replace("url('./alaska-illustration.jpg')",'url("'+photo+'")')
html=re.sub(r'<link\s+[^>]*rel="(?:manifest|icon|apple-touch-icon)"[^>]*>','',html)
js=(sample/'sample.js').read_text().replace('</script','<\\/script')
html=html.replace('<script src="./sample.js"></script>','<script>'+js+'</script>')
assert './alaska-illustration.jpg' not in html
assert 'src="./sample.js"' not in html
html=re.sub(r'(?m)^[ \t]+$', '', html)
out=root/'downloads';out.mkdir(exist_ok=True)
(out/'NPI-Alaska-Clickable-Sample.html').write_text(html)
readme='''NPI ALASKA — CLICKABLE SAMPLE\n\n1. Extract this ZIP (right-click → Extract All on Windows).\n2. Double-click START-HERE.html. Choose Chrome, Edge or Safari if asked.\n3. Use the Preview menu at the top to try Worker, Supervisor and Management.\n\nNo terminal, Google account, API key, spreadsheet setup or deployment is needed.\nUse demonstration information only. No backend is connected.\n\nWorker: start work, complete the checklist, add a SAMPLE photo, finish and submit.\nSupervisor: open Reviews, approve work or request a correction.\nManagement: Settings → People & access to add sample profiles. These do not create real accounts.\nSpreadsheet: simulate a sheet title edit, then Run demo sync. Try the older-version scenario to see conflict resolution.\nLocations: Boney Courthouse, Anchorage Youth Court, Snowden Courthouse and Nesbit Courthouse; David Dowd and Tote Port are retained as earlier discussed sites. All tasks are provisional.\n\nThe landscape is illustrative, not a photo of any named building. Original site photo files and NPI logo are pending.\n\nData stays in this browser on this device. Settings → Sample controls → Reset sample data starts over. Browser file-storage support varies; use a regular window if saving is blocked.\nA downloaded HTML file is a clickable preview. Installable/offline PWA hosting uses the separate PWA sample bundle over HTTPS.\nFinance is deferred. Two-way Supabase/Sheets synchronization, company logins and permissions require implementation and testing before real use.\n'''
with zipfile.ZipFile(out/'NPI-Alaska-Clickable-Sample.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('START-HERE.html',html);z.writestr('READ-ME.txt',readme)
with zipfile.ZipFile(out/'NPI-Alaska-PWA-Sample.zip','w',zipfile.ZIP_DEFLATED) as z:
 for path in sample.iterdir():
  if path.is_file():z.write(path,'sample/'+path.name)
 for path in (root/'public/icons').iterdir():z.write(path,'icons/'+path.name)
 for name in ['icon.svg','_headers']:z.write(root/'public'/name,name)
 z.writestr('index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NPI Alaska sample</title><meta http-equiv="refresh" content="0;url=./sample/"><a href="./sample/">Open the NPI Alaska sample</a></html>')
 z.writestr('READ-ME.txt',readme+'\nPWA BUNDLE: deploy the EXTRACTED contents as a static site on HTTPS. It opens /sample/. Includes no production backend.\n')
 for name in ['ARCHITECTURE.md','RESEARCH.md']:z.write(root/'docs/prototype'/name,'docs/'+name)
for name in ['NPI-Alaska-Clickable-Sample.zip','NPI-Alaska-PWA-Sample.zip']:
 with zipfile.ZipFile(out/name) as z:assert z.testzip() is None
print('Built standalone HTML, clickable ZIP and static PWA ZIP.')
