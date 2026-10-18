import {openBrowser,guardNavigation,capturePassages} from '../../packages/browser/dist/index.js';
import {createPermissions} from '../../packages/shared/dist/index.js';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const results=[];
for(const url of ['https://example.com/','https://docs.python.org/3/tutorial/','https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide','https://nodejs.org/api/']){
 const dir=await mkdtemp(path.join(tmpdir(),'chromeclaw-diagnose-'));
 const s=await openBrowser({profileDir:dir,headless:true});
 const failed=[];s.context.on('requestfailed',r=>failed.push({url:r.url(),type:r.resourceType(),failure:r.failure()}));
 const g=await guardNavigation(s,createPermissions({origins:[new URL(url).origin],timeoutMs:60000},Date.now()));
 let error;try{await s.page.goto(url,{waitUntil:'domcontentloaded'});}catch(e){error=String(e)}
 const refusals=[];for(let i=0;i<100;i++){const f=g.refusal();if(!f)break;refusals.push(f)}
 const headings=await s.page.locator('h1').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON(),html:n.outerHTML,style:getComputedStyle(n).visibility}))).catch(()=>[]);
 const passages=await capturePassages(s.page,'diagnostic').catch(()=>null);
 results.push({url,finalUrl:s.page.url(),error,failed,refusals,headings,passages});
 await s.close();await rm(dir,{recursive:true,force:true});
}
await writeFile('.chromeclaw/phase8-live/diagnostic.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({passages,...r})=>r),null,2));
