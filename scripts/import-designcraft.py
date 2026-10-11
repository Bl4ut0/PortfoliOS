"""Restore the checksum-pinned, unmodified Designcraft release (Python standard library)."""
import hashlib, io, json, pathlib, urllib.request, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'apps/designcraft/release.json').read_text(encoding='utf-8'))
print(f"Downloading {manifest['archive']}...")
req = urllib.request.Request(manifest['archive'], headers={'User-Agent': 'PortfoliOS-Restore'})
with urllib.request.urlopen(req, timeout=180) as response:
    archive = response.read()
if hashlib.sha256(archive).hexdigest() != manifest['sha256']:
    raise SystemExit('Designcraft archive checksum mismatch')
target = root / f"apps/designcraft/runtime/v{manifest['version']}"
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    verified = {}
    prefix = f"designcraft-web-{manifest['version']}/"
    for name, expected in manifest['files'].items():
        member = pathlib.PurePosixPath(name)
        if member.is_absolute() or '\\' in name or any(part in ('', '.', '..') for part in name.split('/')):
            raise SystemExit('Unsafe runtime asset path: ' + name)
        data = bundle.read(prefix + name)
        if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
            raise SystemExit('Designcraft artifact mismatch: ' + name)
        verified[name] = data
    target.mkdir(parents=True, exist_ok=True)
    for name, data in verified.items():
        p = target / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
print(f"Verified Designcraft {manifest['version']} artifacts restored.")
