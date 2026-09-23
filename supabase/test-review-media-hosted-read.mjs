import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url='https://gijyjdeohvdrnvqfqdha.supabase.co',key='sb_publishable_QxLwW-LIAjzV-s8YbKMP2Q_-FqY_DXc'
const email=process.argv[2]
if(!email)throw new Error('Email argument required')
const password=await new Promise(resolve=>{process.stdin.setRawMode(true);process.stdin.resume();process.stdin.once('data',data=>{process.stdin.pause();process.stdin.setRawMode(false);resolve(data.toString().trim())});console.log('Waiting for password via masked stdin')})
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
try{
 const login=await client.auth.signInWithPassword({email,password});assert.equal(login.error,null)
 assert.equal((await client.rpc('get_my_role')).data,'super_admin')
 const response=await fetch(`${url}/functions/v1/percent-review-media`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${login.data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'admin_read',review_id:'00000000-0000-4000-a000-000000000000'})})
 assert.equal(response.status,404)
 assert.equal((await response.json()).error,'Review unavailable')
 console.log('PASS Hosted admin review media: authenticated super_admin reached admin_read; nonexistent review failed closed without Storage disclosure')
}finally{await client.auth.signOut({scope:'local'})}
