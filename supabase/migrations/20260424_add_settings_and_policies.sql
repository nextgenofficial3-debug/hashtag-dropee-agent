-- Migration for app_settings and policies

-- Create app_settings table if it does not exist
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    service_areas JSONB DEFAULT '[]'::jsonb,
    pricing JSONB DEFAULT '{"base_fee": 30, "per_km_fee": 8, "min_order": 50, "platform_fee_pct": 10}'::jsonb,
    whatsapp_number TEXT,
    cafe_address TEXT,
    cafe_map_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policies for app_settings
CREATE POLICY "Enable read access for all users on app_settings"
    ON public.app_settings FOR SELECT
    USING (true);

CREATE POLICY "Enable write access for admins on app_settings"
    ON public.app_settings FOR ALL
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin' OR role = 'superadmin'));

-- Insert default row if empty
INSERT INTO public.app_settings (id)
SELECT 'main'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE id = 'main');

-- Create policies table if it does not exist
CREATE TABLE IF NOT EXISTS public.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for policies
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- Policies for policies table
CREATE POLICY "Enable read access for all users on policies"
    ON public.policies FOR SELECT
    USING (true);

CREATE POLICY "Enable write access for admins on policies"
    ON public.policies FOR ALL
    USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin' OR role = 'superadmin'));

-- Trigger to update updated_at on policies
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_policies_updated_at ON public.policies;
CREATE TRIGGER update_policies_updated_at
    BEFORE UPDATE ON public.policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
