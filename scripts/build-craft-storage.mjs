/** Rebuild the isolated in-frame storage shim from exact dependencies. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),build=path.join(root,'.tmp/craft-host-build');fs.mkdirSync(build,{recursive:true});
for(const [source,target] of [['session-storage-package.json','package.json'],['session-storage-package-lock.json','package-lock.json']])fs.copyFileSync(path.join(root,'apps/_shared/licenses',source),path.join(build,target));
if(process.argv.includes('--install')){const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--no-audit','--no-fund'],{cwd:build,stdio:'inherit',windowsHide:true,shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status||1);}
const {build:bundle}=await import(pathToFileURL(path.join(build,'node_modules/esbuild/lib/main.js')));
await bundle({entryPoints:[path.join(root,'apps/_shared/session-storage-source.js')],outfile:path.join(root,'apps/_shared/session-storage.js'),bundle:true,minify:true,format:'iife',target:'es2022',nodePaths:[path.join(build,'node_modules')]});console.log('Isolated Craft storage shim rebuilt.');
