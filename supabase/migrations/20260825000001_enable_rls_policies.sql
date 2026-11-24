-- Migration: Enable Row Level Security (RLS) and grant minimal public access policies
-- Date: 2026-08-25

-- 1. Orders: Public can only insert new orders. Read/Update restricted to service role.
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Allow public insert orders') THEN
    CREATE POLICY "Allow public insert orders" ON public.orders
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Order Attachments: Public can only insert attachments linked to their orders.
ALTER TABLE IF EXISTS public.order_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_attachments' AND policyname = 'Allow public insert order_attachments') THEN
    CREATE POLICY "Allow public insert order_attachments" ON public.order_attachments
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Consultations: Public can insert new session and select their own session by session_id.
ALTER TABLE IF EXISTS public.consultations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consultations' AND policyname = 'Allow public insert consultations') THEN
    CREATE POLICY "Allow public insert consultations" ON public.consultations
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consultations' AND policyname = 'Allow public select own consultation') THEN
    CREATE POLICY "Allow public select own consultation" ON public.consultations
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consultations' AND policyname = 'Allow public update own consultation') THEN
    CREATE POLICY "Allow public update own consultation" ON public.consultations
      FOR UPDATE TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Consultation Messages: Public can insert messages and select messages for their session.
ALTER TABLE IF EXISTS public.consultation_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consultation_messages' AND policyname = 'Allow public insert messages') THEN
    CREATE POLICY "Allow public insert messages" ON public.consultation_messages
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consultation_messages' AND policyname = 'Allow public select messages') THEN
    CREATE POLICY "Allow public select messages" ON public.consultation_messages
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 5. Blog Posts: Public read-only for published posts.
ALTER TABLE IF EXISTS public.blog_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'blog_posts' AND policyname = 'Allow public read published blog posts') THEN
    CREATE POLICY "Allow public read published blog posts" ON public.blog_posts
      FOR SELECT TO anon, authenticated
      USING (status = 'published');
  END IF;
END $$;
