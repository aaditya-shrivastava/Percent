begin;
do $$
declare p uuid; v uuid; c uuid; lim integer; st text;
begin
 select id into c from public.colours limit 1;
 foreach lim in array array[100,250,1000] loop
  insert into public.products(design_code,slug,name,fit_type,price_paise,production_limit) values('verification-'||lim,'verification-'||lim,'Rollback verification','standard',100,lim) returning id into p;
  insert into public.product_variants(product_id,colour_id,size,sku,price_paise) values(p,c,'M','VERIFY-'||lim,100) returning id into v;
  insert into public.inventory_units(product_id,variant_id,piece_number) select p,v,n from generate_series(1,lim)n;
  update public.products set status='active',is_visible=true where id=p;
  update public.inventory_units set sold_at=now() where product_id=p and piece_number<lim;
  select status into st from public.products where id=p;
  if st<>'active' then raise exception 'Premature retirement for %',lim; end if;
  update public.inventory_units set sold_at=now() where product_id=p and piece_number=lim;
  select status into st from public.products where id=p;
  if st<>'archived' then raise exception 'Missing retirement for %',lim; end if;
  if not exists(select 1 from public.catalog_stock() where product_id=p and sold_quantity=lim and available_quantity=0) then raise exception 'Aggregate mismatch'; end if;
 end loop;
end $$;
set constraints all immediate;
select '100, 250, 1000 hosted run limits and aggregate counts passed' as result;
rollback;
