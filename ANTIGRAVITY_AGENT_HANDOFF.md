# Antigravity Agent Handoff

This file covers the remaining work that cannot be completed from the local code workspace because it requires access to the live Supabase project, authenticated app sessions, or deployment.

## Scope Already Fixed In Code

- Agent online/offline toggle now writes to `public.agent_availability`, not non-existent `delivery_agents.is_online/status` columns.
- Agent profile loading now creates a missing `delivery_agents` row for valid agent-role users when RLS allows it.
- Profile save updates the existing `delivery_agents` row and refreshes local auth context state.
- Avatar upload now uses unique object paths instead of Storage upsert, avoiding replacement policy failures.
- Customer page now loads saved `customers` plus customers from assigned `orders`.
- Customer add/edit/delete now surfaces Supabase errors.
- Signup context function exists again for the existing signup page, even though the route currently redirects to login.
- Added live DB migration for agent RLS and storage policies:
  `supabase/migrations/20260425094500_fix_agent_profile_availability_orders_customers.sql`

## Required Live Supabase Work

Apply these migrations to the shared Supabase project in order if they have not already been applied:

1. `supabase/migrations/20260414_extend_shared_orders_for_agent.sql`
2. `supabase/migrations/20260424_add_settings_and_policies.sql`
3. `supabase/migrations/20260425094500_fix_agent_profile_availability_orders_customers.sql`

Do not skip the new `20260425094500` migration. The frontend fixes depend on its RLS and Storage policies.

## Verify Database Objects

Confirm these tables exist:

- `public.delivery_agents`
- `public.agent_availability`
- `public.orders`
- `public.customers`
- `public.vendors`
- `public.notifications`
- `public.order_status_timeline`

Confirm these columns exist on `public.orders`:

- `agent_id`
- `agent_user_id`
- `fee`
- `plus_code`
- `proof_photo_url`
- `pickup_address`
- `updated_at`

Confirm these buckets exist and are public:

- `avatars`
- `delivery-proofs`

## Required Policy Checks

Using a real authenticated agent account:

1. `delivery_agents`
   - Agent can select their own row.
   - Agent can update `full_name`, `phone`, `email`, `vehicle`, and `avatar_url`.
   - Agent can insert their own row if it is missing.

2. `agent_availability`
   - Agent can insert their own row.
   - Agent can update `status`, `last_seen`, and `updated_at`.
   - Agent can select their own row.

3. `orders`
   - Agent can insert a new order where `agent_user_id = auth.uid()`.
   - Agent can select orders assigned to them.
   - Agent can update status on orders assigned to them.

4. `customers`
   - Agent can insert, update, delete, and select only their own customer rows.

5. Storage
   - Agent can upload to `avatars/{auth.uid()}/...`.
   - Public URL for avatar loads.
   - Agent can upload to `delivery-proofs/{auth.uid()}/...`.

## Manual App QA

Run this after the migration is live and the frontend is deployed.

1. Login as an agent.
2. Open `/agent/profile`.
3. Change name, phone, email, and vehicle.
4. Click Save Changes.
5. Reload the page and confirm changes persist.
6. Upload a profile photo and confirm it displays after reload.
7. Toggle Offline to Online.
8. Check `public.agent_availability` has `status = 'online'`.
9. Toggle back Offline.
10. Check `status = 'offline'`.
11. Open `/agent/new-order`.
12. Create a quick order with customer name, phone, pickup address, and delivery address.
13. Confirm a row is inserted in `public.orders` with `agent_user_id` set to the logged-in agent user.
14. Open `/agent/orders` and confirm the new order appears.
15. Open `/agent/customers`.
16. Confirm the new order customer appears.
17. Save that order-derived customer as a managed customer.
18. Edit the customer and confirm changes persist.
19. Delete the manually saved customer and confirm it disappears.

## Known Remaining Checks

- Realtime must be enabled for `public.orders` in Supabase replication for live order updates.
- Push notification/FCM behavior was not validated locally.
- The route `/auth/signup` currently redirects to login in `src/App.tsx`; re-enable it only if public self-signup is desired.
- Bundle size warning remains from Vite. It does not block functionality, but code splitting can be done later.

## Local Verification Already Completed

From `agent/`:

```bash
npm run build
npm test
```

Both passed locally. The first test attempt failed in the sandbox with `spawn EPERM`; rerunning with permission passed.
