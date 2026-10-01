begin;

-- Product colours already form part of the product-variant identity through
-- product_variants.colour_id. Extend that authoritative table instead of
-- introducing a second colour catalogue or rewriting existing UUIDs.
alter table public.colours
  add column enabled boolean not null default true,
  add column sort_order integer not null default 0,
  add column normalized_name text generated always as (
    lower(regexp_replace(btrim(label), '[[:space:]]+', ' ', 'g'))
  ) stored;

alter table public.colours
  add constraint colours_label_length
    check (char_length(btrim(label)) between 1 and 80) not valid,
  add constraint colours_sort_order_range
    check (sort_order between 0 and 1000000) not valid;

alter table public.colours validate constraint colours_label_length;
alter table public.colours validate constraint colours_sort_order_range;

create unique index colours_normalized_name_key
  on public.colours (normalized_name);
create index colours_enabled_sort_order_idx
  on public.colours (enabled, sort_order, normalized_name);

-- Preserve the order presented by the current Product Editor.
update public.colours
set sort_order = case slug
  when 'burgundy' then 0
  when 'ivory' then 1
  when 'charcoal' then 2
  when 'stone' then 3
  when 'taupe' then 4
  else 1000
end;

-- Sizes remain snapshot text on product_variants. This table controls future
-- selection only, so disabling or renaming an option cannot rewrite history.
create table public.product_size_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized_label text generated always as (
    lower(regexp_replace(btrim(label), '[[:space:]]+', ' ', 'g'))
  ) stored,
  enabled boolean not null default true,
  sort_order integer not null default 0
    check (sort_order between 0 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(label)) between 1 and 40),
  unique (normalized_label)
);

create index product_size_options_enabled_sort_order_idx
  on public.product_size_options (enabled, sort_order, normalized_label);

alter table public.product_size_options enable row level security;
revoke all on table public.product_size_options from public, anon, authenticated;
grant all on table public.product_size_options to service_role;

create trigger touch_updated_at
before update on public.product_size_options
for each row execute function private.touch_updated_at();

insert into public.product_size_options (label, enabled, sort_order)
values
  ('S', true, 0),
  ('M', true, 1),
  ('L', true, 2),
  ('XL', true, 3)
on conflict (normalized_label) do nothing;

-- Browser writes to colour options now go through the narrow RPCs below.
-- Public SELECT remains because visible storefront variants join this table.
revoke insert, update, delete on table public.colours from public, anon, authenticated;

create or replace function private.guard_used_colour_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.label, new.slug) is distinct from (old.label, old.slug)
     and exists (
       select 1
       from public.product_variants as variant
       where variant.colour_id = old.id
     ) then
    raise exception 'This color is used by existing product variants. Keep its name and disable it instead.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_used_colour_identity() from public, anon, authenticated;

create trigger guard_used_colour_identity
before update of label, slug on public.colours
for each row execute function private.guard_used_colour_identity();

-- Existing variants may continue using disabled or legacy options. A newly
-- created variant, or an existing variant whose identity changes, must use a
-- currently enabled managed option.
create or replace function private.guard_product_variant_options()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  normalized_size text := lower(regexp_replace(btrim(new.size), '[[:space:]]+', ' ', 'g'));
begin
  if tg_op = 'INSERT' or new.colour_id is distinct from old.colour_id then
    if not exists (
      select 1
      from public.colours as colour
      where colour.id = new.colour_id
        and colour.enabled
    ) then
      raise exception 'Choose an enabled managed color' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT'
     or normalized_size is distinct from lower(regexp_replace(btrim(old.size), '[[:space:]]+', ' ', 'g')) then
    if not exists (
      select 1
      from public.product_size_options as size_option
      where size_option.normalized_label = normalized_size
        and size_option.enabled
    ) then
      raise exception 'Choose an enabled managed size' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_product_variant_options() from public, anon, authenticated;

create trigger guard_product_variant_options
before insert or update of colour_id, size on public.product_variants
for each row execute function private.guard_product_variant_options();

create or replace function public.admin_list_product_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  result jsonb;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'colors', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', colour.id,
          'name', colour.label,
          'normalized_name', colour.normalized_name,
          'hex_code', upper(colour.swatch_value),
          'enabled', colour.enabled,
          'sort_order', colour.sort_order,
          'created_at', colour.created_at,
          'updated_at', colour.updated_at,
          'usage_count', (
            select count(*)
            from public.product_variants as variant
            where variant.colour_id = colour.id
          )
        )
        order by colour.sort_order, colour.normalized_name, colour.id
      )
      from public.colours as colour
    ), '[]'::jsonb),
    'sizes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', size_option.id,
          'label', size_option.label,
          'normalized_label', size_option.normalized_label,
          'enabled', size_option.enabled,
          'sort_order', size_option.sort_order,
          'created_at', size_option.created_at,
          'updated_at', size_option.updated_at,
          'usage_count', (
            select count(*)
            from public.product_variants as variant
            where lower(regexp_replace(btrim(variant.size), '[[:space:]]+', ' ', 'g')) = size_option.normalized_label
          )
        )
        order by size_option.sort_order, size_option.normalized_label, size_option.id
      )
      from public.product_size_options as size_option
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.save_product_color_option(
  option_id uuid,
  option_name text,
  hex_code text,
  option_enabled boolean,
  option_sort_order integer,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  safe_name text := regexp_replace(btrim(coalesce(option_name, '')), '[[:space:]]+', ' ', 'g');
  safe_hex text := upper(btrim(coalesce(hex_code, '')));
  generated_slug text;
  current_row public.colours;
  saved_row public.colours;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if char_length(safe_name) not between 1 and 80
     or safe_hex !~ '^#[0-9A-F]{6}$'
     or option_enabled is null
     or option_sort_order is null
     or option_sort_order not between 0 and 1000000 then
    raise exception 'Invalid color option' using errcode = '22023';
  end if;

  if option_id is null then
    if expected_updated_at is not null then
      raise exception 'Unexpected color version' using errcode = '22023';
    end if;

    generated_slug := trim(both '-' from regexp_replace(lower(safe_name), '[^a-z0-9]+', '-', 'g'));
    if generated_slug = '' then
      generated_slug := 'color';
    end if;
    if exists (select 1 from public.colours where slug = generated_slug) then
      generated_slug := generated_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    end if;

    insert into public.colours (slug, label, swatch_value, enabled, sort_order)
    values (generated_slug, safe_name, safe_hex, option_enabled, option_sort_order)
    returning * into saved_row;
  else
    select * into current_row
    from public.colours
    where id = option_id
    for update;

    if not found then
      raise exception 'Color option unavailable' using errcode = 'P0002';
    end if;
    if expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then
      raise exception 'Color option changed; reload before saving' using errcode = 'PT409';
    end if;

    update public.colours
    set label = safe_name,
        swatch_value = safe_hex,
        enabled = option_enabled,
        sort_order = option_sort_order
    where id = option_id
    returning * into saved_row;
  end if;

  return jsonb_build_object(
    'id', saved_row.id,
    'name', saved_row.label,
    'hex_code', upper(saved_row.swatch_value),
    'enabled', saved_row.enabled,
    'sort_order', saved_row.sort_order,
    'updated_at', saved_row.updated_at
  );
exception
  when unique_violation then
    raise exception 'A color with this name already exists' using errcode = '23505';
end;
$$;

create or replace function public.save_product_size_option(
  option_id uuid,
  option_label text,
  option_enabled boolean,
  option_sort_order integer,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  safe_label text := regexp_replace(btrim(coalesce(option_label, '')), '[[:space:]]+', ' ', 'g');
  current_row public.product_size_options;
  saved_row public.product_size_options;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if char_length(safe_label) not between 1 and 40
     or option_enabled is null
     or option_sort_order is null
     or option_sort_order not between 0 and 1000000 then
    raise exception 'Invalid size option' using errcode = '22023';
  end if;

  if option_id is null then
    if expected_updated_at is not null then
      raise exception 'Unexpected size version' using errcode = '22023';
    end if;

    insert into public.product_size_options (label, enabled, sort_order)
    values (safe_label, option_enabled, option_sort_order)
    returning * into saved_row;
  else
    select * into current_row
    from public.product_size_options
    where id = option_id
    for update;

    if not found then
      raise exception 'Size option unavailable' using errcode = 'P0002';
    end if;
    if expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then
      raise exception 'Size option changed; reload before saving' using errcode = 'PT409';
    end if;

    update public.product_size_options
    set label = safe_label,
        enabled = option_enabled,
        sort_order = option_sort_order
    where id = option_id
    returning * into saved_row;
  end if;

  return jsonb_build_object(
    'id', saved_row.id,
    'label', saved_row.label,
    'enabled', saved_row.enabled,
    'sort_order', saved_row.sort_order,
    'updated_at', saved_row.updated_at
  );
exception
  when unique_violation then
    raise exception 'A size with this label already exists' using errcode = '23505';
end;
$$;

create or replace function public.admin_reorder_product_options(
  option_type text,
  ordered_ids uuid[],
  expected_updated_at timestamptz[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  safe_type text := lower(btrim(coalesce(option_type, '')));
  expected_count integer;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if safe_type not in ('color', 'size')
     or ordered_ids is null
     or expected_updated_at is null
     or cardinality(ordered_ids) <> cardinality(expected_updated_at)
     or cardinality(ordered_ids) <> (
       select count(distinct value) from unnest(ordered_ids) as value
     ) then
    raise exception 'Invalid option order' using errcode = '22023';
  end if;

  if safe_type = 'color' then
    select count(*) into expected_count from public.colours;
    perform 1 from public.colours order by id for update;
    if cardinality(ordered_ids) <> expected_count
       or exists (select value from unnest(ordered_ids) as value except select id from public.colours)
       or exists (
         select 1
         from unnest(ordered_ids, expected_updated_at) as expected(id, version)
         join public.colours as colour on colour.id = expected.id
         where colour.updated_at is distinct from expected.version
       ) then
      raise exception 'Color options changed; reload before reordering' using errcode = 'PT409';
    end if;

    with requested as (
      select id, ordinality - 1 as sort_order
      from unnest(ordered_ids) with ordinality as item(id, ordinality)
    )
    update public.colours as colour
    set sort_order = requested.sort_order
    from requested
    where colour.id = requested.id;
  else
    select count(*) into expected_count from public.product_size_options;
    perform 1 from public.product_size_options order by id for update;
    if cardinality(ordered_ids) <> expected_count
       or exists (select value from unnest(ordered_ids) as value except select id from public.product_size_options)
       or exists (
         select 1
         from unnest(ordered_ids, expected_updated_at) as expected(id, version)
         join public.product_size_options as size_option on size_option.id = expected.id
         where size_option.updated_at is distinct from expected.version
       ) then
      raise exception 'Size options changed; reload before reordering' using errcode = 'PT409';
    end if;

    with requested as (
      select id, ordinality - 1 as sort_order
      from unnest(ordered_ids) with ordinality as item(id, ordinality)
    )
    update public.product_size_options as size_option
    set sort_order = requested.sort_order
    from requested
    where size_option.id = requested.id;
  end if;

  return public.admin_list_product_options();
end;
$$;

revoke all on function public.admin_list_product_options() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_product_options() to authenticated;

revoke all on function public.save_product_color_option(uuid, text, text, boolean, integer, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.save_product_color_option(uuid, text, text, boolean, integer, timestamptz) to authenticated;

revoke all on function public.save_product_size_option(uuid, text, boolean, integer, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.save_product_size_option(uuid, text, boolean, integer, timestamptz) to authenticated;

revoke all on function public.admin_reorder_product_options(text, uuid[], timestamptz[]) from public, anon, authenticated, service_role;
grant execute on function public.admin_reorder_product_options(text, uuid[], timestamptz[]) to authenticated;

comment on table public.product_size_options is
  'Authoritative Admin-managed size choices for future product variants; variants retain size snapshots.';
comment on function public.admin_list_product_options() is
  'Returns managed product colors and sizes, including disabled options and real variant usage counts, to an internally authorized Percent Admin.';
comment on function public.save_product_color_option(uuid, text, text, boolean, integer, timestamptz) is
  'Creates or updates one managed product color with validation and optimistic concurrency; used color identity is immutable.';
comment on function public.save_product_size_option(uuid, text, boolean, integer, timestamptz) is
  'Creates or updates one managed future size choice with validation and optimistic concurrency without rewriting variant snapshots.';
comment on function public.admin_reorder_product_options(text, uuid[], timestamptz[]) is
  'Atomically reorders the complete color or size option list after validating every row version.';

commit;
