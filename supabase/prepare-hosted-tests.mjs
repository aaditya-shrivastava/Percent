import fs from 'node:fs'
import {randomUUID,randomBytes} from 'node:crypto'
// Run only after verifying the exact project via the Supabase connector.
const fixture={users:[randomUUID(),randomUUID()],password:randomBytes(24).toString('hex')}
if(fs.existsSync('.env.hosted-test'))throw new Error('Existing test fixtures must be cleaned first')
fs.writeFileSync('.env.hosted-test',JSON.stringify(fixture))
fs.writeFileSync('supabase/hosted-fixture.sql',`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,created_at,updated_at) values `+fixture.users.map(id=>`('00000000-0000-0000-0000-000000000000','${id}','authenticated','authenticated','phase2-${id}@example.invalid',extensions.crypt('${fixture.password}',extensions.gen_salt('bf')),now(),'','','','',now(),now())`).join(',')+';')
console.log('Prepared temporary test fixture files. Apply only to the verified Percent project; remove test users and local fixture files afterward.')
