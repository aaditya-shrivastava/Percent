import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'vite'
import {loadFontHandler} from './website-font-test-runtime.mjs'

// Runs production components and the production Edge handler. Only Supabase's
// transport/SQL boundary is replaced; hosted acceptance is recorded separately.
const {state,handler,client}=await loadFontHandler()
const caller=client('', '',{global:{headers:{Authorization:'Bearer admin-test-only'}}})
const require=createRequire(import.meta.url)
const {chromium}=require('C:/Users/mihir/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const entry=`import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';import{createBrowserRouter,RouterProvider}from'react-router-dom';import{AdminGlobalWebsiteEditor}from'/src/pages/admin/AdminGlobalWebsiteEditor.tsx';import{WebsiteContentProvider,StorefrontTheme}from'/src/components/layout/WebsiteContentContext.tsx';import{loadStorefrontWebsite}from'/src/backend/website.ts';
function Store(){const [value,setValue]=useState(null);useEffect(()=>{loadStorefrontWebsite().then(setValue)},[]);return value?<WebsiteContentProvider value={value}><div className='storefront-shell'><StorefrontTheme/><div className='hero'><h1>Display</h1></div><h2>Heading sample Percent</h2><p>Body sample Percent</p><button>UI sample</button></div></WebsiteContentProvider>:null}createRoot(document.getElementById('root')).render(<RouterProvider router={createBrowserRouter([{path:'/admin/website/preview',element:<div>Preview frame</div>},{path:'/admin/website/:section',element:<AdminGlobalWebsiteEditor/>},{path:'/shop',element:<Store/>}])}/>);`
const mock=`export const projectRef='gijyjdeohvdrnvqfqdha';export const supabase={rpc:async(name,args)=>fetch('/__font-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})}).then(r=>r.json()),functions:{invoke:async(name,{body})=>{const form=body instanceof FormData;const r=await fetch('/__font-media',{method:'POST',headers:form?{}:{'Content-Type':'application/json'},body:form?body:JSON.stringify(body)});if(!r.ok)return{data:null,error:{context:r}};return{data:r.headers.get('content-type')?.includes('application/octet-stream')?await r.blob():await r.json(),error:null}}}};`
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:5195,strictPort:true},logLevel:'error',plugins:[{name:'font-test-boundaries',enforce:'pre',resolveId(id){if(id==='font-test-entry')return '\0font-test-entry'},load(id){if(id==='\0font-test-entry')return {code:entry.replaceAll('<','<'),map:null};if(id.replaceAll('\\','/').endsWith('/src/backend/client.ts'))return mock},transform(code,id){if(id==='\0font-test-entry')return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}))},configureServer(vite){vite.middlewares.use(async(req,res,next)=>{try{if(req.url==='/__font-rpc'||req.url?.startsWith('/__font-media')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);let result;if(req.url==='/__font-rpc'){const {name,args}=JSON.parse(body);result=Response.json(await caller.rpc(name,args))}else{const headers=new Headers(req.headers);headers.set('Authorization','Bearer admin-test-only');result=await handler(new Request('http://localhost'+req.url.replace('/__font-media',''),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body})}))}res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return}if(req.headers.accept?.includes('text/html')){res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,`<html><head><style>*{box-sizing:border-box}body{margin:0;font-family:Arial;background:#091218;color:#edf1f2}#root{padding:16px}.storefront-shell{padding:20px}</style></head><body><div id='root'></div><script type='module' src='/@id/font-test-entry'></script></body></html>`));return}next()}catch(e){res.statusCode=500;res.end(String(e))}})}}]})
await server.listen()
const browser=await chromium.launch({headless:true,channel:'msedge'})
const errors=[],widths=[1440,1280,1024,834,768,600,426,425,390,375,360,320]
const output='docs/backend/custom-font-ui-results.json'
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}})
 page.on('pageerror',e=>errors.push(e.message))
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text())})
 const network=[]
 await page.route('https://gijyjdeohvdrnvqfqdha.supabase.co/functions/v1/percent-website-media?font=*',async route=>{const response=await handler(new Request(route.request().url()));network.push({status:response.status,cache:response.headers.get('cache-control'),cors:response.headers.get('access-control-allow-origin')});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})})
 await page.goto('http://127.0.0.1:5195/admin/website/typography')
 await page.getByRole('button',{name:'+ Upload Font Family',exact:true}).waitFor()
 assert.equal(await page.locator('.font-role-grid select').nth(1).locator('option').count(),12)
 const originalAdmin=await page.locator('.website-page-head h1').evaluate(e=>getComputedStyle(e).fontFamily)
 await page.getByRole('button',{name:'+ Upload Font Family',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByLabel('Font family name').fill('Disposable OFL acceptance font')

 const registry=JSON.parse(fs.readFileSync('public/fonts/builtin/registry.json'))
 const lora=registry.find(f=>f.id==='lora').assets.find(a=>a.path.includes('latin-wght-normal'))?.path??registry.find(f=>f.id==='lora').assets.find(a=>a.path.includes('normal')).path
 const file='public'+lora
 await dialog.locator('input[type=file]').first().setInputFiles(file)
 await dialog.getByRole('button',{name:'+ Add Another Font File'}).click()
 await dialog.locator('input[type=file]').nth(1).setInputFiles(file)
 await dialog.locator('.font-face-controls select').nth(2).selectOption('700')
 assert.equal(await dialog.getByRole('button',{name:'Save Font Family'}).isEnabled(),false)
 await dialog.getByRole('checkbox').check()
 await page.waitForFunction(()=>[...document.fonts].some(f=>f.family.startsWith('PercentUpload_')&&f.status==='loaded'))
 for(const width of widths){await page.setViewportSize({width,height:1000});assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`dialog overflow ${width}`);if(width===320)await page.screenshot({path:'docs/backend/custom-font-upload-mobile.png',fullPage:false})}
 await dialog.getByRole('button',{name:'Save Font Family'}).click()
 await dialog.waitFor({state:'hidden'})
 assert.equal(state.families.length,1);assert.equal(state.files.size,2)
 await page.locator('.font-card').getByRole('button',{name:'Disable',exact:true}).click()
 await page.locator('.font-card').getByRole('button',{name:'Enable',exact:true}).waitFor()
 assert.equal(state.families[0].enabled,false)
 await page.locator('.font-card').getByRole('button',{name:'Enable',exact:true}).click()
 await page.locator('.font-card').getByRole('button',{name:'Disable',exact:true}).waitFor()
 await page.locator('.font-card').getByRole('button',{name:'Manage',exact:true}).click()
 await dialog.getByLabel('Font family name').fill('Disposable OFL acceptance font — renamed')
 await dialog.getByRole('button',{name:'Save Font Family'}).click()
 await dialog.waitFor({state:'hidden'})
 assert.equal(state.files.size,2)
 const family=state.families[0],reference='custom:'+family.id
 await page.locator('.font-role-grid select').nth(1).selectOption(reference)
 assert.equal(state.global.typography.heading_family,'Inter','draft does not publish')
 await page.getByRole('button',{name:'Save Changes',exact:true}).click()
 await page.getByText('Global settings saved.',{exact:true}).waitFor()
 assert.equal(state.global.typography.heading_family,reference);assert.equal(state.global.typography.body_family,'Inter');assert.equal(state.global.typography.ui_family,'Inter')
 assert.equal(await page.locator('.website-page-head h1').evaluate(e=>getComputedStyle(e).fontFamily),originalAdmin)
 const card=page.locator('.font-card')
 assert.equal(await card.getByRole('button',{name:'Delete',exact:true}).isEnabled(),false)
 assert.equal(await card.getByRole('button',{name:'Disable',exact:true}).isEnabled(),false)
 for(const width of widths){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`editor overflow ${width}`);if(width===320)await page.screenshot({path:'docs/backend/custom-font-editor-mobile.png',fullPage:true})}
 await page.setViewportSize({width:1440,height:1000})
 await page.screenshot({path:'docs/backend/custom-font-editor-desktop.png',fullPage:true})
 const shop=await browser.newPage()
 await shop.route('https://gijyjdeohvdrnvqfqdha.supabase.co/functions/v1/percent-website-media?font=*',async route=>{const r=await handler(new Request(route.request().url()));network.push({status:r.status,cache:r.headers.get('cache-control'),cors:r.headers.get('access-control-allow-origin')});await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())})})
 const styles=()=>shop.evaluate(()=>Object.fromEntries(['.hero h1','h2','p','button'].map(s=>[s,getComputedStyle(document.querySelector(s)).fontFamily])))
 await shop.goto('http://127.0.0.1:5195/shop');await shop.locator('h2').waitFor();await shop.evaluate(()=>document.fonts.ready)
 let result=await styles();assert.ok(result.h2.includes('PercentCustom_'));assert.ok(result.p.includes('PercentBuiltin_inter'));assert.ok(result.button.includes('PercentBuiltin_inter'));assert.ok(result['.hero h1'].includes('PercentBuiltin_inter'))
 await shop.reload();await shop.locator('h2').waitFor();assert.ok((await styles()).h2.includes('PercentCustom_'))
 assert.ok(network.some(n=>n.status===200&&n.cors==='*'&&n.cache.includes('immutable')))
 await card.getByRole('button',{name:'Apply Everywhere',exact:true}).click()
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.getByText('Global settings saved.',{exact:true}).waitFor()
 await shop.reload();await shop.locator('h2').waitFor();for(const stack of Object.values(await styles()))assert.ok(stack.includes('PercentCustom_'))
 await page.reload();await page.locator('.font-role-grid select').nth(1).waitFor();assert.equal(await page.locator('.font-role-grid select').nth(1).inputValue(),reference)
 await page.getByLabel('One font for all four roles').selectOption('Inter')
 await page.locator('.font-apply').getByRole('button',{name:'Apply Everywhere'}).click()
 await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.getByText('Global settings saved.',{exact:true}).waitFor()
 page.on('dialog',dialog=>dialog.accept())
 await page.locator('.font-card').getByRole('button',{name:'Delete',exact:true}).click();await page.getByText('No custom families yet.',{exact:false}).waitFor()
 assert.equal(state.families.length,0);assert.equal(state.files.size,0)
 assert.equal(errors.length,0,errors.join('\n'))
 const report={boundary:'Actual UI/Edge, simulated Supabase SQL/Storage; not hosted acceptance',widths,passed:['multiface licensed upload/preview','Heading only; Body/UI unchanged','draft then publish','refresh/direct navigation','opaque WOFF2/CORS/cache','Apply Everywhere four roles','Admin font isolation','active delete/disable safeguards','restore original typography','delete and Storage cleanup/no fixtures','no console errors'],network,errors}
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('PASS Custom Font UI acceptance and all 12 responsive widths (simulated Supabase boundary)')
}finally{await browser.close();await server.close()}
