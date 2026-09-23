-- PHASE 7B HANDOFF ONLY. Do not deploy automatically.
-- Applies only to the verified Percent project gijyjdeohvdrnvqfqdha.
begin;

create table public.website_pages (
  page_key text primary key check (page_key in (
    'shop', 'product_details', 'sold_out', 'about', 'contact', 'faq',
    'policy_shipping', 'policy_returns', 'policy_privacy', 'policy_terms'
  )),
  eyebrow text check (eyebrow is null or char_length(btrim(eyebrow)) between 1 and 60),
  heading text check (heading is null or char_length(btrim(heading)) between 1 and 160),
  subheading text check (subheading is null or char_length(btrim(subheading)) between 1 and 300),
  body text check (body is null or char_length(btrim(body)) between 1 and 1500),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 60),
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
  updated_at timestamptz not null default clock_timestamp(),
  check ((cta_label is null) = (cta_path is null)),
  check ((media_path is null) = (media_alt is null)),
  check ((media_path is null) = (media_width is null)),
  check ((media_path is null) = (media_height is null)),
  check (media_path is null or page_key in ('about', 'contact')),
  check (media_path is null or media_path ~ ('^pages/' || page_key || '/[0-9a-f]{64}\.(jpg|png|webp)$'))
);

create table public.website_page_sections (
  page_key text not null references public.website_pages(page_key) on delete cascade,
  section_key text not null,
  heading text check (heading is null or char_length(btrim(heading)) between 1 and 160),
  body text check (body is null or char_length(btrim(body)) between 1 and 1500),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 60),
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
  sort_order smallint not null check (sort_order between 1 and 30),
  primary key (page_key, section_key),
  unique (page_key, sort_order),
  check ((cta_label is null) = (cta_path is null)),
  check ((media_path is null) = (media_alt is null)),
  check ((media_path is null) = (media_width is null)),
  check ((media_path is null) = (media_height is null)),
  check (media_path is null or page_key = 'about'),
  check (media_path is null or media_path ~ ('^pages/' || page_key || '/[0-9a-f]{64}\.(jpg|png|webp)$')),
  check (
    (page_key = 'product_details' and section_key in ('size_guide', 'details', 'extra_details', 'related', 'archive_notice')) or
    (page_key = 'sold_out' and section_key in ('archive_catalog', 'promise_production', 'promise_permanence', 'promise_exclusivity', 'promise_thanks')) or
    (page_key = 'about' and section_key in ('statement', 'live', 'limited', 'values', 'craft', 'identity')) or
    (page_key = 'contact' and section_key in ('support', 'quick_help')) or
    (page_key = 'faq' and section_key in ('policy_links', 'contact_cta'))
  )
);

create table public.website_faq_categories (
  category_key text primary key check (category_key in ('Orders', 'Shipping', 'Returns', 'Sizing', 'Payments', 'Policies')),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  enabled boolean not null default true,
  sort_order smallint not null unique check (sort_order between 1 and 20)
);

create table public.website_faq_items (
  item_key text primary key check (item_key ~ '^[a-z][a-z0-9-]{0,63}$'),
  category_key text not null references public.website_faq_categories(category_key),
  question text not null check (char_length(btrim(question)) between 1 and 240),
  answer text not null check (char_length(btrim(answer)) between 1 and 2000),
  enabled boolean not null default true,
  sort_order smallint not null check (sort_order between 1 and 100),
  unique (category_key, sort_order)
);

create table public.website_policy_sections (
  page_key text not null references public.website_pages(page_key) on delete cascade
    check (page_key in ('policy_shipping', 'policy_returns', 'policy_privacy', 'policy_terms')),
  section_key text not null check (section_key ~ '^[a-z][a-z0-9-]{0,63}$'),
  heading text not null check (char_length(btrim(heading)) between 1 and 160),
  paragraphs text[] not null check (
    cardinality(paragraphs) between 1 and 20
    and array_position(paragraphs, null) is null
  ),
  sort_order smallint not null check (sort_order between 1 and 100),
  primary key (page_key, section_key),
  unique (page_key, sort_order)
);

alter table public.website_pages enable row level security;
alter table public.website_page_sections enable row level security;
alter table public.website_faq_categories enable row level security;
alter table public.website_faq_items enable row level security;
alter table public.website_policy_sections enable row level security;

revoke all on public.website_pages, public.website_page_sections,
  public.website_faq_categories, public.website_faq_items, public.website_policy_sections
from public, anon, authenticated;
grant all on public.website_pages, public.website_page_sections,
  public.website_faq_categories, public.website_faq_items, public.website_policy_sections
to service_role;

-- A missing row means source-controlled bootstrap. Public only receives enabled children.
create function public.get_storefront_page(p_page_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if p_page_key not in (
    'shop', 'product_details', 'sold_out', 'about', 'contact', 'faq',
    'policy_shipping', 'policy_returns', 'policy_privacy', 'policy_terms'
  ) or p_page_key is null then
    return null;
  end if;
  select jsonb_build_object(
    'page_key', p.page_key, 'updated_at', p.updated_at,
    'eyebrow', p.eyebrow, 'heading', p.heading, 'subheading', p.subheading,
    'body', p.body, 'cta_label', p.cta_label, 'cta_path', p.cta_path,
    'media_path', p.media_path, 'media_alt', p.media_alt,
    'media_width', p.media_width, 'media_height', p.media_height,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', s.section_key, 'heading', s.heading, 'body', s.body,
        'cta_label', s.cta_label, 'cta_path', s.cta_path,
        'media_path', s.media_path, 'media_alt', s.media_alt,
        'media_width', s.media_width, 'media_height', s.media_height,
        'sort_order', s.sort_order
      ) order by s.sort_order)
      from public.website_page_sections s
      where s.page_key = p.page_key and s.enabled
    ), '[]'::jsonb),
    'faq_categories', case when p.page_key = 'faq' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', c.category_key, 'label', c.label, 'sort_order', c.sort_order,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'key', i.item_key, 'question', i.question, 'answer', i.answer,
            'sort_order', i.sort_order
          ) order by i.sort_order)
          from public.website_faq_items i
          where i.category_key = c.category_key and i.enabled
        ), '[]'::jsonb)
      ) order by c.sort_order)
      from public.website_faq_categories c where c.enabled
    ), '[]'::jsonb) else '[]'::jsonb end,
    'policy_sections', case when p.page_key like 'policy_%' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', ps.section_key, 'heading', ps.heading,
        'paragraphs', to_jsonb(ps.paragraphs), 'sort_order', ps.sort_order
      ) order by ps.sort_order)
      from public.website_policy_sections ps where ps.page_key = p.page_key
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into result
  from public.website_pages p where p.page_key = p_page_key;
  return result;
end;
$$;

create function public.get_website_page_editor(p_page_key text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_page_key not in (
    'shop', 'product_details', 'sold_out', 'about', 'contact', 'faq',
    'policy_shipping', 'policy_returns', 'policy_privacy', 'policy_terms'
  ) or p_page_key is null then
    raise exception 'Invalid page' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'page_key', p.page_key, 'updated_at', p.updated_at,
    'eyebrow', p.eyebrow, 'heading', p.heading, 'subheading', p.subheading,
    'body', p.body, 'cta_label', p.cta_label, 'cta_path', p.cta_path,
    'media_path', p.media_path, 'media_alt', p.media_alt,
    'media_width', p.media_width, 'media_height', p.media_height,
    'sections', coalesce((select jsonb_agg(
      to_jsonb(s) - 'page_key' order by s.sort_order)
      from public.website_page_sections s where s.page_key = p.page_key
    ), '[]'::jsonb),
    'faq_categories', case when p.page_key = 'faq' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_key', c.category_key, 'label', c.label,
        'enabled', c.enabled, 'sort_order', c.sort_order,
        'items', coalesce((select jsonb_agg(to_jsonb(i) - 'category_key' order by i.sort_order)
          from public.website_faq_items i where i.category_key = c.category_key), '[]'::jsonb)
      ) order by c.sort_order)
      from public.website_faq_categories c
    ), '[]'::jsonb) else '[]'::jsonb end,
    'policy_sections', case when p.page_key like 'policy_%' then coalesce((
      select jsonb_agg(to_jsonb(ps) - 'page_key' order by ps.sort_order)
      from public.website_policy_sections ps where ps.page_key = p.page_key
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into result from public.website_pages p where p.page_key = p_page_key;
  return result;
end;
$$;

create function public.save_website_page(
  p_page_key text, p_content jsonb, p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  current_updated_at timestamptz;
  section_row jsonb;
  category_row jsonb;
  item_row jsonb;
  policy_row jsonb;
  paragraph_row jsonb;
  policy_paragraphs text[];
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_page_key not in (
    'shop', 'product_details', 'sold_out', 'about', 'contact', 'faq',
    'policy_shipping', 'policy_returns', 'policy_privacy', 'policy_terms'
  ) or p_page_key is null then
    raise exception 'Invalid page' using errcode = '22023';
  end if;
  if p_content is null or jsonb_typeof(p_content) is distinct from 'object' then
    raise exception 'Invalid page document' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_content) as keys(field_name)
    where keys.field_name not in (
      'page_key', 'eyebrow', 'heading', 'subheading', 'body',
      'cta_label', 'cta_path', 'media_path', 'media_alt',
      'media_width', 'media_height', 'sections', 'faq_categories',
      'policy_sections'
    )
  ) then
    raise exception 'Unsupported website page field' using errcode = '22023';
  end if;
  if coalesce(p_content->>'page_key', '') <> p_page_key
     or jsonb_typeof(p_content->'sections') is distinct from 'array'
     or jsonb_typeof(p_content->'faq_categories') is distinct from 'array'
     or jsonb_typeof(p_content->'policy_sections') is distinct from 'array' then
    raise exception 'Invalid page document' using errcode = '22023';
  end if;
  if jsonb_array_length(p_content->'sections') > 30
     or jsonb_array_length(p_content->'faq_categories') > 6
     or jsonb_array_length(p_content->'policy_sections') > 100 then
    raise exception 'Website page exceeds its item limit' using errcode = '22023';
  end if;
  if (p_page_key <> 'faq' and jsonb_array_length(p_content->'faq_categories') <> 0)
     or (p_page_key not like 'policy_%' and jsonb_array_length(p_content->'policy_sections') <> 0)
     or (p_page_key like 'policy_%' and jsonb_array_length(p_content->'sections') <> 0)
     or (p_page_key = 'shop' and jsonb_array_length(p_content->'sections') <> 0) then
    raise exception 'Sections do not belong to page' using errcode = '22023';
  end if;
  if (p_page_key <> 'product_details' and nullif(btrim(p_content->>'heading'), '') is null)
     or (p_page_key = 'faq' and jsonb_array_length(p_content->'faq_categories') = 0)
     or (p_page_key like 'policy_%' and jsonb_array_length(p_content->'policy_sections') = 0) then
    raise exception 'Required page content missing' using errcode = '22023';
  end if;
  if nullif(p_content->>'media_path', '') is not null and not exists (
    select 1 from storage.objects
    where bucket_id = 'percent-website-media'
      and name = p_content->>'media_path'
  ) then
    raise exception 'Website page image is unavailable' using errcode = '22023';
  end if;

  -- Serializes concurrent first saves; subsequent saves lock the page row.
  perform pg_catalog.pg_advisory_xact_lock(7317, pg_catalog.hashtext(p_page_key));
  select updated_at into current_updated_at
  from public.website_pages where page_key = p_page_key for update;
  if current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Website page changed; refresh and retry' using errcode = 'PT409';
  end if;

  insert into public.website_pages (
    page_key, eyebrow, heading, subheading, body, cta_label, cta_path,
    media_path, media_alt, media_width, media_height, updated_at
  ) values (
    p_page_key, p_content->>'eyebrow', p_content->>'heading',
    p_content->>'subheading', p_content->>'body', p_content->>'cta_label',
    p_content->>'cta_path', p_content->>'media_path', p_content->>'media_alt',
    (p_content->>'media_width')::integer,
    (p_content->>'media_height')::integer,
    greatest(clock_timestamp(), coalesce(current_updated_at + interval '1 microsecond', clock_timestamp()))
  ) on conflict (page_key) do update set
    eyebrow = excluded.eyebrow, heading = excluded.heading,
    subheading = excluded.subheading, body = excluded.body,
    cta_label = excluded.cta_label, cta_path = excluded.cta_path,
    media_path = excluded.media_path, media_alt = excluded.media_alt,
    media_width = excluded.media_width, media_height = excluded.media_height,
    updated_at = excluded.updated_at;

  delete from public.website_page_sections where page_key = p_page_key;
  for section_row in select value from jsonb_array_elements(p_content->'sections') loop
    if jsonb_typeof(section_row) is distinct from 'object' then
      raise exception 'Invalid section' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(section_row) as keys(field_name)
      where keys.field_name not in (
        'section_key', 'heading', 'body', 'cta_label', 'cta_path',
        'media_path', 'media_alt', 'media_width', 'media_height',
        'enabled', 'sort_order'
      )
    ) then
      raise exception 'Unsupported website section field' using errcode = '22023';
    end if;
    if nullif(section_row->>'media_path', '') is not null and not exists (
      select 1 from storage.objects
      where bucket_id = 'percent-website-media'
        and name = section_row->>'media_path'
    ) then
      raise exception 'Website section image is unavailable' using errcode = '22023';
    end if;
    insert into public.website_page_sections (
      page_key, section_key, heading, body, cta_label, cta_path,
      media_path, media_alt, media_width, media_height, enabled, sort_order
    ) values (
      p_page_key, section_row->>'section_key', section_row->>'heading',
      section_row->>'body', section_row->>'cta_label', section_row->>'cta_path',
      section_row->>'media_path', section_row->>'media_alt',
      (section_row->>'media_width')::integer,
      (section_row->>'media_height')::integer,
      (section_row->>'enabled')::boolean, (section_row->>'sort_order')::smallint
    );
  end loop;

  if p_page_key = 'faq' then
    delete from public.website_faq_items where item_key is not null;
    delete from public.website_faq_categories where category_key is not null;
    for category_row in select value from jsonb_array_elements(p_content->'faq_categories') loop
      if jsonb_typeof(category_row) is distinct from 'object' then
        raise exception 'Invalid FAQ category' using errcode = '22023';
      end if;
      if exists (
        select 1 from jsonb_object_keys(category_row) as keys(field_name)
        where keys.field_name not in (
          'category_key', 'label', 'enabled', 'sort_order', 'items'
        )
      ) then
        raise exception 'Unsupported FAQ category field' using errcode = '22023';
      end if;
      if jsonb_typeof(category_row->'items') is distinct from 'array' then
        raise exception 'Invalid FAQ category items' using errcode = '22023';
      end if;
      if jsonb_array_length(category_row->'items') > 100 then
        raise exception 'FAQ category exceeds its item limit' using errcode = '22023';
      end if;
      insert into public.website_faq_categories (category_key, label, enabled, sort_order)
      values (category_row->>'category_key', category_row->>'label',
        (category_row->>'enabled')::boolean, (category_row->>'sort_order')::smallint);
      for item_row in select value from jsonb_array_elements(category_row->'items') loop
        if jsonb_typeof(item_row) is distinct from 'object' then
          raise exception 'Invalid FAQ item' using errcode = '22023';
        end if;
        if exists (
          select 1 from jsonb_object_keys(item_row) as keys(field_name)
          where keys.field_name not in (
            'item_key', 'question', 'answer', 'enabled', 'sort_order'
          )
        ) then
          raise exception 'Unsupported FAQ item field' using errcode = '22023';
        end if;
        insert into public.website_faq_items (
          item_key, category_key, question, answer, enabled, sort_order
        ) values (
          item_row->>'item_key', category_row->>'category_key',
          item_row->>'question', item_row->>'answer',
          (item_row->>'enabled')::boolean, (item_row->>'sort_order')::smallint
        );
      end loop;
    end loop;
  end if;

  if p_page_key like 'policy_%' then
    delete from public.website_policy_sections where page_key = p_page_key;
    for policy_row in select value from jsonb_array_elements(p_content->'policy_sections') loop
      if jsonb_typeof(policy_row) is distinct from 'object' then
        raise exception 'Invalid policy section' using errcode = '22023';
      end if;
      if exists (
        select 1 from jsonb_object_keys(policy_row) as keys(field_name)
        where keys.field_name not in (
          'section_key', 'heading', 'paragraphs', 'sort_order'
        )
      ) then
        raise exception 'Unsupported policy section field' using errcode = '22023';
      end if;
      if jsonb_typeof(policy_row->'paragraphs') is distinct from 'array' then
        raise exception 'Invalid policy paragraphs' using errcode = '22023';
      end if;
      if jsonb_array_length(policy_row->'paragraphs') not between 1 and 20 then
        raise exception 'Invalid policy paragraph count' using errcode = '22023';
      end if;
      policy_paragraphs := array[]::text[];
      for paragraph_row in select value from jsonb_array_elements(policy_row->'paragraphs') loop
        if jsonb_typeof(paragraph_row) <> 'string'
           or char_length(btrim(paragraph_row #>> '{}')) not between 1 and 3000 then
          raise exception 'Invalid policy paragraph' using errcode = '22023';
        end if;
        policy_paragraphs := array_append(policy_paragraphs, paragraph_row #>> '{}');
      end loop;
      insert into public.website_policy_sections (
        page_key, section_key, heading, paragraphs, sort_order
      ) values (
        p_page_key, policy_row->>'section_key', policy_row->>'heading',
        policy_paragraphs, (policy_row->>'sort_order')::smallint
      );
    end loop;
  end if;
  return public.get_website_page_editor(p_page_key);
end;
$$;

revoke all on function public.get_storefront_page(text),
  public.get_website_page_editor(text),
  public.save_website_page(text, jsonb, timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.get_storefront_page(text) to anon, authenticated;
grant execute on function public.get_website_page_editor(text),
  public.save_website_page(text, jsonb, timestamptz) to authenticated;

commit;
