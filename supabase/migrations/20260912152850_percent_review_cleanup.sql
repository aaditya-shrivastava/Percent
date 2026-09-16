-- Route customer deletion through Storage cleanup, including in-flight uploads.
revoke delete on public.product_reviews from authenticated;
