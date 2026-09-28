# Phase 8 — Corrected Blog SQL ready for manual review

**Status: PHASE 8 — CORRECTED BLOG SQL READY.** The migration below is still unexecuted. Static review does not establish hosted runtime behavior.

**Project verified:** Percent, `gijyjdeohvdrnvqfqdha`, `ap-south-1`, `ACTIVE_HEALTHY`. The unrelated project was not accessed. **This migration has not been executed.** The Supabase CLI was unavailable locally, including an attempted `npx` invocation, so the migration filename follows the repository's chronological convention and should be checked during manual review.

## 1. Existing Blog architecture and article inventory

`/blog` uses `BlogPage`, `BlogCard`, and `BlogCategoryFilter`; `/blog/:slug` uses `BlogDetailPage`. The article shape and nine source-controlled stories live in `src/data/blog.ts`. `StorefrontBootstrap` fetches published `blog_posts`, `blog_sections`, and `blog_images` through the catalog loader and mutates the in-memory article list with `hydrateBlogs`. The Admin sidebar already links to `/admin/blog`, but that route is a placeholder. About, global search, the Footer, and a homepage Journal banner link to Blog content.

| Existing URL slug | Current source title | Category | Source date | Featured |
| --- | --- | --- | --- | --- |
| `the-story-behind-100-pieces` | The Story Behind Limited Pieces | Brand | 2026-08-12 | Yes |
| `the-power-of-limited` | The Power of Limited | Brand | 2026-08-05 | No |
| `intentional-design` | Intentional Design | Design | 2026-07-28 | No |
| `style-in-real-life` | Style in Real Life | Community | 2026-07-19 | No |
| `inside-the-studio` | Inside the Studio | Process | 2026-07-10 | No |
| `designing-for-self-expression` | Designing for Self-Expression | Design | 2026-06-30 | No |
| `less-ordinary` | Less Ordinary. | Brand | 2026-06-21 | No |
| `from-fabric-to-final-piece` | From Fabric to Final Piece | Process | 2026-06-12 | No |
| `uniforms-reconsidered` | Uniforms, Reconsidered | Style | 2026-06-03 | No |

The slug for the first article must remain `the-story-behind-100-pieces` even though its source-controlled title and copy were corrected to describe per-design production limits. Its hosted draft still contains the obsolete universal 100-piece claim. That hosted copy must be reconciled explicitly during content acceptance, not published as-is or silently rewritten. The other eight hosted draft slugs match source. Hosted Percent currently has **9 draft posts, 27 sections, 12 externally linked images, 0 published posts**, and **0 objects** in its already-existing private `percent-blog-images` bucket. The hosted first article retains the old title and body. The current `hydrateBlogs([])` path removes the source stories when zero published hosted rows are returned; this is an authority bug to correct after backend approval, before content migration. No source article or hosted draft was changed at this gate.

The current article fields are slug, title, excerpt, introduction, category, display date, author, primary image and optional secondary image (URL, alt, width, height), featured flag, ordered sections (heading plus ordered plain paragraphs), and one pull quote rendered after the first section. There are five fixed categories: Brand, Design, Style, Process, Community. Related stories are calculated from the published article collection, preferring the same category; the next-story link uses collection order. Public document titles are set in React, but there is no article-specific SEO description or canonical metadata to migrate. Source images are Unsplash URLs. Existing responsive rules cover desktop, tablet, and mobile layouts; the requested width matrix awaits the Admin UI phase. The listing newsletter is currently a non-submitting placeholder and is outside Blog article management.

## 2. Field map and smallest content model

Reuse the existing `blog_posts`, `blog_sections`, and `blog_images` tables. `blog_sections.heading` plus JSONB **arrays of validated plain-text paragraphs** already represent every current body section. This is controlled structured content, not HTML or a generic block CMS. The existing `pull_quote` and optional secondary image match the one fixed quote/image placement in the production article component. No arbitrary embeds, scripts, new block types, categories table, or SEO suite are warranted. The existing five-category check is the managed assignment allowlist; Admin will choose one of those values rather than create duplicate free-form strings. Existing `featured` is justified by the public featured-story panel; a partial unique index will allow at most one published featured story.

| Source field | Managed destination |
| --- | --- |
| `slug`, title, excerpt, introduction, category, author, pullQuote, featured | `blog_posts` corresponding columns |
| Source `date` | `blog_posts.published_at` at accepted publication, preserving the intended historical display date |
| `sections[]` | `blog_sections` rows ordered by `sort_order`; `paragraphs` remains a validated JSON string array |
| `image`, `secondaryImage` | `blog_images` primary/secondary rows; source media must be copied into managed private Storage before publication |
| Stable published slug | Existing unique slug plus new `first_published_at` marker; changing slug after first publication is rejected |

`created_at` remains creation time, `updated_at` the concurrency token, `published_at` the public date, and the new `first_published_at` the permanent slug-freeze marker. The existing seeded drafts have historical `published_at` values despite still being drafts; they stay private under the existing published-only RLS. At acceptance, each date must be deliberately reviewed. The migration does not publish or rewrite these drafts.

## 3. Publication, URLs, and concurrency

The managed lifecycle has **draft** and **published**. New posts must first save as drafts; drafts can be edited and previewed by Admin but cannot appear in anonymous listing, detail, search, About cards, related stories, or public image signing. A published post requires an ordered body, pull quote, and managed primary image. Publishing makes it visible only when `published_at <= now()`. Published-to-draft is allowed: public read and image signing stop, but the post and URL slug remain reserved. Republishing retains its original publication date. Once first published, slug and public date are immutable; draft slugs may be deliberately edited before that point. No redirect infrastructure or permanent deletion is proposed. The existing partial unique slug constraint remains authoritative.

The `save_blog_post(uuid,jsonb,timestamptz)` RPC performs a complete atomic replacement of one article and its sections/images. A null ID creates a server-generated draft. An existing ID locks the row, compares `updated_at`, and raises `PT409` for stale saves; no automatic retry is allowed. The Blog-specific timestamp trigger uses `clock_timestamp()` and advances by at least one microsecond. Invalid fields, unknown categories, malformed sections, duplicate image roles, missing Storage objects, cross-post paths, future publication, and unsafe slug changes are rejected. The RPC returns only ID, slug, status, and new version token. It never accepts an actor/role parameter and checks `auth.uid()` plus `private.is_admin()` internally.

The review correction normalizes a null incoming publication date to the stored date **before** enforcing immutability for an article that was first published. Unpublishing and republishing therefore retain the original date; an explicit replacement date remains invalid. Array types are checked in separate statements before any `jsonb_array_length` calls. Image dimensions are checked as JSON numbers, then as bounded unsigned integer text, and only then cast; invalid metadata raises controlled `22023`. A conflicting published featured article raises controlled `22023` before writing, while the partial unique index remains the final race guarantee.

## 4. Storage, public reads, Admin contract, and preview

Reuse the existing **private** `percent-blog-images` bucket (10 MB, JPG/PNG/WebP; currently empty). Do not mix Blog files into `percent-website-media`, and do not create another bucket. Managed references use `storage://percent-blog-images/posts/{post_uuid}/{64hex}.{jpg|png|webp}`. New media will be uploaded by a dedicated `percent-blog-media` Edge Function after the initial draft exists. It will verify the caller's existing server-side Admin role, enforce 10 MB and magic bytes, derive the canonical path, prevent overwrite, issue short-lived Admin draft previews, sign publicly only images referenced by live published posts, reject arbitrary/cross-post signing, and refuse cleanup of referenced objects. Browser code uses only the publishable key; the service-role credential stays in the Edge Function. Existing external image URLs may remain unchanged in a hosted **draft** while it is edited, but cannot be introduced into new records or published. The three existing secondary images and all nine primary images must be copied once during later content acceptance.

Public listing/detail continue reading the existing published-only RLS views of the three Blog tables; no new public read RPC is needed. The public `BlogPage` and `BlogDetailPage` components will be reused, with signed managed media and published-only related/next-story calculations. Admin reads of all posts and drafts remain role-scoped by RLS; direct browser writes are revoked. The existing Admin sidebar route will become `/admin/blog`, with `/admin/blog/new` and `/admin/blog/:id/edit`, after SQL verification. Draft preview will inject the unsaved article into the **same production article component** inside an authenticated, contained same-origin preview; it will not persist or expose the draft publicly. No Admin page or Edge Function was deployed at this SQL gate.

## 5. Security and structural impact

The three existing tables already have RLS and published-only public SELECT policies. The foundation currently also grants authenticated direct INSERT/UPDATE/DELETE under `admin_manage`; those paths would bypass atomic validation and PT409. The migration revokes those write grants, replaces the Blog `admin_manage` policies with Admin SELECT policies, and grants `EXECUTE` on the narrow save RPC only to `authenticated`. Its `SECURITY DEFINER` body has a fixed empty `search_path`, fully qualified object references, a current-user Admin check, strict document keys, and no arbitrary SQL capability. Anonymous callers have no save grant, customers fail the internal Admin check, and no direct Storage policy is added. The new function should be reviewed with Supabase security advisors after manual execution. Baseline advisor notices predate this migration and concern other intentional public-read or RPC-only tables; this gate changes none of them.

**Structural impact:** 0 new tables, 0 new buckets, **1** column (`blog_posts.first_published_at`), **1** partial unique index, **1** private timestamp function and replacement trigger, **1** public Admin save RPC, and Blog-only policy/grant changes. The migration backfills `first_published_at` only for already-published rows (currently none). It does not insert, publish, or change any of the nine draft articles.

## 6. Cutover, checks, and rollback

After manual SQL execution on the verified Percent project, first run hosted schema/signature, grant/RLS, role, validation, draft/public visibility, PT409, slug, date, featured, and rollback tests. Deploy and verify the separate Blog media function before enabling upload UI. Then build Admin Blog and same-component preview. Migrate each existing source story to its matching hosted draft while preserving its exact slug, copy, category, author, and intended date. Resolve the first article's obsolete hosted 100-piece text against the current corrected source. Upload the source images to managed private Storage; compare the public article and preview before publishing. Keep source-controlled articles authoritative until all nine managed published stories and media are accepted, then switch Journal, About cards, and search together to managed published content. A missing migration state may use the source fallback; an RPC/network failure must show an error, not silently restore stale source copy.

Before cutover, rollback is `ROLLBACK` of the manual transaction if an error occurs. After commit but before managed content migration, the Blog-only migration can be reversed by revoking/dropping the save RPC and index, restoring the original Admin policies/grants and generic trigger, then dropping `first_published_at`; review any intervening Blog writes before doing so. After managed content is accepted, prefer a forward fix and a database backup rather than dropping article history or reverting authority. No rollback should delete published posts or referenced media.

### Hosted runtime test matrix — pending manual deployment

1. New draft save.
2. Existing draft edit.
3. First publication.
4. Published → draft with null incoming `published_at`.
5. Unpublish preserves the original publication date.
6. Republish preserves the original publication date.
7. Published date mutation rejected.
8. Published slug mutation rejected.
9. Draft slug change allowed.
10. Stale update returns `PT409`.
11. Malformed top-level sections return `22023`.
12. Malformed top-level images return `22023`.
13. Malformed section paragraphs return `22023`.
14. Decimal image width returns `22023`.
15. Decimal image height returns `22023`.
16. Oversized numeric dimension returns `22023`.
17. Missing Storage object returns `22023`.
18. Cross-post media path returns `22023`.
19. Existing seeded external image can remain in a draft.
20. External image cannot be newly introduced.
21. External image cannot be published.
22. Second published featured post returns controlled `22023`.
23. Unique featured index still protects races.
24. Customer save denied.
25. Anonymous save denied.
26. Admin and super-admin save allowed.

These cases require rollback fixtures or carefully controlled hosted verification after manual deployment. None is claimed as runtime-passed here.

## 7. Complete SQL for manual review

The complete migration follows verbatim below. It must be executed only after review and only on `gijyjdeohvdrnvqfqdha`.

```sql
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
```
