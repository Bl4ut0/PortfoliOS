import { initialize, getService, IEditorService } from '@codingame/monaco-vscode-api';
import getWorkbench from '@codingame/monaco-vscode-workbench-service-override';
import getFiles, { registerFileSystemOverlay, FileSystemProviderCapabilities, FileType, FileSystemProviderError, FileSystemProviderErrorCode } from '@codingame/monaco-vscode-files-service-override';
import getConfiguration from '@codingame/monaco-vscode-configuration-service-override';
import getTheme from '@codingame/monaco-vscode-theme-service-override';
import '@codingame/monaco-vscode-theme-defaults-default-extension';
import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';
import { Event, Emitter } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
const origin=location.origin,pending=new Map();
function rpc(op,path,value){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('SystemFS request timed out'));},20000);pending.set(id,{resolve,reject,timer});parent.postMessage({type:'code:fs',id,op,path,value},origin);});}
addEventListener('message',async event=>{if(event.source!==parent||event.origin!==origin)return;const m=event.data;if(m?.type==='code:fs-result'&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(new FileSystemProviderError(m.error,m.notFound?FileSystemProviderErrorCode.FileNotFound:FileSystemProviderErrorCode.Unknown));else p.resolve(m.value);}
 else if(m?.type==='code:flush'){try{const result=await(await getService(IEditorService)).saveAll();parent.postMessage({type:'code:flushed',id:m.id,ok:result.success!==false},origin);}catch(error){parent.postMessage({type:'code:flushed',id:m.id,ok:false,error:error.message},origin);}}
 else if(m?.type==='code:open'&&typeof m.path==='string')await(await getService(IEditorService)).openEditor({resource:URI.file(m.path),options:{pinned:true}});
});
const changes=new Emitter();
registerFileSystemOverlay(10,{
 capabilities:FileSystemProviderCapabilities.FileReadWrite|FileSystemProviderCapabilities.PathCaseSensitive,onDidChangeCapabilities:Event.None,onDidChangeFile:changes.event,watch:()=>({dispose(){}}),
 stat:uri=>rpc('stat',uri.path),readdir:uri=>rpc('list',uri.path),readFile:async uri=>new Uint8Array(await rpc('read',uri.path)),
 writeFile:async(uri,bytes,options)=>{await rpc('write',uri.path,{bytes,create:options.create,overwrite:options.overwrite});changes.fire([{type:0,resource:uri}]);},
 mkdir:async uri=>{await rpc('mkdir',uri.path);changes.fire([{type:1,resource:uri}]);},
 delete:async(uri,options)=>{await rpc('delete',uri.path,{recursive:options.recursive});changes.fire([{type:2,resource:uri}]);},
 rename:async(from,to,options)=>{await rpc('rename',from.path,{target:to.path,overwrite:options.overwrite});changes.fire([{type:2,resource:from},{type:1,resource:to}]);}
});
try{
 await initialize({...getFiles(),...getConfiguration(),...getTheme(),...getWorkbench()},document.getElementById('workbench'),{workspaceProvider:{workspace:{folderUri:URI.file('/documents')},open:async()=>false},configurationDefaults:{'workbench.colorTheme':'Default Dark Modern','workbench.startupEditor':'none','files.autoSave':'afterDelay','files.autoSaveDelay':1000,'telemetry.telemetryLevel':'off','security.workspace.trust.enabled':false},productConfiguration:{nameShort:'Code OSS',nameLong:'PortfoliOS Code OSS',applicationName:'portfolios-code-oss'}});
 parent.postMessage({type:'code:ready'},origin);
}catch(error){parent.postMessage({type:'code:failed',error:error.message},origin);console.error(error);}
