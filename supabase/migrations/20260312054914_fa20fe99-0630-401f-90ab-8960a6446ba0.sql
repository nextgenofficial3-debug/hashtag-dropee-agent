
-- 1. Add INSERT policy for delivery_orders so agents can create orders
CREATE POLICY "Agents can insert own orders"
ON public.delivery_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = agent_user_id);

-- 2. Create customers table for tracking repeat customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  latitude numeric,
  longitude numeric,
  plus_code text,
  notes text,
  total_orders integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own customers"
ON public.customers FOR SELECT TO authenticated
USING (auth.uid() = agent_user_id);

CREATE POLICY "Agents can insert own customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth.uid() = agent_user_id);

CREATE POLICY "Agents can update own customers"
ON public.customers FOR UPDATE TO authenticated
USING (auth.uid() = agent_user_id);

CREATE POLICY "Agents can delete own customers"
ON public.customers FOR DELETE TO authenticated
USING (auth.uid() = agent_user_id);

-- 3. Create vendors table
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  latitude numeric,
  longitude numeric,
  contact_person text,
  notes text,
  total_orders integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own vendors"
ON public.vendors FOR SELECT TO authenticated
USING (auth.uid() = agent_user_id);

CREATE POLICY "Agents can insert own vendors"
ON public.vendors FOR INSERT TO authenticated
WITH CHECK (auth.uid() = agent_user_id);

CREATE POLICY "Agents can update own vendors"
ON public.vendors FOR UPDATE TO authenticated
USING (auth.uid() = agent_user_id);

CREATE POLICY "Agents can delete own vendors"
ON public.vendors FOR DELETE TO authenticated
USING (auth.uid() = agent_user_id);
