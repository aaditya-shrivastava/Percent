import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const config=JSON.parse(fs.readFileSync(new URL('../.env.admin-role-test',import.meta.url),'utf8'))
assert.equal(config.projectRef,'gijyjdeohvdrnvqfqdha')
const url=`https://${config.projectRef}.supabase.co`,key='sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc'
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const anon=client(),clients=[],results=[]
const test=async(name,fn)=>{await fn();results.push({name,status:'passed'});console.log('PASS '+name)}
try {
  await test('Unauthenticated caller cannot execute or request another identity',async()=>{
    assert.ok((await anon.rpc('get_my_role')).error)
    assert.ok((await anon.rpc('get_my_role',{user_id:config.users[1].id})).error)
  })
  for(const fixture of config.users){
    const c=client();clients.push(c)
    await test(`Hosted ${fixture.role??'missing-role'} identity returns only its own scalar role`,async()=>{
      const login=await c.auth.signInWithPassword({email:`admin-rpc-${fixture.id}@example.invalid`,password:config.password});assert.equal(login.error,null)
      const user=await c.auth.getUser();assert.equal(user.data.user.id,fixture.id)
      const result=await c.rpc('get_my_role');assert.equal(result.error,null);assert.equal(result.data,fixture.role)
      assert.ok((await c.rpc('get_my_role',{user_id:config.users.find(u=>u.id!==fixture.id).id})).error)
      const privateRead=await c.schema('private').from('user_roles').select('role');assert.equal(privateRead.error?.code,'PGRST106')
      assert.ok((await c.schema('private').from('user_roles').update({role:'super_admin'}).eq('user_id',fixture.id)).error)
      const metadata=await c.auth.updateUser({data:{role:'super_admin'}});assert.equal(metadata.error,null)
      assert.equal((await c.rpc('get_my_role')).data,fixture.role)
      // A fresh client restores the actual session, then resolves the role again.
      const fresh=client();clients.push(fresh)
      const tokens=(await c.auth.getSession()).data.session
      assert.equal((await fresh.auth.setSession({access_token:tokens.access_token,refresh_token:tokens.refresh_token})).error,null)
      assert.equal((await fresh.rpc('get_my_role')).data,fixture.role)
    })
  }
} finally {
  for(const c of clients) await c.auth.signOut()
  fs.writeFileSync(new URL('../docs/backend/admin-role-hosted-tests.json',import.meta.url),JSON.stringify({projectRef:config.projectRef,results},null,2)+'\n')
}
