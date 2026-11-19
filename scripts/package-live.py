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
  }),
);
'''
edge=root/'supabase/functions/npi-admin/index.ts';edge.write_text(handler+wrapper)
# Render the human-facing guide without an external Markdown/runtime dependency.
source=(root/'setup/OPERATIONS-START-HERE.md').read_text()
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
(root/'setup/OPERATIONS-START-HERE.html').write_text(guide)
files=[]
for folder in ['public/live','public/three-view/fonts','public/icons']:
 for p in (root/folder).rglob('*'):
  if p.is_file():files.append((p,'frontend/'+str(p.relative_to(root/'public'))))
for name in ['style.css','assets.js','icons.js']:
 files.append((root/'public/three-view'/name,'frontend/three-view/'+name))
for name in ['logo-transparent.png','boney.jpg','nesbit.jpg','snowden.jpg','youth.jpg']:
 files.append((root/'public/three-view/assets'/name,'frontend/three-view/assets/'+name))
for name in ['_headers','icon.svg']:files.append((root/'public'/name,'frontend/'+name))
for p in (root/'setup/supabase').glob('00*.sql'):files.append((p,'backend/supabase/'+p.name))
files.extend([(edge,'backend/supabase/npi-admin.ts'),(root/'supabase/functions/npi-admin/handler.js','backend/supabase/handler.js'),(root/'supabase/config.toml','backend/supabase/config.toml'),(root/'setup/google-sheets/LiveSync.gs','backend/google-sheets/LiveSync.gs'),(root/'setup/OPERATIONS-START-HERE.md','START-HERE.md'),(root/'setup/OPERATIONS-START-HERE.html','START-HERE.html')])
for name in ['OPERATIONS-RELEASE-AUDIT.md']:
 p=root/'setup'/name
 if p.exists():files.append((p,'verification/'+name))
for p in (root/'docs/operations-release').glob('*'):
 if p.is_file():files.append((p,'verification/screens/'+p.name))
extras={'frontend/index.html':'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alaska NPI</title><meta http-equiv="refresh" content="0;url=/live/"><a href="/live/">Open Alaska NPI</a></html>','frontend/_redirects':'/three-view /live/ 302\n/three-view/ /live/ 302\n','README.txt':'ALASKA NPI OPERATIONS 1.0 — ONE COMPLETE PACKAGE\n\nOpen START-HERE.html. Existing installation: apply only migration 004, update the npi-admin Edge Function, update LiveSync.gs using the same existing secrets, then deploy the contents of frontend/ to your existing npi-alaska Cloudflare Pages project. Do not rerun 001/002/003 or change DNS.\n\nNPI invites company administrators; companies invite and approve their workers and manage their own assignments. NPI inspects original attendance, GPS, photos and hours before final work approval. Billing is excluded.\n\nThis ZIP includes all application/SQL/function/workbook source. It contains public configuration only, no server secret, private contracts, prices or seeded records. Installation/live cloud acceptance is still required; local tests are not proof of a completed remote deployment.\n'}
manifest={name:hashlib.sha256(p.read_bytes()).hexdigest() for p,name in files}
manifest.update({name:hashlib.sha256(value.encode()).hexdigest() for name,value in extras.items()})
archive=out/'NPI-Alaska-Operations-v1.0.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p,name in files:z.write(p,name)
 for name,value in extras.items():z.writestr(name,value)
 z.writestr('RELEASE-MANIFEST.json',json.dumps({'release':'Operations 1.0','sha256':manifest},indent=2))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert not any(n.endswith(('.pdf','.doc','.docx','.env')) for n in z.namelist())
 assert 'frontend/three-view/app.js' not in z.namelist()
 assert 'backend/supabase/004-operations-invitations.sql' in z.namelist()
 assert 'frontend/live/enrollment.js' in z.namelist()
 assert 'sb_secret_' not in z.read('frontend/live/config.js').decode()
 for name,digest in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest
print('Built one complete release:',archive.name,archive.stat().st_size,'bytes')
