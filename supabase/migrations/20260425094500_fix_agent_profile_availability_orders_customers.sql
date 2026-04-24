-- Fix agent profile save, availability toggle, order creation, and customer management RLS.
-- Apply to the shared Supabase project before deploying this agent app.

alter table public.delivery_agents enable row level security;
alter table public.agent_availability enable row level security;
alter table public.orders enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.notifications enable row level security;

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('delivery-proofs', 'delivery-proofs', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Agent can read/write own profile" on public.delivery_agents;
drop policy if exists "Agents can view own profile" on public.delivery_agents;
drop policy if exists "Agents can update own profile" on public.delivery_agents;
drop policy if exists "Agents can insert own profile" on public.delivery_agents;

create policy "Agents can view own profile"
on public.delivery_agents
for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Agents can update own profile"
on public.delivery_agents
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Agents can insert own profile"
on public.delivery_agents
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Agent can manage own availability" on public.agent_availability;
drop policy if exists "Agents can view own availability" on public.agent_availability;
drop policy if exists "Agents can update own availability" on public.agent_availability;
drop policy if exists "Agents can insert own availability" on public.agent_availability;

create policy "Agents can view own availability"
on public.agent_availability
for select
to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Agents can update own availability"
on public.agent_availability
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Agents can insert own availability"
on public.agent_availability
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Agent can read own assigned orders" on public.orders;
drop policy if exists "Agent can update own assigned orders" on public.orders;
drop policy if exists "Agent can insert orders" on public.orders;

create policy "Agent can read own assigned orders"
on public.orders
for select
to authenticated
using (agent_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Agent can update own assigned orders"
on public.orders
for update
to authenticated
using (agent_user_id = auth.uid())
with check (agent_user_id = auth.uid());

create policy "Agent can insert orders"
on public.orders
for insert
to authenticated
with check (agent_user_id = auth.uid());

drop policy if exists "Agent can manage own customers" on public.customers;
drop policy if exists "Agents can view own customers" on public.customers;
drop policy if exists "Agents can insert own customers" on public.customers;
drop policy if exists "Agents can update own customers" on public.customers;
drop policy if exists "Agents can delete own customers" on public.customers;

create policy "Agents can view own customers"
on public.customers
for select
to authenticated
using (agent_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Agents can insert own customers"
on public.customers
for insert
to authenticated
with check (agent_user_id = auth.uid());

create policy "Agents can update own customers"
on public.customers
for update
to authenticated
using (agent_user_id = auth.uid())
with check (agent_user_id = auth.uid());

create policy "Agents can delete own customers"
on public.customers
for delete
to authenticated
using (agent_user_id = auth.uid());

drop policy if exists "Agent can manage own vendors" on public.vendors;
drop policy if exists "Agents can view own vendors" on public.vendors;
drop policy if exists "Agents can insert own vendors" on public.vendors;
drop policy if exists "Agents can update own vendors" on public.vendors;
drop policy if exists "Agents can delete own vendors" on public.vendors;

create policy "Agents can view own vendors"
on public.vendors
for select
to authenticated
using (agent_user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Agents can insert own vendors"
on public.vendors
for insert
to authenticated
with check (agent_user_id = auth.uid());

create policy "Agents can update own vendors"
on public.vendors
for update
to authenticated
using (agent_user_id = auth.uid())
with check (agent_user_id = auth.uid());

create policy "Agents can delete own vendors"
on public.vendors
for delete
to authenticated
using (agent_user_id = auth.uid());

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "agent: public can view avatars" on storage.objects;
drop policy if exists "agent: users can upload own avatar" on storage.objects;

create policy "agent: public can view avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "agent: users can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Delivery proofs are publicly accessible" on storage.objects;
drop policy if exists "Agents can upload delivery proofs" on storage.objects;
drop policy if exists "agent: public can view delivery proofs" on storage.objects;
drop policy if exists "agent: agents can upload delivery proofs" on storage.objects;

create policy "agent: public can view delivery proofs"
on storage.objects
for select
using (bucket_id = 'delivery-proofs');

create policy "agent: agents can upload delivery proofs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'delivery-proofs'
  and auth.uid()::text = (storage.foldername(name))[1]
);
