import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { pathToFileURL } from 'node:url'

const root=path.resolve(import.meta.dirname,'..')
const runtime=path.join(root,'node_modules/.tmp/admin-test-runtime')
for(const file of ['backend/client','backend/admin/access','backend/admin/role','backend/admin/metrics','backend/admin/dashboard']){
  const source=fs.readFileSync(path.join(root,'src',file+'.ts'),'utf8')
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from '(\.[^']+)'/g,"from '$1.mjs'")
  const dest=path.join(runtime,file+'.mjs');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,output)
}
const {supabase}=await import(pathToFileURL(path.join(runtime,'backend/client.mjs')))
const {loadDashboard}=await import(pathToFileURL(path.join(runtime,'backend/admin/dashboard.mjs')))
const config=JSON.parse(fs.readFileSync(path.join(root,'.env.admin-role-test'),'utf8'))
assert.equal(config.projectRef,'gijyjdeohvdrnvqfqdha')
const results=[]
try{
  for(const user of config.users){
    assert.equal((await supabase.auth.signInWithPassword({email:`admin-rpc-${user.id}@example.invalid`,password:config.password})).error,null)
    if(user.role==='admin'||user.role==='super_admin'){
      const data=await loadDashboard(user.id,'30',new AbortController().signal)
      assert.equal(data.revenuePaise,0);assert.equal(data.orderCount,0);assert.equal(data.liveProducts,0)
      assert.equal(data.draftProducts,27);assert.equal(data.registeredAccounts,4)
      assert.deepEqual(data.recentOrders,[]);assert.deepEqual(data.sales,[]);assert.deepEqual(data.alerts,[])
    }else await assert.rejects(loadDashboard(user.id,'30',new AbortController().signal))
    results.push({role:user.role,status:'passed'});console.log('PASS dashboard '+(user.role??'missing-role'))
    await supabase.auth.signOut()
  }
}finally{
  await supabase.auth.signOut()
  fs.writeFileSync(path.join(root,'docs/backend/admin-dashboard-hosted-tests.json'),JSON.stringify({projectRef:config.projectRef,fixtureAccounts:4,results},null,2)+'\n')
}
