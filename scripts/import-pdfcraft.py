"""Restore the checksum-pinned, unmodified PdfCraft release (Python standard library)."""
import hashlib, io, json, pathlib, urllib.request, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((root / "apps/pdfcraft/release.json").read_text())
with urllib.request.urlopen(manifest["archive"], timeout=120) as response:
    archive = response.read(32 * 1024 * 1024)
if hashlib.sha256(archive).hexdigest() != manifest["sha256"]:
    raise SystemExit("PdfCraft archive checksum mismatch")
target = root / "apps/pdfcraft/runtime/v0.6.0"
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    # Read only exact receipt-listed names, never extract arbitrary archive paths.
    verified = {}
    for name, expected in manifest["files"].items():
        data = bundle.read("pdfcraft-web-0.6.0/" + name)
        if len(data) != expected["bytes"] or hashlib.sha256(data).hexdigest() != expected["sha256"]:
            raise SystemExit("PdfCraft artifact mismatch: " + name)
        verified[name] = data
    target.mkdir(parents=True, exist_ok=True)
    for name, data in verified.items():
        (target / name).write_bytes(data)
print("Verified PdfCraft 0.6.0 artifacts restored.")
