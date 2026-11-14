#!/usr/bin/env python3
"""Restore the unmodified, checksum-pinned Strudel browser engine and source entry points."""
from pathlib import Path
import base64, hashlib, io, json, tarfile, urllib.request
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'apps'/'loop-studio'
URL='https://registry.npmjs.org/@strudel/web/-/web-1.3.0.tgz'
INTEGRITY='sha512-iob9+OrZMM5oMQmDNQAXc6+CYnzKaOUeARs8fcRRxDDSvCxewmZf/ancwyqVSCJsVzgCgw+I9PkpFyhSpLS3FQ=='
FILES={'package/dist/index.js':'vendor/strudel-web-1.3.0.js','package/LICENSE':'vendor/LICENSE-Strudel.txt','package/web.mjs':'vendor/upstream-web.mjs','package/vite.config.js':'vendor/upstream-vite.config.js','package/package.json':'vendor/upstream-package.json'}
def main():
    data=urllib.request.urlopen(URL,timeout=60).read()
    if 'sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode()!=INTEGRITY:raise ValueError('Upstream package integrity mismatch')
    checks={}
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        for source,target in FILES.items():
            content=archive.extractfile(source).read();file=DEST/target;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(content);checks[target]=hashlib.sha256(content).hexdigest()
    receipt={'format':'portfolios-strudel-engine','version':1,'package':'@strudel/web','packageVersion':'1.3.0','tarball':URL,'integrity':INTEGRITY,'repository':'https://codeberg.org/uzu/strudel','license':'AGPL-3.0-or-later','modified':False,'files':checks}
    (DEST/'engine.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    (DEST/'LICENSE').write_bytes((DEST/'vendor/LICENSE-Strudel.txt').read_bytes())
    print('Restored Strudel web 1.3.0, five verified upstream files and license. No package scripts executed.')
if __name__=='__main__':main()
