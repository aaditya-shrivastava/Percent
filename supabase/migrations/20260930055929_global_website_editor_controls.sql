begin;

-- Global storefront configuration extends the existing singleton rather than
-- introducing parallel settings tables. Defaults reproduce the current source
-- behavior so applying this migration does not visually change the storefront.
alter table public.website_settings
  add column navbar_items jsonb not null default '[
    {"id":"collection","label":"Collection","path":"/shop","enabled":true,"sort_order":1},
    {"id":"about","label":"About Us","path":"/about","enabled":true,"sort_order":2}
  ]'::jsonb,
  add column branding jsonb not null default '{
    "display_name":"% PERCENT",
    "tagline":"LESS ORDINARY. MORE YOU.",
    "logo_path":null,
    "logo_alt":null,
    "logo_width":null,
    "logo_height":null,
    "favicon_path":null
  }'::jsonb,
  add column colors jsonb not null default '{
    "background":"#f7f4ef",
    "surface":"#efe8df",
    "text":"#1d1b1b",
    "muted":"#6f6965",
    "accent":"#711d32",
    "accent_hover":"#6b2737",
    "border":"#d8d0c8",
    "highlight":"#f5f3ee"
  }'::jsonb,
  add column typography jsonb not null default '{
    "display_family":"Inter",
    "heading_family":"Inter",
    "body_family":"Inter",
    "ui_family":"Inter",
    "heading_weight":700,
    "body_weight":400,
    "letter_spacing":0
  }'::jsonb,
  add column social_links jsonb not null default '[]'::jsonb,
  add constraint website_settings_navbar_items_array
    check (jsonb_typeof(navbar_items) = 'array'),
  add constraint website_settings_branding_object
    check (jsonb_typeof(branding) = 'object'),
  add constraint website_settings_colors_object
    check (jsonb_typeof(colors) = 'object'),
  add constraint website_settings_typography_object
    check (jsonb_typeof(typography) = 'object'),
  add constraint website_settings_social_links_array
    check (jsonb_typeof(social_links) = 'array');

create or replace function public.get_storefront_content()
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
      'footer_description', settings.footer_description,
      'navbar_items', settings.navbar_items,
      'branding', settings.branding,
      'colors', settings.colors,
      'typography', settings.typography,
      'social_links', settings.social_links
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

create or replace function public.get_website_editor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if private.current_user_id() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'updated_at', settings.updated_at,
    'settings', jsonb_build_object(
      'footer_tagline', settings.footer_tagline,
      'footer_description', settings.footer_description,
      'navbar_items', settings.navbar_items,
      'branding', settings.branding,
      'colors', settings.colors,
      'typography', settings.typography,
      'social_links', settings.social_links
    ),
    'sections', coalesce((
      select jsonb_agg(to_jsonb(section) - 'created_at' - 'updated_at'
        order by section.sort_order, section.section_key)
      from public.website_sections section
    ), '[]'::jsonb),
    'banners', coalesce((
      select jsonb_agg(to_jsonb(banner) - 'created_at' - 'updated_at'
        order by banner.sort_order, banner.id)
      from public.website_banners banner
    ), '[]'::jsonb)
  )
  into result
  from public.website_settings settings
  where settings.id = 'storefront';

  return result;
end;
$$;

create function public.save_website_global_settings(
  content jsonb,
  expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.current_user_id();
  current_updated_at timestamptz;
  navbar jsonb;
  brand jsonb;
  palette jsonb;
  type_settings jsonb;
  socials jsonb;
  item jsonb;
  logo_path text;
  favicon_path text;
  allowed_fonts constant text[] := array['Inter', 'Georgia', 'system-ui'];
  allowed_socials constant text[] := array['instagram', 'facebook', 'x', 'youtube', 'pinterest', 'linkedin'];
begin
  if actor is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if content is null or jsonb_typeof(content) is distinct from 'object' then
    raise exception 'Global settings must be an object' using errcode = '22023';
  end if;
  if not content ?& array['navbar_items','branding','colors','typography','social_links']
     or (select count(*) from jsonb_object_keys(content)) <> 5 then
    raise exception 'Global settings must contain every supported field and no extras' using errcode = '22023';
  end if;

  navbar := content -> 'navbar_items';
  brand := content -> 'branding';
  palette := content -> 'colors';
  type_settings := content -> 'typography';
  socials := content -> 'social_links';
  if jsonb_typeof(navbar) is distinct from 'array'
     or jsonb_typeof(brand) is distinct from 'object'
     or jsonb_typeof(palette) is distinct from 'object'
     or jsonb_typeof(type_settings) is distinct from 'object'
     or jsonb_typeof(socials) is distinct from 'array' then
    raise exception 'Global settings have an invalid structure' using errcode = '22023';
  end if;
  if jsonb_array_length(navbar) > 8 or jsonb_array_length(socials) > 6 then
    raise exception 'Global settings exceed their item limits' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(navbar) loop
    if jsonb_typeof(item) is distinct from 'object'
       or not item ?& array['id','label','path','enabled','sort_order']
       or (select count(*) from jsonb_object_keys(item)) <> 5 then
      raise exception 'Navbar item must contain exactly id, label, path, enabled, and sort_order' using errcode = '22023';
    end if;
    if jsonb_typeof(item -> 'id') is distinct from 'string'
       or jsonb_typeof(item -> 'label') is distinct from 'string'
       or jsonb_typeof(item -> 'path') is distinct from 'string'
       or jsonb_typeof(item -> 'enabled') is distinct from 'boolean'
       or jsonb_typeof(item -> 'sort_order') is distinct from 'number'
       or (item ->> 'sort_order') !~ '^[1-8]$' then
      raise exception 'Navbar item contains an invalid value type' using errcode = '22023';
    end if;
    if (item ->> 'id') !~ '^[a-z][a-z0-9_-]{0,31}$'
       or char_length(btrim(item ->> 'label')) not between 1 and 40
       or (item ->> 'path') !~ '^/(?:[a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9-]*)*)?(?:\?[a-z0-9][a-z0-9%._=&-]*)?$'
       or (item ->> 'path') like '%..%'
       or (item ->> 'path') like '//%'
       or (item ->> 'sort_order')::integer not between 1 and 8 then
      raise exception 'Navbar item is invalid' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) <> count(distinct value ->> 'id') or count(*) <> count(distinct (value ->> 'sort_order')::integer)
      from jsonb_array_elements(navbar)) then
    raise exception 'Navbar ids and ordering must be unique' using errcode = '22023';
  end if;

  if not brand ?& array['display_name','tagline','logo_path','logo_alt','logo_width','logo_height','favicon_path']
     or (select count(*) from jsonb_object_keys(brand)) <> 7 then
    raise exception 'Branding must contain every supported field and no extras' using errcode = '22023';
  end if;
  if jsonb_typeof(brand -> 'display_name') is distinct from 'string'
     or jsonb_typeof(brand -> 'tagline') is distinct from 'string'
     or jsonb_typeof(brand -> 'logo_path') not in ('string','null')
     or jsonb_typeof(brand -> 'logo_alt') not in ('string','null')
     or jsonb_typeof(brand -> 'logo_width') not in ('number','null')
     or jsonb_typeof(brand -> 'logo_height') not in ('number','null')
     or jsonb_typeof(brand -> 'favicon_path') not in ('string','null') then
    raise exception 'Branding contains an invalid value type' using errcode = '22023';
  end if;
  if char_length(btrim(brand ->> 'display_name')) not between 1 and 40
     or char_length(btrim(brand ->> 'tagline')) not between 1 and 100 then
    raise exception 'Brand text is invalid' using errcode = '22023';
  end if;
  logo_path := case when jsonb_typeof(brand -> 'logo_path') = 'string' then btrim(brand ->> 'logo_path') else null end;
  favicon_path := case when jsonb_typeof(brand -> 'favicon_path') = 'string' then btrim(brand ->> 'favicon_path') else null end;
  if (jsonb_typeof(brand -> 'logo_path') = 'string' and logo_path !~ '^branding/[0-9a-f]{64}\.(jpg|png|webp)$')
     or (jsonb_typeof(brand -> 'favicon_path') = 'string' and favicon_path !~ '^branding/[0-9a-f]{64}\.(jpg|png|webp)$') then
    raise exception 'Brand media path is invalid' using errcode = '22023';
  end if;
  if logo_path is null then
    if jsonb_typeof(brand -> 'logo_alt') is distinct from 'null'
       or jsonb_typeof(brand -> 'logo_width') is distinct from 'null'
       or jsonb_typeof(brand -> 'logo_height') is distinct from 'null' then
      raise exception 'Logo metadata requires a logo path' using errcode = '22023';
    end if;
  else
    if jsonb_typeof(brand -> 'logo_alt') is distinct from 'string'
       or jsonb_typeof(brand -> 'logo_width') is distinct from 'number'
       or jsonb_typeof(brand -> 'logo_height') is distinct from 'number'
       or (brand ->> 'logo_width') !~ '^[1-9][0-9]{0,4}$'
       or (brand ->> 'logo_height') !~ '^[1-9][0-9]{0,4}$' then
      raise exception 'Brand logo metadata has invalid types' using errcode = '22023';
    end if;
    if char_length(btrim(brand ->> 'logo_alt')) not between 1 and 160
       or (brand ->> 'logo_width')::integer not between 1 and 12000
       or (brand ->> 'logo_height')::integer not between 1 and 12000 then
      raise exception 'Brand logo metadata is invalid' using errcode = '22023';
    end if;
  end if;
  if (logo_path is not null and not exists (select 1 from storage.objects where bucket_id='percent-website-media' and name=logo_path))
     or (favicon_path is not null and not exists (select 1 from storage.objects where bucket_id='percent-website-media' and name=favicon_path)) then
    raise exception 'Brand media is unavailable' using errcode = '22023';
  end if;

  if not palette ?& array['background','surface','text','muted','accent','accent_hover','border','highlight']
     or (select count(*) from jsonb_object_keys(palette)) <> 8 then
    raise exception 'Colors must contain every supported token and no extras' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(palette) where jsonb_typeof(value) is distinct from 'string')
     or exists (select 1 from jsonb_each_text(palette) where value !~ '^#[0-9a-fA-F]{6}$') then
    raise exception 'Colors must be complete six-digit hex values' using errcode = '22023';
  end if;

  if not type_settings ?& array['display_family','heading_family','body_family','ui_family','heading_weight','body_weight','letter_spacing']
     or (select count(*) from jsonb_object_keys(type_settings)) <> 7 then
    raise exception 'Typography must contain every supported field and no extras' using errcode = '22023';
  end if;
  if jsonb_typeof(type_settings -> 'display_family') is distinct from 'string'
     or jsonb_typeof(type_settings -> 'heading_family') is distinct from 'string'
     or jsonb_typeof(type_settings -> 'body_family') is distinct from 'string'
     or jsonb_typeof(type_settings -> 'ui_family') is distinct from 'string'
     or jsonb_typeof(type_settings -> 'heading_weight') is distinct from 'number'
     or jsonb_typeof(type_settings -> 'body_weight') is distinct from 'number'
     or jsonb_typeof(type_settings -> 'letter_spacing') is distinct from 'number'
     or (type_settings ->> 'heading_weight') !~ '^(400|500|600|700|800)$'
     or (type_settings ->> 'body_weight') !~ '^(400|500|600|700)$'
     or (type_settings ->> 'letter_spacing') !~ '^-?[0-9]+(?:\.[0-9]+)?$' then
    raise exception 'Typography contains an invalid value type' using errcode = '22023';
  end if;
  if not (type_settings ->> 'display_family' = any(allowed_fonts))
     or not (type_settings ->> 'heading_family' = any(allowed_fonts))
     or not (type_settings ->> 'body_family' = any(allowed_fonts))
     or not (type_settings ->> 'ui_family' = any(allowed_fonts))
     or (type_settings ->> 'heading_weight')::integer not in (400,500,600,700,800)
     or (type_settings ->> 'body_weight')::integer not in (400,500,600,700)
     or (type_settings ->> 'letter_spacing')::numeric not between -0.05 and 0.30 then
    raise exception 'Typography setting is invalid' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(socials) loop
    if jsonb_typeof(item) is distinct from 'object'
       or not item ?& array['platform','url','enabled','sort_order']
       or (select count(*) from jsonb_object_keys(item)) <> 4 then
      raise exception 'Social link must contain exactly platform, url, enabled, and sort_order' using errcode = '22023';
    end if;
    if jsonb_typeof(item -> 'platform') is distinct from 'string'
       or jsonb_typeof(item -> 'url') is distinct from 'string'
       or jsonb_typeof(item -> 'enabled') is distinct from 'boolean'
       or jsonb_typeof(item -> 'sort_order') is distinct from 'number'
       or (item ->> 'sort_order') !~ '^[1-6]$' then
      raise exception 'Social link contains an invalid value type' using errcode = '22023';
    end if;
    if not (item ->> 'platform' = any(allowed_socials))
       or (item ->> 'url') !~* '^https://([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::[0-9]{1,5})?(?:/[^[:space:]]*)?$'
       or (item ->> 'sort_order')::integer not between 1 and 6 then
      raise exception 'Social link is invalid' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) <> count(distinct value ->> 'platform') or count(*) <> count(distinct (value ->> 'sort_order')::integer)
      from jsonb_array_elements(socials)) then
    raise exception 'Social platforms and ordering must be unique' using errcode = '22023';
  end if;

  select updated_at into current_updated_at
  from public.website_settings where id='storefront' for update;
  if current_updated_at is distinct from expected_updated_at then
    raise exception 'Website content changed; refresh and retry' using errcode = 'PT409';
  end if;

  update public.website_settings set
    navbar_items = navbar,
    branding = brand,
    colors = palette,
    typography = type_settings,
    social_links = socials,
    updated_at = clock_timestamp()
  where id='storefront';

  return public.get_website_editor();
end;
$$;

revoke all on function public.save_website_global_settings(jsonb,timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.save_website_global_settings(jsonb,timestamptz) to authenticated;

-- Reassert the existing read/write ACLs after function replacement.
revoke all on function public.get_storefront_content()
from public, anon, authenticated, service_role;
grant execute on function public.get_storefront_content() to anon, authenticated;
revoke all on function public.get_website_editor()
from public, anon, authenticated, service_role;
grant execute on function public.get_website_editor() to authenticated;

commit;
