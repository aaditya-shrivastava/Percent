import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {MemoryRouter} from 'react-router-dom'
import postcss from 'postcss'
const require=createRequire(import.meta.url),pkg=name=>pathToFileURL(require.resolve(name)).href
const data=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(pkg('react/jsx-runtime')))).toString('base64')
const homepage=data(fs.readFileSync('src/data/homepage.ts','utf8'))
const fixture=data(`export const useCartCount=()=>globalThis.__navbarTest.count;export const usePercentSession=()=>({isAuthenticated:globalThis.__navbarTest.auth});export const useWebsiteContent=()=>({document:{settings:{navbar_items:[],branding:{display_name:'Percent',tagline:'Less Ordinary. More You.'}}}});`)
const source=fs.readFileSync('src/components/layout/Header.tsx','utf8').replace(/from '([^']+)'/g,(_whole,name)=>`from '${name.endsWith('/data/homepage')?homepage:name.startsWith('.')?fixture:pkg(name)}'`)
const {Header}=await import(data(source))
for(const auth of [false,true])for(const count of [0,3,125]){globalThis.__navbarTest={auth,count};const html=renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:['/shop']},React.createElement(Header)));assert.match(html,new RegExp(`class="icon-button profile-action"[^>]*href="${auth?'/profile':'/login'}"`));assert(html.includes('href="/cart"'));for(const label of ['Search Percent','Profile','Cart','Open navigation menu'])assert(html.includes(`aria-label="${label}"`));if(count)assert(html.includes(`<span aria-hidden="true">${Math.min(count,99)}</span>`));else assert(!html.includes('<span aria-hidden="true">0</span>'));assert(html.indexOf('aria-label="Search Percent"')<html.indexOf('aria-label="Profile"'));assert(html.indexOf('aria-label="Profile"')<html.indexOf('aria-label="Cart"'))}
const current=fs.readFileSync('src/index.css','utf8'),baseline=execFileSync('git',['show','HEAD:src/index.css'],{encoding:'utf8'})
const desktopRules=css=>{const root=postcss.parse(css);root.walkAtRules('media',rule=>{if(rule.params==='(max-width:639px)')rule.remove()});return root.toString().replaceAll('\r\n','\n')}
assert.equal(desktopRules(current),desktopRules(baseline),'No CSS outside the existing mobile breakpoint may change')
const mobile=postcss.parse(current).nodes.find(n=>n.type==='atrule'&&n.name==='media'&&n.params==='(max-width:639px)')
assert(!mobile.toString().includes('.header-actions>a:nth-child(2)'))
assert(mobile.nodes.some(n=>n.selector==='.header-actions .cart-action'&&n.nodes.some(d=>d.prop==='order'&&d.value==='1')))
assert(mobile.nodes.some(n=>n.selector==='.header-actions .profile-action'&&n.nodes.some(d=>d.prop==='order'&&d.value==='2')))
console.log('PASS shared Header anonymous/Customer routes, labels, desktop DOM order, cart badge/count/cap, and exact unchanged desktop CSS outside mobile breakpoint')
