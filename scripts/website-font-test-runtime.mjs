import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { defaultGlobalFixture } from './website-font-test-settings.mjs'

export async function loadFontHandler(){
 const state={families:[],files:new Map(),downloads:0,role:'admin',global:structuredClone(defaultGlobalFixture),updated_at:'2026-01-01T00:00:00.000Z',version:0,calls:[]}
 const safe=f=>({...f,faces:f.faces.map(({asset_id,weight,style})=>({asset_id,weight,style}))})
 const content=(admin=true)=>({updated_at:state.updated_at,settings:structuredClone(state.global),sections:[{section_key:'brand_story',heading:'What We Do',enabled:true,sort_order:1}],banners:[],font_families:state.families.filter(f=>admin||f.enabled&&f.in_use).map(safe)})
 const conflict=()=>({data:null,error:{code:'PT409',message:'Font family changed'}})
 const failure=(code,message)=>({data:null,error:{code,message}})
 const client=(url,key,options)=>{
  const service=key==='service-test-only',token=options?.global?.headers?.Authorization?.replace('Bearer ','')
  const role=token==='admin-test-only'?'admin':token==='super_admin-test-only'?'super_admin':token==='customer-test-only'?'customer':null
  return {async rpc(name,args={}){
   state.calls.push({name,role,service})
   if(name==='get_my_role')return{data:role,error:role?null:{code:'42501'}}
   if(name==='get_website_font_management_catalog')return service?{data:structuredClone(state.families),error:null}:failure('42501','Permission denied')
   if(name==='get_website_font_delivery_asset'){
    if(!service)return failure('42501','Permission denied')
    const face=state.families.filter(f=>f.enabled&&f.in_use).flatMap(f=>f.faces).find(f=>f.asset_id===args.p_asset_id)
    return {data:face?structuredClone(face):null,error:null}
   }
   if(name==='get_storefront_content')return{data:content(false),error:null}
   if(!['admin','super_admin'].includes(role))return failure('42501','Admin access required')
   if(name==='get_website_editor')return{data:content(),error:null}
   if(name==='save_website_global_settings'){
    if(args.expected_updated_at!==state.updated_at)return conflict()
    for(const key of ['display_family','heading_family','body_family','ui_family']){const ref=args.content.typography[key];if(ref.startsWith('custom:')&&!state.families.some(f=>f.enabled&&`custom:${f.id}`===ref))return failure('22023','Unavailable font')}
    state.global={...state.global,...structuredClone(args.content)};state.updated_at=new Date(Date.now()+(++state.version)).toISOString()
    for(const family of state.families)family.in_use=Object.values(state.global.typography).includes(`custom:${family.id}`)
    return{data:content(),error:null}
   }
   if(name==='save_website_font_family'){
    const current=state.families.find(f=>f.id===args.p_family_id)
    if((current?.updated_at??null)!==args.p_expected_updated_at)return conflict()
    if(!args.p_license_confirmed)return failure('22023','License required')
    if(state.families.some(f=>f.id!==args.p_family_id&&f.family_name.toLowerCase()===args.p_family_name.toLowerCase()))return failure('23505','Duplicate')
    if(current?.in_use&&(!args.p_enabled||current.faces.some(old=>!args.p_faces.some(x=>x.storage_path===old.storage_path))))return failure('22023','This font is currently used')
    if(new Set(args.p_faces.map(x=>`${x.weight}:${x.style}`)).size!==args.p_faces.length)return failure('22023','Duplicate face')
    for(const face of args.p_faces)if(!state.files.has(face.storage_path))return failure('22023','Missing object')
    const stamp=new Date(Date.now()+(++state.version)).toISOString()
    const family={id:args.p_family_id,family_name:args.p_family_name,enabled:args.p_enabled,created_at:current?.created_at??stamp,updated_at:stamp,in_use:current?.in_use??false,faces:args.p_faces.map(x=>({...x,asset_id:current?.faces.find(old=>old.storage_path===x.storage_path)?.asset_id??crypto.randomUUID()}))}
    state.families=state.families.filter(f=>f.id!==family.id);state.families.push(family)
    return{data:{font_families:state.families.map(safe)},error:null}
   }
   if(name==='delete_website_font_family'){
    const current=state.families.find(f=>f.id===args.p_family_id)
    if(!current||current.updated_at!==args.p_expected_updated_at)return conflict()
    if(current.in_use)return failure('22023','This font is currently used')
    state.families=state.families.filter(f=>f.id!==current.id);return{data:{removed:true},error:null}
   }
   return{data:[],error:null}
  },storage:{from(){return{
   async upload(name,data){if(state.files.has(name))return{error:{message:'Exists'}};state.files.set(name,new Blob([data],{type:data.type??'font/woff2'}));return{data:{path:name},error:null}},
   async download(name){state.downloads++;return{data:state.files.get(name)??null,error:state.files.has(name)?null:{message:'Missing'}}},
   async remove(names){for(const name of names)state.files.delete(name);return{error:null}},
   async list(folder,options={}){const names=[...state.files.keys()];if(!folder)return{data:[{name:'fonts',id:null}],error:null};const files=names.filter(name=>name.startsWith(folder+'/')).map(name=>({name:name.slice(folder.length+1),id:'object'}));return{data:files.slice(options.offset??0,(options.offset??0)+(options.limit??1000)),error:null}},
   async createSignedUrls(){return{data:[],error:null}},async createSignedUrl(){return{data:{signedUrl:'https://example.test/image-only'},error:null}}
  }}}}
 }
 globalThis.__fontMockClient=client
 let handler
 globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://gijyjdeohvdrnvqfqdha.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-test-only',SUPABASE_ANON_KEY:'anon-test-only'})[name]},serve:fn=>{handler=fn}}
 const compiled=new Map()
 function compile(filename){
  const absolute=path.resolve(filename);if(compiled.has(absolute))return compiled.get(absolute)
  let code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText
  code=code.replace(/from ['"](\.[^'"]+)['"]/g,(_,relative)=>`from '${compile(path.resolve(path.dirname(absolute),relative))}'`)
  code=code.replace("from 'npm:fontkit@2.0.4'","from 'fontkit'")
  // data URLs cannot resolve bare npm packages; use the actual pinned Node file.
  code=code.replace("from 'fontkit'",`from '${new URL('../node_modules/fontkit/dist/module.mjs',import.meta.url).href}'`)
  code=code.replace("import { createClient } from 'npm:@supabase/supabase-js@2.99.1';","const createClient=globalThis.__fontMockClient;")
  const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');compiled.set(absolute,url);return url
 }
 await import(compile('supabase/functions/percent-website-media/index.ts')+'#'+Math.random())
 const {decodeWoff2}=await import(compile('supabase/functions/percent-website-media/font-decoder.ts'))
 return{state,handler,content,client,decodeWoff2}
}
