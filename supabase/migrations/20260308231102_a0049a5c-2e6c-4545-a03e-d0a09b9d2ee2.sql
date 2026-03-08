
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'agent', 'user');
CREATE TYPE public.vehicle_type AS ENUM ('bike', 'car', 'foot');
CREATE TYPE public.availability_status AS ENUM ('online', 'offline', 'busy');
CREATE TYPE public.order_status AS ENUM (
  'pending_assignment', 'accepted', 'en_route_pickup', 'arrived_pickup',
  'picked_up', 'in_transit', 'arrived_delivery', 'delivered', 'cancelled'
);
CREATE TYPE public.order_response_type AS ENUM ('accepted', 'rejected', 'negotiated');

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Delivery agents table
CREATE TABLE public.delivery_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  agent_code TEXT NOT NULL UNIQUE,
  vehicle vehicle_type NOT NULL DEFAULT 'bike',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  average_rating NUMERIC(3,2) DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own profile" ON public.delivery_agents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can update own profile" ON public.delivery_agents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can insert own profile" ON public.delivery_agents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_delivery_agents_updated_at
  BEFORE UPDATE ON public.delivery_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agent availability table
CREATE TABLE public.agent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.delivery_agents(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status availability_status NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own availability" ON public.agent_availability
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can update own availability" ON public.agent_availability
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can insert own availability" ON public.agent_availability
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_agent_availability_updated_at
  BEFORE UPDATE ON public.agent_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Delivery orders table
CREATE TABLE public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  agent_id UUID REFERENCES public.delivery_agents(id),
  agent_user_id UUID REFERENCES auth.users(id),
  status order_status NOT NULL DEFAULT 'pending_assignment',
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC(10,7),
  pickup_lng NUMERIC(10,7),
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC(10,7),
  delivery_lng NUMERIC(10,7),
  distance_km NUMERIC(6,2),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  package_description TEXT,
  package_weight_kg NUMERIC(6,2) DEFAULT 0,
  is_fragile BOOLEAN DEFAULT false,
  special_instructions TEXT,
  base_fee NUMERIC(8,2) DEFAULT 0,
  distance_surcharge NUMERIC(8,2) DEFAULT 0,
  weight_surcharge NUMERIC(8,2) DEFAULT 0,
  fragility_surcharge NUMERIC(8,2) DEFAULT 0,
  weather_adjustment NUMERIC(8,2) DEFAULT 0,
  urgency_bonus NUMERIC(8,2) DEFAULT 0,
  total_fee NUMERIC(8,2) DEFAULT 0,
  proof_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view assigned orders" ON public.delivery_orders
  FOR SELECT TO authenticated USING (auth.uid() = agent_user_id);
CREATE POLICY "Agents can update assigned orders" ON public.delivery_orders
  FOR UPDATE TO authenticated USING (auth.uid() = agent_user_id);

CREATE TRIGGER update_delivery_orders_updated_at
  BEFORE UPDATE ON public.delivery_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Agent order responses table
CREATE TABLE public.agent_order_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.delivery_orders(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.delivery_agents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  response_type order_response_type NOT NULL,
  proposed_fee NUMERIC(8,2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_order_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own responses" ON public.agent_order_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can insert own responses" ON public.agent_order_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Delivery tracking table
CREATE TABLE public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.delivery_agents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.delivery_orders(id) ON DELETE CASCADE NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  heading NUMERIC(5,2),
  speed NUMERIC(6,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own tracking" ON public.delivery_tracking
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can insert own tracking" ON public.delivery_tracking
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Order status timeline
CREATE TABLE public.order_status_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.delivery_orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status order_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_status_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own order timeline" ON public.order_status_timeline
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can insert own order timeline" ON public.order_status_timeline
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true);

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for delivery proofs
CREATE POLICY "Delivery proofs are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'delivery-proofs');
CREATE POLICY "Agents can upload delivery proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'delivery-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Indexes
CREATE INDEX idx_delivery_orders_agent ON public.delivery_orders(agent_user_id, status);
CREATE INDEX idx_delivery_orders_status ON public.delivery_orders(status);
CREATE INDEX idx_delivery_tracking_order ON public.delivery_tracking(order_id, recorded_at DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_order_timeline_order ON public.order_status_timeline(order_id, created_at);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_availability;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
