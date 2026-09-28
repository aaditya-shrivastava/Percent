-- Phase 8 SQL gate: review and execute manually on Percent only.
-- Existing blog_posts/blog_sections/blog_images and percent-blog-images are reused.
begin;

alter table public.blog_posts add column first_published_at timestamptz;
update public.blog_posts
set first_published_at = published_at
where status = 'published' and first_published_at is null;

-- The foundation's generic trigger uses transaction-stable now(), which is not
-- a reliable optimistic-concurrency token for multiple edits in one transaction.
drop trigger touch_updated_at on public.blog_posts;
create function private.touch_blog_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(
    pg_catalog.clock_timestamp(),
    old.updated_at + interval '1 microsecond'
  );
  return new;
end;
$$;
create trigger touch_updated_at before update on public.blog_posts
for each row execute function private.touch_blog_updated_at();

-- The public Journal has one featured-story slot. A draft may be marked featured
-- without becoming public; publication enforces at most one live featured post.
create unique index blog_one_published_featured
on public.blog_posts (featured)
where status = 'published' and featured;

-- Public reads retain the existing published-only RLS policies. Admin reads are
-- role-scoped. Browser writes must pass through the atomic RPC below.
revoke insert, update, delete on public.blog_posts,
  public.blog_sections, public.blog_images from authenticated;
drop policy admin_manage on public.blog_posts;
drop policy admin_manage on public.blog_sections;
drop policy admin_manage on public.blog_images;
create policy admin_blog_read on public.blog_posts for select to authenticated
using ((select private.is_admin()));
create policy admin_blog_read on public.blog_sections for select to authenticated
using ((select private.is_admin()));
create policy admin_blog_read on public.blog_images for select to authenticated
using ((select private.is_admin()));

create function public.save_blog_post(
  p_post_id uuid,
  p_content jsonb,
  p_expected_updated_at timestamptz
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_old public.blog_posts%rowtype;
  v_status text;
  v_slug text;
  v_category text;
  v_title text;
  v_excerpt text;
  v_introduction text;
  v_author text;
  v_quote text;
  v_featured boolean;
  v_published_at timestamptz;
  v_first_published_at timestamptz;
  v_section jsonb;
  v_paragraph jsonb;
  v_image jsonb;
  v_role text;
  v_url text;
  v_path text;
  v_primary_count integer := 0;
  v_secondary_count integer := 0;
  v_position integer := 0;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_content is null or pg_catalog.jsonb_typeof(p_content) is distinct from 'object' then
    raise exception 'Invalid Blog document' using errcode = '22023';
  end if;
  if exists (
       select 1 from pg_catalog.jsonb_object_keys(p_content) as fields(name)
       where fields.name not in (
         'slug','title','excerpt','introduction','category','author',
         'status','featured','published_at','pull_quote','sections','images'
       )
     ) then
    raise exception 'Invalid Blog document' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_content->'sections') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_content->'images') is distinct from 'array' then
    raise exception 'Invalid Blog sections or images' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_content->'sections') > 30
     or pg_catalog.jsonb_array_length(p_content->'images') > 2 then
    raise exception 'Invalid Blog sections or images' using errcode = '22023';
  end if;

  v_slug := p_content->>'slug';
  v_title := pg_catalog.btrim(p_content->>'title');
  v_excerpt := pg_catalog.btrim(p_content->>'excerpt');
  v_introduction := pg_catalog.btrim(p_content->>'introduction');
  v_category := p_content->>'category';
  v_author := pg_catalog.btrim(p_content->>'author');
  v_quote := nullif(pg_catalog.btrim(p_content->>'pull_quote'), '');
  v_status := p_content->>'status';
  if pg_catalog.jsonb_typeof(p_content->'featured') is distinct from 'boolean' then
    raise exception 'Invalid featured value' using errcode = '22023';
  end if;
  v_featured := (p_content->>'featured')::boolean;
  if v_slug is null or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or pg_catalog.char_length(v_slug) > 120
     or coalesce(pg_catalog.char_length(v_title),0) not between 1 and 180
     or coalesce(pg_catalog.char_length(v_excerpt),0) not between 1 and 600
     or coalesce(pg_catalog.char_length(v_introduction),0) not between 1 and 1200
     or coalesce(pg_catalog.char_length(v_author),0) not between 1 and 120
     or pg_catalog.char_length(coalesce(v_quote,'')) > 600
     or coalesce(v_category,'') not in ('Brand','Design','Style','Process','Community')
     or coalesce(v_status,'') not in ('draft','published') then
    raise exception 'Invalid Blog article fields' using errcode = '22023';
  end if;
  if p_content->>'published_at' is not null then
    v_published_at := (p_content->>'published_at')::timestamptz;
    if v_published_at > pg_catalog.clock_timestamp() then
      raise exception 'Future publication is not supported' using errcode = '22023';
    end if;
  end if;

  if p_post_id is null then
    if p_expected_updated_at is not null or v_status <> 'draft' then
      raise exception 'New articles must first be saved as drafts' using errcode = '22023';
    end if;
    v_id := pg_catalog.gen_random_uuid();
  else
    v_id := p_post_id;
    select * into v_old from public.blog_posts where id = v_id for update;
    if not found then
      raise exception 'Blog article not found' using errcode = '22023';
    end if;
    if v_old.updated_at is distinct from p_expected_updated_at then
      raise exception 'Blog article changed; reload before saving' using errcode = 'PT409';
    end if;
    v_first_published_at := coalesce(
      v_old.first_published_at,
      case when v_old.status = 'published' then v_old.published_at end
    );
    if v_first_published_at is not null and v_slug <> v_old.slug then
      raise exception 'Published Blog slug is permanent' using errcode = '22023';
    end if;
    if v_first_published_at is not null then
      if v_published_at is null then
        v_published_at := v_old.published_at;
      elsif v_published_at is distinct from v_old.published_at then
        raise exception 'Original publication date is permanent' using errcode = '22023';
      end if;
    end if;
  end if;

  for v_section in select value from pg_catalog.jsonb_array_elements(p_content->'sections') loop
    if pg_catalog.jsonb_typeof(v_section) is distinct from 'object' then
      raise exception 'Invalid Blog section' using errcode = '22023';
    end if;
    if exists (
         select 1 from pg_catalog.jsonb_object_keys(v_section) as fields(name)
         where fields.name not in ('heading','paragraphs')
       )
       or coalesce(pg_catalog.char_length(pg_catalog.btrim(v_section->>'heading')),0) not between 1 and 180 then
      raise exception 'Invalid Blog section' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(v_section->'paragraphs') is distinct from 'array' then
      raise exception 'Invalid Blog section' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(v_section->'paragraphs') not between 1 and 20 then
      raise exception 'Invalid Blog section' using errcode = '22023';
    end if;
    for v_paragraph in select value from pg_catalog.jsonb_array_elements(v_section->'paragraphs') loop
      if pg_catalog.jsonb_typeof(v_paragraph) <> 'string'
       or coalesce(pg_catalog.char_length(pg_catalog.btrim(v_paragraph #>> '{}')),0) not between 1 and 3000 then
        raise exception 'Invalid Blog paragraph' using errcode = '22023';
      end if;
    end loop;
  end loop;

  for v_image in select value from pg_catalog.jsonb_array_elements(p_content->'images') loop
    if pg_catalog.jsonb_typeof(v_image) is distinct from 'object' then
      raise exception 'Invalid Blog image' using errcode = '22023';
    end if;
    if exists (
         select 1 from pg_catalog.jsonb_object_keys(v_image) as fields(name)
         where fields.name not in ('role','url','alt','width','height')
       ) then
      raise exception 'Invalid Blog image' using errcode = '22023';
    end if;
    v_role := v_image->>'role';
    v_url := v_image->>'url';
    if v_role = 'primary' then v_primary_count := v_primary_count + 1;
    elsif v_role = 'secondary' then v_secondary_count := v_secondary_count + 1;
    else raise exception 'Invalid Blog image role' using errcode = '22023'; end if;
    if v_primary_count > 1 or v_secondary_count > 1
       or coalesce(pg_catalog.char_length(pg_catalog.btrim(v_image->>'alt')),0) not between 1 and 300
       or pg_catalog.jsonb_typeof(v_image->'width') is distinct from 'number'
       or pg_catalog.jsonb_typeof(v_image->'height') is distinct from 'number' then
      raise exception 'Invalid Blog image metadata' using errcode = '22023';
    end if;
    if (v_image->>'width') !~ '^[0-9]{1,5}$'
       or (v_image->>'height') !~ '^[0-9]{1,5}$' then
      raise exception 'Invalid Blog image metadata' using errcode = '22023';
    end if;
    if (v_image->>'width')::integer not between 1 and 10000
       or (v_image->>'height')::integer not between 1 and 10000 then
      raise exception 'Invalid Blog image metadata' using errcode = '22023';
    end if;
    if v_url like 'storage://percent-blog-images/%' then
      v_path := pg_catalog.substr(v_url, pg_catalog.length('storage://percent-blog-images/') + 1);
      if v_path !~ ('^posts/' || v_id::text || '/[0-9a-f]{64}\.(jpg|png|webp)$')
         or not exists (
           select 1 from storage.objects
           where bucket_id = 'percent-blog-images' and name = v_path
         ) then
        raise exception 'Blog image is unavailable' using errcode = '22023';
      end if;
    elsif v_status <> 'draft' or p_post_id is null
       or not exists (
         select 1 from public.blog_images
         where post_id = v_id and role = v_role and url = v_url
           and url like 'https://images.unsplash.com/%'
       ) then
      -- Existing seeded external URLs may be retained while a draft is edited,
      -- but cannot be introduced anew or published.
      raise exception 'Blog image must use managed media' using errcode = '22023';
    end if;
  end loop;
  if v_status = 'published' and (
    v_primary_count <> 1
    or pg_catalog.jsonb_array_length(p_content->'sections') = 0
    or v_quote is null
  ) then
    raise exception 'Published Blog article is incomplete' using errcode = '22023';
  end if;
  if v_status = 'published' then
    v_published_at := coalesce(v_published_at, v_old.published_at, pg_catalog.clock_timestamp());
    v_first_published_at := coalesce(v_first_published_at, pg_catalog.clock_timestamp());
  elsif p_post_id is not null and v_published_at is null then
    v_published_at := v_old.published_at;
  end if;
  if v_status = 'published' and v_featured and exists (
    select 1 from public.blog_posts
    where status = 'published' and featured and id <> v_id
  ) then
    raise exception 'Another published featured article already exists'
      using errcode = '22023';
  end if;

  if p_post_id is null then
    insert into public.blog_posts (
      id, slug, title, excerpt, introduction, category, author,
      published_at, status, featured, pull_quote, first_published_at
    ) values (
      v_id, v_slug, v_title, v_excerpt, v_introduction, v_category, v_author,
      v_published_at, v_status, v_featured, v_quote, v_first_published_at
    );
  else
    update public.blog_posts set
      slug = v_slug, title = v_title, excerpt = v_excerpt,
      introduction = v_introduction, category = v_category, author = v_author,
      published_at = v_published_at, status = v_status, featured = v_featured,
      pull_quote = v_quote, first_published_at = v_first_published_at
    where id = v_id;
    delete from public.blog_sections where post_id = v_id;
    delete from public.blog_images where post_id = v_id;
  end if;

  for v_section in select value from pg_catalog.jsonb_array_elements(p_content->'sections') loop
    insert into public.blog_sections (post_id, heading, paragraphs, sort_order)
    values (v_id, pg_catalog.btrim(v_section->>'heading'), v_section->'paragraphs', v_position);
    v_position := v_position + 1;
  end loop;
  for v_image in select value from pg_catalog.jsonb_array_elements(p_content->'images') loop
    insert into public.blog_images (post_id, role, url, alt, width, height)
    values (
      v_id, v_image->>'role', v_image->>'url', pg_catalog.btrim(v_image->>'alt'),
      (v_image->>'width')::integer, (v_image->>'height')::integer
    );
  end loop;
  return pg_catalog.jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'status', v_status,
    'updated_at', (select updated_at from public.blog_posts where id = v_id)
  );
end;
$$;

revoke all on function public.save_blog_post(uuid,jsonb,timestamptz)
from public, anon, authenticated, service_role;
grant execute on function public.save_blog_post(uuid,jsonb,timestamptz)
to authenticated;

commit;
