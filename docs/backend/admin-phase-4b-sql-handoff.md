# Percent Admin Phase 4B — manual SQL handoff

Execute the **entire exact contents** of [20260915130509_admin_order_lifecycle.sql](../../supabase/migrations/20260915130509_admin_order_lifecycle.sql) in Supabase Dashboard → **Percent** (`gijyjdeohvdrnvqfqdha`) → SQL Editor. The migration is wrapped in `begin`/`commit`.

Reason: `orders` contains only current statuses, and `private.audit_logs` lacks old/new status, reason, and internal note. Without a dedicated append-only record, Phase 4B cannot provide truthful immutable lifecycle history.

Structural impact: **one** narrow history table, **zero** columns on existing tables, **zero** schemas, **one** trusted mutation RPC, **one** immutability trigger, **one** admin-read policy, and **one** order/time index. The table contains only order ID, authenticated actor ID, changed dimension, old/new value, reason, optional internal note, and timestamp.

Security: browser roles receive SELECT only under admin RLS. Anonymous and customers cannot see history; customers cannot mutate it. No browser role can directly update `orders`. The authenticated RPC still checks `auth.uid()` and the existing private admin predicate, has an empty fixed search path and fully qualified objects, and accepts no actor ID.

Rollback: before production history is written, reversing this migration would remove the RPC, immutable trigger, policy, index and history table. Once real history exists, dropping the table would destroy audit evidence and must not be done. Removing only the RPC would stop new lifecycle changes while preserving history. An in-flight failure rolls back both order status and history writes. The SQL itself does not update any order, inventory, product, payment or shipment row.

Do not run `supabase db push` or automatically repair migration history. The user will manually execute SQL and send **“SQL executed successfully”**. Hosted verification and UI work resume only after that confirmation.
