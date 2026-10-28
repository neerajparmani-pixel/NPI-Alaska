"""Create reviewable deployment/source archives; never include local credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parents[1]
out = root / 'releases'
out.mkdir(exist_ok=True)
dist = root / 'dist'
required = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png',
            'icons/icon-512.png', '_worker.js/index.js', '_routes.json']
for file in required:
    if not (dist / file).is_file():
        raise SystemExit(f'Build missing {file}; run npm run build:cloudflare first.')

def forbidden(path):
    return any(part.startswith(('.env', '.dev.vars')) or part in {'node_modules', '.git', '.wrangler', 'test-results', 'releases'} for part in path.parts)

deploy = out / 'NPI-Alaska-Deploy.zip'
with ZipFile(deploy, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(dist.rglob('*')):
        if path.is_file() and not forbidden(path.relative_to(dist)):
            archive.write(path, path.relative_to(dist))

source = out / 'NPI-Alaska-Source.zip'
roots = ['src', 'public', 'server', 'functions', 'backend', 'scripts', 'tests', 'spreadsheet-first', 'docs']
files = [p for p in root.iterdir() if p.is_file() and (p.suffix in {'.md', '.json', '.jsonc', '.html'} or p.name in {'.gitignore', 'playwright.config.js'})]
for folder in roots:
    files.extend(p for p in (root / folder).rglob('*') if p.is_file())
with ZipFile(source, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(files):
        relative = path.relative_to(root)
        if not forbidden(relative):
            archive.write(path, Path('NPI-Alaska') / relative)
for path in [deploy, source]:
    with ZipFile(path) as archive:
        if archive.testzip():
            raise SystemExit(f'Archive integrity failure: {path.name}')
    print(f'{path.name}: {path.stat().st_size} bytes; SHA256 {hashlib.sha256(path.read_bytes()).hexdigest()}')
