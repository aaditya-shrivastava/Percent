-- Uses the existing administrator only inside a rolled-back transaction.
-- No Auth user or catalog/inventory test data survives this script.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from private.user_roles where role='super_admin' order by user_id limit 1),true);
do $$begin
 if auth.uid() is null then raise exception 'Existing administrator required'; end if;
 if has_function_privilege('anon','public.save_product_draft(jsonb,uuid,timestamptz)','EXECUTE') then raise exception 'Anon execution unexpectedly allowed'; end if;
end$$;
update private.user_roles set role='customer' where user_id=auth.uid();
set local role authenticated;
do $$begin
 begin perform public.save_product_draft('{}');raise exception 'Customer unexpectedly allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
update private.user_roles set role='admin' where user_id=auth.uid();
set local role authenticated;
do $$
declare d jsonb;bad jsonb;result jsonb;pid uuid;vid uuid;colour uuid;before_count integer;k text;n text;
begin
 select id into colour from public.colours order by id limit 1;
 select count(*) into before_count from public.products;
 d=jsonb_build_object('product',jsonb_build_object('name','Rollback-only RPC verification','slug','rpc-verify-'||gen_random_uuid()::text,'design_code','RPC-'||gen_random_uuid()::text,'fit_type','standard','price_paise',129900,'production_limit',250),'tags','[]'::jsonb,'variants',jsonb_build_array(jsonb_build_object('colour_id',colour,'size','S','sku','RPC-'||gen_random_uuid()::text,'price_paise',129900,'enabled',true)),'images','[]'::jsonb,'variant_images','[]'::jsonb);
 result=public.save_product_draft(d);pid=(result->>'id')::uuid;
 if not exists(select 1 from public.products where id=pid and status='draft' and not is_visible and not is_shop_available and production_limit=250 and price_paise=129900) then raise exception 'Invalid new draft';end if;
 select id into vid from public.product_variants where product_id=pid;
 d=jsonb_set(d,'{variants,0,id}',to_jsonb(vid::text));
 begin perform public.save_product_draft(d,pid,'2000-01-01');raise exception 'Stale save allowed';exception when sqlstate 'PT409' then null;end;
 foreach k in array array['status','is_visible','is_shop_available','sold_quantity','inventory_units'] loop
  bad=jsonb_set(d,array['product',k],'"active"');
  begin perform public.save_product_draft(bad,pid,(result->>'updated_at')::timestamptz);raise exception 'Forbidden field allowed';exception when invalid_parameter_value then null;end;
 end loop;
 foreach n in array array['0','-50','12.5','NaN','Infinity',''] loop
  bad=jsonb_set(d,'{product,production_limit}',to_jsonb(n));
  begin perform public.save_product_draft(bad,pid,(result->>'updated_at')::timestamptz);raise exception 'Invalid limit allowed';exception when invalid_parameter_value then null;end;
 end loop;
 bad=jsonb_set(jsonb_set(d,'{product,name}','"Must roll back"'),'{tags}',jsonb_build_array(gen_random_uuid()));
 begin perform public.save_product_draft(bad,pid,(result->>'updated_at')::timestamptz);raise exception 'Invalid tag allowed';exception when foreign_key_violation then null;end;
 if (select name from public.products where id=pid)<>'Rollback-only RPC verification' then raise exception 'Partial save detected';end if;
 bad=jsonb_set(d,'{variants}',(d->'variants')||(d->'variants'));
 begin perform public.save_product_draft(bad,pid,(result->>'updated_at')::timestamptz);raise exception 'Duplicate variants allowed';exception when unique_violation then null;end;
 bad=d#-'{variants,0,id}';
 begin perform public.save_product_draft(bad);raise exception 'Duplicate slug/code allowed';exception when unique_violation then null;end;
 bad=jsonb_set(jsonb_set(bad,'{product,slug}',to_jsonb('rpc-verify-'||gen_random_uuid()::text)),'{product,design_code}',to_jsonb('RPC-'||gen_random_uuid()::text));
 begin perform public.save_product_draft(bad);raise exception 'Duplicate SKU allowed';exception when unique_violation then null;end;
 if (select count(*) from public.products)<>before_count+1 then raise exception 'Failed create left partial row';end if;
 perform set_config('percent.test_product',pid::text,true);
 perform set_config('percent.test_draft',d::text,true);
end$$;
reset role;
update private.user_roles set role='super_admin' where user_id=auth.uid();
set local role authenticated;
do $$declare d jsonb;pid uuid;r jsonb;begin
 pid=current_setting('percent.test_product')::uuid;d=current_setting('percent.test_draft')::jsonb;
 d=jsonb_set(d,'{product,production_limit}','1000');
 r=public.save_product_draft(d,pid,(select updated_at from public.products where id=pid));
 if (select production_limit from public.products where id=pid)<>1000 then raise exception '1000 limit failed';end if;
 d=jsonb_set(d,'{product,production_limit}','1');
 perform public.save_product_draft(d,pid,(r->>'updated_at')::timestamptz);
end$$;
reset role;
insert into public.inventory_units(product_id,variant_id,piece_number) select product_id,id,1 from public.product_variants where product_id=current_setting('percent.test_product')::uuid;
update public.products set status='archived',archived_at=now() where id=current_setting('percent.test_product')::uuid;
set constraints all immediate;
set local role authenticated;
do $$begin
 begin perform public.save_product_draft(current_setting('percent.test_draft')::jsonb,current_setting('percent.test_product')::uuid,(select updated_at from public.products where id=current_setting('percent.test_product')::uuid));raise exception 'Archived save allowed';exception when invalid_parameter_value then null;end;
end$$;
reset role;
select 'passed' as transaction_authorization_validation_tests,'all test writes rolled back' as cleanup;
rollback;
