-- Enable RLS on order_sync_failures so anon/authenticated roles cannot read or write directly.
-- Edge Functions and server routes using service_role bypass RLS by design.
ALTER TABLE IF EXISTS public.order_sync_failures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_sync_failures FROM anon, authenticated;
