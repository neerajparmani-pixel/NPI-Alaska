"""Produce one complete operations release; no uploaded contracts, private data or secrets."""
from pathlib import Path
import hashlib, html, json, re, zipfile
root=Path(__file__).resolve().parents[1]
out=root/'downloads';out.mkdir(exist_ok=True)
handler=(root/'supabase/functions/npi-admin/handler.js').read_text()
wrapper='''
Deno.serve((request) =>
  handleAdmin(request, {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    NPI_ORIGIN: Deno.env.get("NPI_ORIGIN") || "https://alaska.npi6030.com",
    NPI_SHEETS_ID: Deno.env.get("NPI_SHEETS_ID"),
    NPI_SHEETS_TOKEN: Deno.env.get("NPI_SHEETS_TOKEN"),
    NPI_EMAIL_API_KEY: Deno.env.get("NPI_EMAIL_API_KEY"),
    NPI_EMAIL_FROM: Deno.env.get("NPI_EMAIL_FROM"),
    NPI_VISION_API_KEY: Deno.env.get("NPI_VISION_API_KEY"),
  }),
);
'''
edge=root/'supabase/functions/npi-admin/index.ts';edge.write_text(handler+wrapper)
# Render the human-facing guide without an external Markdown/runtime dependency.
source=(root/'setup/OPERATIONS-3.1-START-HERE.md').read_text()
def inline(text):
 text=html.escape(text)
 text=re.sub(r'`([^`]+)`',r'<code>\1</code>',text)
 return re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',text)
blocks=[];list_kind=None
for line in source.splitlines():
 kind='ol' if re.match(r'^\d+\. ',line) else 'ul' if line.startswith('- ') else None
 if list_kind and kind!=list_kind:blocks.append('</'+list_kind+'>');list_kind=None
 if kind:
  if list_kind!=kind:blocks.append('<'+kind+'>');list_kind=kind
  blocks.append('<li>'+inline(re.sub(r'^(?:\d+\.|-) ', '',line))+'</li>')
 elif line.startswith('#'):
  level=len(line)-len(line.lstrip('#'));blocks.append(f'<h{level}>'+inline(line[level:].strip())+f'</h{level}>')
 elif line.strip():blocks.append('<p>'+inline(line)+'</p>')
if list_kind:blocks.append('</'+list_kind+'>')
guide='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alaska NPI Operations — Setup</title><style>body{max-width:900px;margin:36px auto;padding:0 24px;color:#182b40;background:#f3f6fa;font:16px/1.65 system-ui}h1,h2{color:#102c50;line-height:1.25}h2{margin-top:40px}li{margin-bottom:14px}code{background:#e6edf6;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}strong{color:#102c50}p,li{overflow-wrap:anywhere}</style>'+''.join(blocks)+'</html>'

stories=json.loads((root/'docs/operations-v3.1.0/training/rendered-stories.json').read_text())
training=['<h2 id="training">Three-role demonstration videos</h2><p>Actual running app with fictional records and simulated GPS/camera. The 1.75-hour value is a test fixture, not filming duration. Narration is Jenny (Dioco), a synthetic English female voice. No human presenter is shown.</p>']
for story in stories:
 role=story['role'];label={'npi':'NPI Admin','sub':'Subcontractor Admin','worker':'Worker'}[role]
 training.append(f'<article id="training-{role}"><h3>{label}</h3><p><a download href="training/{role}-walkthrough.mp4">Download video</a> · <a href="training/{role}-instructions.md">Written instructions</a></p><video controls preload="metadata" src="training/{role}-walkthrough.mp4"><track kind="captions" label="English" srclang="en" src="training/{role}-captions.vtt" default></video>')
 for scene,chapter in zip(story['scenes'],story['chapters']):
  seconds=chapter['start'];stamp=f'{int(seconds//60)}:{int(seconds%60):02}'
  training.append('<details><summary>'+html.escape(scene['title'])+' · '+stamp+'</summary><p>'+html.escape(scene['text'])+'</p></details>')
 training.append('</article>')
guide=guide.replace('</html>','<style>video{width:100%;max-height:80vh;background:#102c50}details{padding:12px 0;border-bottom:1px solid #d9e2ec}summary{cursor:pointer;font-weight:600}nav{display:flex;gap:20px;flex-wrap:wrap}article{margin-bottom:40px}body{max-width:1000px}a{color:#2459a0}</style>'+''.join(training)+'<h2>Verification</h2><p><a href="verification/audit/index.html">Screenshot audit and third-party reports</a> · <a href="verification/RELEASE-AUDIT.md">Release audit</a> · <a href="training/MEDIA-SOURCES.md">Narration sources</a></p></html>')
guide=guide.replace('<h1>','<nav><a href="#training-npi">NPI video</a><a href="#training-sub">Company video</a><a href="#training-worker">Worker video</a><a href="verification/audit/index.html">Audit</a></nav><h1>',1)
(root/'setup/OPERATIONS-3.1-START-HERE.html').write_text(guide)

files=[]
for folder in ['public/live','public/three-view/fonts','public/icons']:
 for p in (root/folder).rglob('*'):
  if p.is_file():files.append((p,'frontend/'+str(p.relative_to(root/'public'))))
for name in ['style.css','assets.js','icons.js']:
 files.append((root/'public/three-view'/name,'frontend/three-view/'+name))
for name in ['logo-transparent.png','logo-transparent.webp','boney.jpg','nesbit.jpg','snowden.jpg','youth.jpg']:
 files.append((root/'public/three-view/assets'/name,'frontend/three-view/assets/'+name))
for name in ['_headers','icon.svg']:files.append((root/'public'/name,'frontend/'+name))
for p in (root/'setup/supabase').glob('00*.sql'):files.append((p,'backend/supabase/'+p.name))
files.extend([(edge,'backend/supabase/npi-admin.ts'),(root/'supabase/functions/npi-admin/handler.js','backend/supabase/handler.js'),(root/'supabase/config.toml','backend/supabase/config.toml'),(root/'setup/google-sheets/LiveSync.gs','backend/google-sheets/LiveSync.gs'),(root/'setup/OPERATIONS-3.1-START-HERE.md','START-HERE.md'),(root/'setup/OPERATIONS-3.1-START-HERE.html','START-HERE.html')])

for name in ['RELEASE-AUDIT.md','TEST-RESULTS.json','first-party-static-audit.json','dependency-audit.json','media-verification.json','voice-spotcheck.json']:
 p=root/'docs/operations-v3.1.0'/name
 if p.exists():files.append((p,'verification/'+name))
for p in (root/'docs/operations-v3.1.0/audit').rglob('*'):
 if p.is_file():files.append((p,'verification/audit/'+str(p.relative_to(root/'docs/operations-v3.1.0/audit'))))
for p in (root/'downloads/operations-v3.1.0/training').iterdir():
 if p.is_file():files.append((p,'training/'+p.name))
for name in ['record-v31-training.mjs','render-v31-training.py','build-image-decoders.mjs','audit-v31-release.mjs','package-v31-release.py']:
 files.append((root/'scripts'/name,'training/source/'+name))
files.append((root/'tests/helpers/live-fixture.js','training/source/live-fixture.js'))
files.append((root/'tests/helpers/visits-fixture.js','training/source/visits-fixture.js'))
extras={'frontend/index.html':'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alaska NPI</title><meta http-equiv="refresh" content="0;url=/live/"><a href="/live/">Open Alaska NPI</a></html>','frontend/_redirects':'/three-view /live/ 302\n/three-view/ /live/ 302\n','README.txt':'ALASKA NPI OPERATIONS 3.1.0 — ONE COMPLETE PACKAGE\n\nOpen START-HERE.html. Existing installation: apply migration 007 AFTER existing 006 (older installations follow START-HERE), update the npi-admin Edge Function, update LiveSync.gs using the same existing secrets, then deploy the contents of frontend/ to your existing npi-alaska Cloudflare Pages project. Do not rerun 001/002/003 or change DNS.\n\nNPI configures contract line/sub-line items and company site access. Companies invite/approve workers; workers prepare their own visits without daily assignments. NPI inspects original attendance, GPS, photos and hours before final work approval. Billing is excluded.\n\nThis ZIP includes all application/SQL/function/workbook source. It contains public configuration only, no server secret, private contracts, prices or seeded records. Installation/live cloud acceptance is still required; local tests are not proof of a completed remote deployment.\n'}
# Reproducible test sources and their complete local imports. Historical prototype
# modules are source-only; only frontend/ is deployed.
for folder in ['src','server','backend','functions','scripts','tests','public','setup','supabase','spreadsheet-first']:
 for p in (root/folder).rglob('*'):
  if p.is_file() and '__pycache__'not in p.parts and p.suffix not in ['.pyc','.zip','.pdf','.doc','.docx']:
   files.append((p,'source/'+str(p.relative_to(root))))
for name in ['package.json','package-lock.json','playwright.config.js','vite.config.js','index.html','DESIGN.md','UX-CONTRACT.md']:
 if(root/name).exists():files.append((root/name,'source/'+name))
files.append((root/'downloads/NPI-Three-View-Sample.html','source/downloads/NPI-Three-View-Sample.html'))
extras['source/README-TESTS.md']='From this folder: npm ci; npm test; npx playwright install chromium; npm run test:e2e. Tests run isolated SQL engines and intercepted fictional browser backends. No production credentials are required. Training/audit reproduction requires the extra tools documented in training/MEDIA-SOURCES.md. Only ../frontend is deployable. Source contains earlier prototypes so their existing regression tests remain reproducible.\n'
manifest={name:hashlib.sha256(p.read_bytes()).hexdigest() for p,name in files}
manifest.update({name:hashlib.sha256(value.encode()).hexdigest() for name,value in extras.items()})
archive=out/'NPI-Alaska-Operations-v3.1.0.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p,name in files:z.write(p,name)
 for name,value in extras.items():z.writestr(name,value)
 z.writestr('RELEASE-MANIFEST.json',json.dumps({'release':'Operations 3.1.0','sha256':manifest},indent=2))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert not any(n.endswith(('.pdf','.doc','.docx','.env')) for n in z.namelist())
 assert 'frontend/three-view/app.js' not in z.namelist()
 assert 'backend/supabase/006-worker-led-visits.sql' in z.namelist()
 assert 'frontend/live/visits.js' in z.namelist()
 assert 'frontend/live/recovery.js' in z.namelist()
 assert 'backend/supabase/007-v3-1-hardening.sql' in z.namelist()
 assert 'source/tests/hardening.test.js' in z.namelist()
 assert 'source/package-lock.json' in z.namelist()
 assert 'NPI_EMAIL_API_KEY' in z.read('backend/supabase/npi-admin.ts').decode()
 for role in ['npi','sub','worker']:assert 'training/'+role+'-walkthrough.mp4' in z.namelist()
 assert 'frontend/live/enrollment.js' in z.namelist()
 assert 'sb_secret_' not in z.read('frontend/live/config.js').decode()
 for name,digest in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest
print('Built one complete release:',archive.name,archive.stat().st_size,'bytes',hashlib.sha256(archive.read_bytes()).hexdigest())
