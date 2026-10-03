import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {MemoryRouter} from 'react-router-dom'
const require=createRequire(import.meta.url)
const pkg=name=>pathToFileURL(require.resolve(name)).href
const data=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(pkg('react/jsx-runtime')))).toString('base64')
const fixture=data(`export const usePercentSession=()=>({...globalThis.__profileNameRender,isAuthenticated:true,loading:false,role:'customer',logout:async()=>{}});export const useAccountOrders=()=>({orders:[]});export const useAccountAddresses=()=>({addresses:[]});export const updatePercentProfile=async()=>{};export const demoMemberSince='Oct 2026';export const authRouteWithReturnTo=()=>'/login';export const getSafeAuthReturnTo=()=>'/profile';`)
let shell=fs.readFileSync('src/components/account/AccountShell.tsx','utf8').replace(/from '([^']+)'/g,(_whole,name)=>`from '${name.startsWith('.')?fixture:pkg(name)}'`)
const shellUrl=data(shell)
let profile=fs.readFileSync('src/pages/AccountPages.tsx','utf8').split('export function ProfileOrdersPage()')[0]
// Exercise the original Profile and sidebar rendering; unrelated pages/hooks
// are omitted from this focused server rendering test.
profile=profile.replace(/^import .*$/gm,line=>{if(line.includes("from '../components/account/AccountShell'"))return`import {AccountShell} from '${shellUrl}'`;if(line.includes("from 'react'"))return line.replace("'react'",JSON.stringify(pkg('react')));if(line.includes("from 'react-router-dom'"))return line.replace("'react-router-dom'",JSON.stringify(pkg('react-router-dom')));if(line.includes("from 'lucide-react'"))return line.replace("'lucide-react'",JSON.stringify(pkg('lucide-react')));if(/usePercentSession|useAccountAddresses|demoMemberSince/.test(line))return line.replace(/import \{[^}]+\}/,line.includes('data/account')?'import {demoMemberSince}':line.match(/import \{[^}]+\}/)[0]).replace(/from '[^']+'/g,`from '${fixture}'`);return''})
const {ProfilePage}=await import(data(profile))
for(const [firstName,lastName,displayName] of [['Aarav','Sharma','Aarav Sharma'],['Aarav','','Aarav'],['Aarav','Kumar Sharma','Aarav Kumar Sharma'],['Edited','Customer','Edited Customer']]){globalThis.__profileNameRender={user:{firstName,lastName,displayName,email:'fixture@example.test',phone:'9999999999',id:'fixture',memberSince:'Oct 2026'}};const html=renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/profile']},React.createElement(ProfilePage)));assert(html.includes(`<strong>${displayName}</strong>`));assert(html.match(/<input[^>]*autoComplete="given-name"[^>]*>/)[0].includes(`value="${firstName}"`));assert(html.match(/<input[^>]*autoComplete="family-name"[^>]*>/)[0].includes(`value="${lastName}"`));assert(html.includes('fixture@example.test'));assert(html.includes('9999999999'));assert(!html.includes('Percent Customer'))}
console.log('PASS actual Profile form and Account sidebar render authoritative two-part, one-word, multipart and edited names; email and phone preserved')
