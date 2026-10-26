// Run from the repo root: node scripts/preview-social-image.mjs
// Capture http://127.0.0.1:3010 at exactly 1200x630 once the console is visible.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),vendor=resolve(dirname(require.resolve('three')),'..');
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:3010');
    let file,type;
    if(url.pathname==='/'){file=resolve(root,'scripts/social-preview.html');type='text/html; charset=utf-8';}
    else if(url.pathname==='/model.glb'){file=resolve(root,'public/models/sgbc-revc.glb');type='model/gltf-binary';}
    else if(url.pathname.startsWith('/vendor/')){file=resolve(vendor,decodeURIComponent(url.pathname.slice(8)));if(!file.startsWith(vendor+sep)||!file.endsWith('.js'))throw new Error('Not found');type='text/javascript; charset=utf-8';}
    else {res.writeHead(404);res.end();return;}
    const content=await readFile(file);res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end();}
}).listen(3010,'127.0.0.1',()=>console.log('Social image preview: http://127.0.0.1:3010 (1200x630)'));
