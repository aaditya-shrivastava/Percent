begin;

create or replace function public.save_website_content(
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

  delete from public.website_sections
  where section_key is not null;
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

  delete from public.website_banners
  where id is not null;
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

commit;


