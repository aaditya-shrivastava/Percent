import assert from 'node:assert/strict'
import fs from 'node:fs'

const original=fs.readFileSync(new URL('migrations/20260921190000_admin_website_editor.sql',import.meta.url),'utf8')
const fix=fs.readFileSync(new URL('migrations/20260922113000_website_editor_save_delete_fix.sql',import.meta.url),'utf8')
const extract=sql=>sql.slice(sql.indexOf('create'+(sql.includes('create or replace function public.save_website_content')?' or replace':'')+' function public.save_website_content'),sql.indexOf('$$;',sql.indexOf('save_website_content'))+3)
const originalFunction=extract(original).replace('create function','create or replace function').replace('delete from public.website_sections;','delete from public.website_sections\n  where section_key is not null;').replace('delete from public.website_banners;','delete from public.website_banners\n  where id is not null;').replaceAll('\r\n','\n')
const fixedFunction=extract(fix).replaceAll('\r\n','\n')
assert.equal(fixedFunction,originalFunction,'The follow-up must differ only by CREATE OR REPLACE and the two safe DELETE predicates')
assert.equal((fix.match(/create or replace function/g)??[]).length,1)
assert.equal((fix.match(/delete from public\.website_/g)??[]).length,2)
assert.doesNotMatch(fix,/create table|alter table|create index|storage\.buckets|insert into public\.website_settings/i)
console.log('PASS Website save DELETE correction: one complete function replacement, two explicit primary-key predicates, and no structural or marketing-data mutation')
