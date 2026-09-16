import fs from 'node:fs'
import { randomUUID, randomBytes } from 'node:crypto'

// Disposable verification accounts only. Apply generated SQL using the connector
// after verifying Percent. Never use this script to provision a permanent admin.
const target = new URL('../.env.admin-role-test', import.meta.url)
if (fs.existsSync(target)) throw new Error('Clean up existing role-test fixtures first')
const users = ['customer','admin','super_admin',null].map(role=>({id:randomUUID(),role}))
const password = randomBytes(24).toString('hex')
const literal = value => value === null ? 'null' : `'${String(value).replaceAll("'","''")}'`
const insert = users.map(u=>`('00000000-0000-0000-0000-000000000000',${literal(u.id)},'authenticated','authenticated',${literal(`admin-rpc-${u.id}@example.invalid`)},extensions.crypt(${literal(password)},extensions.gen_salt('bf')),now(),'','','','',now(),now())`).join(',')
const setup = `begin; insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at) values ${insert};\n` + users.map(u=>u.role===null?`delete from private.user_roles where user_id=${literal(u.id)};`:`update private.user_roles set role=${literal(u.role)} where user_id=${literal(u.id)};`).join('\n')+'\ncommit;'
const cleanup = `delete from auth.users where id in (${users.map(u=>literal(u.id)).join(',')});`
fs.writeFileSync(target,JSON.stringify({projectRef:'gijyjdeohvdrnvqfqdha',users,password,setup,cleanup}))
console.log('Prepared ignored disposable fixtures for the verified Percent project.')
