"""Restore the checksum-pinned, unmodified Effectcraft release (Python standard library)."""
import hashlib, io, json, pathlib, urllib.request, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'apps/effectcraft/release.json').read_text(encoding='utf-8'))
print(f"Downloading {manifest['archive']}...")
req = urllib.request.Request(manifest['archive'], headers={'User-Agent': 'PortfoliOS-Restore'})
with urllib.request.urlopen(req, timeout=180) as response:
    archive = response.read()
if hashlib.sha256(archive).hexdigest() != manifest['sha256']:
    raise SystemExit('Effectcraft archive checksum mismatch')
target = root / f"apps/effectcraft/runtime/v{manifest['version']}"
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    verified = {}
    prefix = f"effectcraft-web-{manifest['version']}/"
    for name, expected in manifest['files'].items():
        data = bundle.read(prefix + name)
        if len(data) != expected['bytes'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
            raise SystemExit('Effectcraft artifact mismatch: ' + name)
        verified[name] = data
    target.mkdir(parents=True, exist_ok=True)
    for name, data in verified.items():
        p = target / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
print(f"Verified Effectcraft {manifest['version']} artifacts restored.")
