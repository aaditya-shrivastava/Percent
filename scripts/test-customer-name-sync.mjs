import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(compile(source)).toString('base64')
const names=await import(moduleUrl(fs.readFileSync('src/backend/customerName.ts','utf8')))
for(const [input,first,last,display] of [['Aarav Sharma','Aarav','Sharma','Aarav Sharma'],['Aarav','Aarav','','Aarav'],['Aarav Kumar Sharma','Aarav','Kumar Sharma','Aarav Kumar Sharma'],['  Aarav   Sharma  ','Aarav','Sharma','Aarav Sharma']])assert.deepEqual(names.parseCustomerName(input),{first_name:first,last_name:last,display_name:display})
assert.equal(names.parseCustomerName(' '.repeat(3)),null)
assert.equal(names.parseCustomerName('x'.repeat(121)),null)
assert.equal(names.customerDisplayName({display_name:'',first_name:null,last_name:null}), 'Percent Customer')
assert.equal(names.customerDisplayName({display_name:'Percent Customer',first_name:'Saved',last_name:'Name'},'Google Name'),'Saved Name')
const fixture={firebaseUser:{uid:'firebase-user',email:'do-not-use-as-name@example.test',displayName:'Aarav Sharma'},status:'ready',profile:{id:'percent-user',display_name:'Percent Customer',first_name:null,last_name:null,phone:'9999999999',created_at:'2026-01-01'},role:'customer',writes:[],listeners:new Set(),gate:null,concurrentEdit:null,writeError:false}
globalThis.__nameTest=fixture
const boundary=moduleUrl(`const s=globalThis.__nameTest;
export const firebaseAuth={get currentUser(){return s.firebaseUser}};
export const getFirebaseSessionSnapshot=()=>({status:s.status});
export const subscribeToFirebaseSession=f=>{s.listeners.add(f);return()=>s.listeners.delete(f)};
export const ensureFirebaseAuthenticatedClaim=async()=>{};
export const legacySupabaseAuth={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}}};
export const firebaseSupabase={rpc:async(name)=>({data:name==='get_my_role'?s.role:'percent-user',error:null}),from:()=>{const filters=[];let changes=null;const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},is:(k,v)=>{filters.push([k,v]);return q},single:()=>q,update:v=>{changes=v;return q},then:(yes,no)=>(async()=>{if(s.gate)await s.gate;if(changes){if(s.writeError)return{data:null,error:{message:'fixture'}};if(s.concurrentEdit){s.profile={...s.profile,...s.concurrentEdit};s.concurrentEdit=null}if(filters.every(([k,v])=>s.profile[k]===v)){s.writes.push(changes);s.profile={...s.profile,...changes}}}return{data:{...s.profile},error:null}})().then(yes,no)};return q}};`)
let sessionSource=fs.readFileSync('src/backend/percentSession.ts','utf8').replace(/from '\.\/customerName'/g,`from '${moduleUrl(fs.readFileSync('src/backend/customerName.ts','utf8'))}'`).replace(/from '\.\/(?:firebase|firebaseSession|firebaseSupabase|legacySupabaseAuth)'/g,`from '${boundary}'`)
fixture.status='loading'
const session=await import(moduleUrl(sessionSource))
fixture.status='ready'
await session.refreshPercentSession()
assert.equal(fixture.profile.display_name,'Aarav Sharma');assert.equal(fixture.profile.first_name,'Aarav');assert.equal(fixture.profile.last_name,'Sharma');assert.equal(fixture.profile.phone,'9999999999')
assert.equal(session.getPercentSessionSnapshot().user.displayName,'Aarav Sharma')
const writeCount=fixture.writes.length
fixture.firebaseUser.displayName='Different Google Name';await session.refreshPercentSession();assert.equal(fixture.writes.length,writeCount);assert.equal(fixture.profile.display_name,'Aarav Sharma')
await session.updateCurrentPercentProfile({firstName:'Edited',lastName:'Customer',phone:'9999999999'});await session.refreshPercentSession();assert.equal(fixture.profile.display_name,'Edited Customer');assert.equal(session.getPercentSessionSnapshot().user.displayName,'Edited Customer')
fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.firebaseUser.displayName='Google Initial Name';await session.refreshPercentSession();assert.equal(fixture.profile.first_name,'Google');assert.equal(fixture.profile.last_name,'Initial Name')
fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.firebaseUser.displayName=null;await session.refreshPercentSession();assert.equal(fixture.profile.display_name,'Percent Customer');assert.equal(session.getPercentSessionSnapshot().user.displayName,'Percent Customer')
fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.firebaseUser.displayName='Signup Name';fixture.status='loading';let finished=false;const signup=session.completeCustomerSignupName('  Aarav   Kumar Sharma ').then(()=>{finished=true});await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);fixture.status='ready';for(const listener of fixture.listeners)listener();await signup;assert.equal(fixture.profile.display_name,'Aarav Kumar Sharma');assert.equal(session.getPercentSessionSnapshot().user.lastName,'Kumar Sharma')
fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.concurrentEdit={display_name:'Concurrent Edit',first_name:'Concurrent',last_name:'Edit'};fixture.firebaseUser.displayName='Google Must Lose';await session.refreshPercentSession();assert.equal(fixture.profile.display_name,'Concurrent Edit');assert.equal(session.getPercentSessionSnapshot().user.displayName,'Concurrent Edit')
fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.role='super_admin';await session.refreshPercentSession();assert.equal(fixture.profile.display_name,'Percent Customer');assert.equal(session.getPercentSessionSnapshot().isSuperAdmin,true)
const authSource=fs.readFileSync('src/pages/AuthPages.tsx','utf8');assert.match(authSource,/!busy&&!loading&&isAuthenticated/);assert.match(authSource,/await updateProfile\(credential.user,\{displayName:parsedName.display_name\}\)[\s\S]*await completeCustomerSignupName\(parsedName.display_name\)/)
console.log('PASS name parsing, signup persistence/hydration, Google initialization, generic fallback, existing/edit authority, concurrent edit protection, phone preservation and staff isolation')
fixture.role='customer'
for(const [input,first,last,display] of [['Aarav Sharma','Aarav','Sharma','Aarav Sharma'],['Aarav','Aarav','','Aarav'],['Aarav Kumar Sharma','Aarav','Kumar Sharma','Aarav Kumar Sharma'],['  Aarav   Sharma  ','Aarav','Sharma','Aarav Sharma'],['Percent Customer','Percent','Customer','Percent Customer']]){fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.firebaseUser.displayName=input;await session.completeCustomerSignupName(input);assert.equal(fixture.profile.first_name,first);assert.equal(fixture.profile.last_name,last);assert.equal(fixture.profile.display_name,display);await session.refreshPercentSession();assert.equal(session.getPercentSessionSnapshot().user.displayName,display)}
fixture.profile={...fixture.profile,display_name:'Percent Customer',first_name:null,last_name:null};fixture.firebaseUser.displayName='Retry Name';fixture.writeError=true;await assert.rejects(session.completeCustomerSignupName('Retry Name'),/Unable to save your name/);assert.equal(fixture.profile.display_name,'Percent Customer');fixture.writeError=false
console.log('PASS all requested signup persistence cases, genuine generic-name input and controlled save failure')
