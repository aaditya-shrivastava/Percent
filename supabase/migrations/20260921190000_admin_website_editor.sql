begin;

create table public.website_settings (
  id text primary key check (id = 'storefront'),
  footer_tagline text not null default '' check (char_length(footer_tagline) <= 80),
  footer_description text not null default '' check (char_length(footer_description) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.website_sections (
  section_key text primary key check (section_key in (
    'limited_editions', 'best_sellers', 'trending', 'new_arrivals',
    'oversized_fit', 'shop_by_design', 'brand_story'
  )),
  heading text not null check (char_length(btrim(heading)) between 1 and 100),
  subheading text check (subheading is null or char_length(btrim(subheading)) between 1 and 200),
  body text check (body is null or char_length(btrim(body)) between 1 and 600),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  cta_path text check (
    cta_path is null or (
      cta_path ~ '^/(?:[a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9-]*)*)?(?:\?[a-z0-9][a-z0-9%._=&-]*)?$'
      and cta_path not like '%..%'
      and cta_path not like '//%'
    )
  ),
  media_path text unique,
  media_alt text check (media_alt is null or char_length(btrim(media_alt)) between 1 and 160),
  media_width integer check (media_width is null or media_width between 1 and 12000),
  media_height integer check (media_height is null or media_height between 1 and 12000),
  enabled boolean not null default true,
  sort_order smallint not null check (sort_order between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sort_order),
  check ((cta_label is null) = (cta_path is null)),
  check ((media_path is null) = (media_alt is null)),
  check ((media_path is null) = (media_width is null)),
  check ((media_path is null) = (media_height is null)),
  check (media_path is null or media_path ~ ('^sections/' || section_key || '/[0-9a-f]{64}\.(jpg|png|webp)$'))
);

create table public.website_banners (
  id uuid primary key,
  image_path text not null unique,
  mobile_image_path text unique,
  alt text not null check (char_length(btrim(alt)) between 1 and 160),
  width integer not null check (width between 1 and 12000),
  height integer not null check (height between 1 and 12000),
  mobile_width integer check (mobile_width is null or mobile_width between 1 and 12000),
  mobile_height integer check (mobile_height is null or mobile_height between 1 and 12000),
  eyebrow text check (eyebrow is null or char_length(btrim(eyebrow)) between 1 and 40),
  heading text not null check (char_length(btrim(heading)) between 1 and 120),
  description text check (description is null or char_length(btrim(description)) between 1 and 300),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  cta_path text check (
    cta_path is null or (
      cta_path ~ '^/(?:[a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9-]*)*)?(?:\?[a-z0-9][a-z0-9%._=&-]*)?$'
      and cta_path not like '%..%'
      and cta_path not like '//%'
    )
  ),
  enabled boolean not null default true,
  sort_order smallint not null check (sort_order between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sort_order),
  check ((cta_label is null) = (cta_path is null)),
  check ((mobile_image_path is null) = (mobile_width is null)),
  check ((mobile_image_path is null) = (mobile_height is null)),
  check (image_path ~ ('^banners/' || id::text || '/[0-9a-f]{64}\.(jpg|png|webp)$')),
  check (mobile_image_path is null or mobile_image_path ~ ('^banners/' || id::text || '/[0-9a-f]{64}\.(jpg|png|webp)$'))
);

create trigger touch_website_settings_updated_at
before update on public.website_settings
for each row execute function private.touch_updated_at();

create trigger touch_website_sections_updated_at
before update on public.website_sections
for each row execute function private.touch_updated_at();

create trigger touch_website_banners_updated_at
before update on public.website_banners
for each row execute function private.touch_updated_at();

alter table public.website_settings enable row level security;
alter table public.website_sections enable row level security;
alter table public.website_banners enable row level security;

revoke all on public.website_settings, public.website_sections, public.website_banners
from public, anon, authenticated;
grant all on public.website_settings, public.website_sections, public.website_banners to service_role;

-- A blank singleton is structural state, not production marketing content.
insert into public.website_settings (id) values ('storefront');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'percent-website-media',
  'percent-website-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
);

create function public.get_storefront_content()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'updated_at', settings.updated_at,
    'settings', jsonb_build_object(
      'footer_tagline', settings.footer_tagline,
      'footer_description', settings.footer_description
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', section_key,
        'heading', heading,
        'subheading', subheading,
        'body', body,
        'cta_label', cta_label,
        'cta_path', cta_path,
        'media_path', media_path,
        'media_alt', media_alt,
        'media_width', media_width,
        'media_height', media_height,
        'sort_order', sort_order
      ) order by sort_order, section_key)
      from public.website_sections
      where enabled
    ), '[]'::jsonb),
    'banners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'image_path', image_path,
        'mobile_image_path', mobile_image_path,
        'alt', alt,
        'width', width,
        'height', height,
        'mobile_width', mobile_width,
        'mobile_height', mobile_height,
        'eyebrow', eyebrow,
        'heading', heading,
        'description', description,
        'cta_label', cta_label,
        'cta_path', cta_path,
        'sort_order', sort_order
      ) order by sort_order, id)
      from public.website_banners
      where enabled
    ), '[]'::jsonb)
  )
  from public.website_settings settings
  where settings.id = 'storefront';
$$;

revoke all on function public.get_storefront_content()
from public, anon, authenticated, service_role;
grant execute on function public.get_storefront_content() to anon, authenticated;

create function public.get_website_editor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'updated_at', settings.updated_at,
    'settings', jsonb_build_object(
      'footer_tagline', settings.footer_tagline,
      'footer_description', settings.footer_description
    ),
    'sections', coalesce((
      select jsonb_agg(to_jsonb(section) - 'created_at' - 'updated_at' order by section.sort_order, section.section_key)
      from public.website_sections section
    ), '[]'::jsonb),
    'banners', coalesce((
      select jsonb_agg(to_jsonb(banner) - 'created_at' - 'updated_at' order by banner.sort_order, banner.id)
      from public.website_banners banner
    ), '[]'::jsonb)
  )
  into result
  from public.website_settings settings
  where settings.id = 'storefront';

  return result;
end;
$$;

revoke all on function public.get_website_editor()
from public, anon, authenticated, service_role;
grant execute on function public.get_website_editor() to authenticated;

create function public.save_website_content(
  content jsonb,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_updated_at timestamptz;
  settings jsonb;
  section jsonb;
  section_path text;
  banner jsonb;
  banner_id uuid;
  image_path text;
  mobile_path text;
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if content is null or jsonb_typeof(content) <> 'object' then
    raise exception 'Website content must be an object' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_object_keys(content) key
    where key not in ('settings', 'sections', 'banners')
  ) then
    raise exception 'Unsupported website content field' using errcode = '22023';
  end if;

  settings := content -> 'settings';
  if jsonb_typeof(settings) <> 'object'
     or jsonb_typeof(content -> 'sections') <> 'array'
     or jsonb_typeof(content -> 'banners') <> 'array' then
    raise exception 'Settings, sections, and banners are required' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_object_keys(settings) key
    where key not in ('footer_tagline', 'footer_description')
  ) then
    raise exception 'Unsupported website settings field' using errcode = '22023';
  end if;

  if jsonb_array_length(content -> 'sections') > 12
     or jsonb_array_length(content -> 'banners') > 10 then
    raise exception 'Website content exceeds its item limit' using errcode = '22023';
  end if;

  select updated_at into current_updated_at
  from public.website_settings
  where id = 'storefront'
  for update;

  if current_updated_at is distinct from expected_updated_at then
    raise exception 'Website content changed; refresh and retry' using errcode = 'PT409';
  end if;

  delete from public.website_sections;
  for section in select value from jsonb_array_elements(content -> 'sections') loop
    if jsonb_typeof(section) <> 'object' or exists (
      select 1 from jsonb_object_keys(section) key
      where key not in (
        'section_key', 'heading', 'subheading', 'body', 'cta_label', 'cta_path',
        'media_path', 'media_alt', 'media_width', 'media_height', 'enabled', 'sort_order'
      )
    ) then
      raise exception 'Invalid website section' using errcode = '22023';
    end if;

    section_path := nullif(btrim(section ->> 'media_path'), '');
    if section_path is not null and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'percent-website-media' and object.name = section_path
    ) then
      raise exception 'Website section image is unavailable' using errcode = '22023';
    end if;

    insert into public.website_sections (
      section_key, heading, subheading, body, cta_label, cta_path,
      media_path, media_alt, media_width, media_height, enabled, sort_order
    ) values (
      section ->> 'section_key',
      btrim(section ->> 'heading'),
      nullif(btrim(section ->> 'subheading'), ''),
      nullif(btrim(section ->> 'body'), ''),
      nullif(btrim(section ->> 'cta_label'), ''),
      nullif(btrim(section ->> 'cta_path'), ''),
      section_path,
      case when section_path is null then null else nullif(btrim(section ->> 'media_alt'), '') end,
      case when section_path is null then null else (section ->> 'media_width')::integer end,
      case when section_path is null then null else (section ->> 'media_height')::integer end,
      coalesce((section ->> 'enabled')::boolean, true),
      (section ->> 'sort_order')::smallint
    );
  end loop;

  delete from public.website_banners;
  for banner in select value from jsonb_array_elements(content -> 'banners') loop
    if jsonb_typeof(banner) <> 'object' or exists (
      select 1 from jsonb_object_keys(banner) key
      where key not in (
        'id', 'image_path', 'mobile_image_path', 'alt', 'width', 'height',
        'mobile_width', 'mobile_height', 'eyebrow', 'heading', 'description',
        'cta_label', 'cta_path', 'enabled', 'sort_order'
      )
    ) then
      raise exception 'Invalid website banner' using errcode = '22023';
    end if;

    banner_id := (banner ->> 'id')::uuid;
    image_path := btrim(banner ->> 'image_path');
    mobile_path := nullif(btrim(banner ->> 'mobile_image_path'), '');

    if not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'percent-website-media' and object.name = image_path
    ) or (mobile_path is not null and not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'percent-website-media' and object.name = mobile_path
    )) then
      raise exception 'Website banner image is unavailable' using errcode = '22023';
    end if;

    insert into public.website_banners (
      id, image_path, mobile_image_path, alt, width, height,
      mobile_width, mobile_height, eyebrow, heading, description,
      cta_label, cta_path, enabled, sort_order
    ) values (
      banner_id,
      image_path,
      mobile_path,
      btrim(banner ->> 'alt'),
      (banner ->> 'width')::integer,
      (banner ->> 'height')::integer,
      case when mobile_path is null then null else (banner ->> 'mobile_width')::integer end,
      case when mobile_path is null then null else (banner ->> 'mobile_height')::integer end,
      nullif(btrim(banner ->> 'eyebrow'), ''),
      btrim(banner ->> 'heading'),
      nullif(btrim(banner ->> 'description'), ''),
      nullif(btrim(banner ->> 'cta_label'), ''),
      nullif(btrim(banner ->> 'cta_path'), ''),
      coalesce((banner ->> 'enabled')::boolean, true),
      (banner ->> 'sort_order')::smallint
    );
  end loop;

  update public.website_settings
  set
    footer_tagline = coalesce(btrim(settings ->> 'footer_tagline'), ''),
    footer_description = coalesce(btrim(settings ->> 'footer_description'), ''),
    updated_at = clock_timestamp()
  where id = 'storefront';

  return public.get_website_editor();
end;
$$;

revoke all on function public.save_website_content(jsonb, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.save_website_content(jsonb, timestamptz) to authenticated;

commit;
