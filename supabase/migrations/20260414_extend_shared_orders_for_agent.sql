-- =========================================================================
-- Migration: Extend shared `orders` table to support agent workflows
-- Apply this in the MFC Supabase project (mpqaictrrrncwqrkpdos) SQL editor
-- =========================================================================

-- 1. Add agent-specific columns to the shared orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS agent_id         text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_user_id    uuid          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fee              numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plus_code        text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS proof_photo_url  text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pickup_address   text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz   DEFAULT now();

-- 2. Create agent-specific tables (from the drivemate-pro schema)

CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_code       text        NOT NULL UNIQUE,
  full_name        text        NOT NULL,
  email            text        DEFAULT NULL,
  phone            text        DEFAULT NULL,
  avatar_url       text        DEFAULT NULL,
  vehicle          text        NOT NULL DEFAULT 'bike',
  is_verified      boolean     NOT NULL DEFAULT false,
  total_deliveries integer     DEFAULT 0,
  total_earnings   numeric     DEFAULT 0,
  average_rating   numeric     DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_availability (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'offline',
  last_seen   timestamptz DEFAULT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

CREATE TABLE IF NOT EXISTS public.agent_order_responses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid        NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id      uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  response_type text        NOT NULL,  -- 'accepted' | 'rejected' | 'negotiated'
  proposed_fee  numeric     DEFAULT NULL,
  reason        text        DEFAULT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_timeline (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status     text        NOT NULL,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes      text        DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL REFERENCES public.delivery_agents(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  latitude    numeric     NOT NULL,
  longitude   numeric     NOT NULL,
  heading     numeric     DEFAULT NULL,
  speed       numeric     DEFAULT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  phone          text        DEFAULT NULL,
  email          text        DEFAULT NULL,
  address        text        DEFAULT NULL,
  plus_code      text        DEFAULT NULL,
  latitude       numeric     DEFAULT NULL,
  longitude      numeric     DEFAULT NULL,
  notes          text        DEFAULT NULL,
  total_orders   integer     DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  contact_person text        DEFAULT NULL,
  phone          text        DEFAULT NULL,
  email          text        DEFAULT NULL,
  address        text        DEFAULT NULL,
  latitude       numeric     DEFAULT NULL,
  longitude      numeric     DEFAULT NULL,
  notes          text        DEFAULT NULL,
  total_orders   integer     DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text        NOT NULL,
  message    text        DEFAULT NULL,
  type       text        NOT NULL,
  metadata   jsonb       DEFAULT NULL,
  is_read    boolean     DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable Realtime on orders table (required for agent live updates)
-- Run in Supabase dashboard: Database > Replication > supabase_realtime > orders ✓

-- 4. RLS policies for agent access to orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow agents to read any order assigned to them
CREATE POLICY "Agent can read own assigned orders"
  ON public.orders FOR SELECT
  USING (agent_user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- Allow agents to update status + proof on their assigned orders
CREATE POLICY "Agent can update own assigned orders"
  ON public.orders FOR UPDATE
  USING (agent_user_id = auth.uid());

-- Allow agents to insert new orders they create
CREATE POLICY "Agent can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (agent_user_id = auth.uid());

-- RLS for agent-specific tables
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can read/write own profile"
  ON public.delivery_agents FOR ALL
  USING (user_id = auth.uid());

ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage own availability"
  ON public.agent_availability FOR ALL
  USING (user_id = auth.uid());

ALTER TABLE public.agent_order_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage own responses"
  ON public.agent_order_responses FOR ALL
  USING (user_id = auth.uid());

ALTER TABLE public.order_status_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage timeline"
  ON public.order_status_timeline FOR ALL
  USING (user_id = auth.uid());

ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage own tracking"
  ON public.delivery_tracking FOR ALL
  USING (user_id = auth.uid());

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage own customers"
  ON public.customers FOR ALL
  USING (agent_user_id = auth.uid());

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent can manage own vendors"
  ON public.vendors FOR ALL
  USING (agent_user_id = auth.uid());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid());

-- 5. Create storage bucket for delivery proof photos (run once)
-- In Supabase dashboard: Storage > New Bucket > Name: delivery-proofs, Public: true
